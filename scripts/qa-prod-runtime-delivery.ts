import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const base = "https://operone.1oneclaw.com";
const output = "qa-output/prod-runtime-delivery";
type Event = { type: string; frames?: number; score?: number; entities?: number; won?: boolean; [key: string]: unknown };
type Detail = { core?: { revision?: { status?: string; summary?: string } }; assetJob?: { status?: string; progress?: { stage?: string } }; runtimeDelivery?: { status?: string }; playRevisionId?: string };

async function main() {
  if (process.env.QA_PROD_RUNTIME_DELIVERY !== "1") throw new Error("Explicit opt-in required");
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
  await context.addInitScript(() => {
    const store = window as unknown as { runtimeEvents: Event[] };
    store.runtimeEvents = [];
    window.addEventListener("message", event => {
      if (event.source === document.querySelector("iframe")?.contentWindow && event.data?.type) store.runtimeEvents.push(event.data);
    });
  });
  const page = await context.newPage();
  const report: Record<string, unknown> = { pass: false, startedAt: new Date().toISOString() };
  try {
    if (process.env.QA_RESUME_STATE) await context.addCookies(JSON.parse(await fs.readFile(process.env.QA_RESUME_STATE, "utf8")).cookies);
    let projectId = process.env.QA_PROJECT_ID;
    if (!projectId) {
      await page.goto(`${base}/zh-Hans/create`, { waitUntil: "networkidle" });
      const prompt = "手机竖屏竹林小游戏：手指左右移动小熊猫接住落下的竹子，避开石头。初始30颗心，持续70秒后按分数结算胜负，结算后可以重新开始。";
      const input = page.locator("textarea").first();
      await input.fill(prompt);
      if (!await page.getByRole("button", { name: /生成可玩版本/ }).isEnabled()) {
        await input.fill("");
        await input.pressSequentially(prompt, { delay: 3 });
      }
      await page.getByRole("button", { name: /生成可玩版本/ }).click();
      console.log("[production] design requested");
      await page.getByRole("button", { name: /保存并打开/ }).waitFor({ timeout: 30 * 60_000 });
      await page.getByRole("button", { name: /保存并打开/ }).click();
      await page.waitForURL(/\/play\//, { timeout: 90_000 });
      projectId = page.url().split("/play/")[1]!.split(/[?#]/)[0]!;
      await context.storageState({ path: `${output}/owner-state.json` });
    }
    report.projectId = projectId;
    await fs.writeFile(`${output}/REPORT.json`, JSON.stringify(report, null, 2));
    if (process.env.QA_RETRY_FAILED === "1") {
      await page.goto(`${base}/zh-Hans/play/${projectId}`, { waitUntil: "networkidle" });
      const retry = page.locator('[data-testid="runtime-delivery-status"] button');
      await retry.waitFor({ timeout: 30_000 });
      await retry.click();
      console.log(`[production] requested owner retry for ${projectId}`);
    }
    const deadline = Date.now() + 4 * 60 * 60_000;
    let detail: Detail = {};
    let lastState = "";
    while (Date.now() < deadline) {
      const res = await page.request.get(`${base}/api/projects/${projectId}`);
      assert.equal(res.status(), 200);
      detail = await res.json();
      const state = JSON.stringify({ revision: detail.core?.revision?.status, job: detail.assetJob?.status, stage: detail.assetJob?.progress?.stage, runtime: detail.runtimeDelivery?.status });
      if (state !== lastState) { console.log(`[production] ${projectId} ${state}`); lastState = state; }
      if (detail.runtimeDelivery?.status === "passed" && detail.core?.revision?.status === "ready") break;
      if (!detail.assetJob && detail.core?.revision?.status === "failed") throw new Error(`production_failed:${detail.core.revision.summary}`);
      await page.waitForTimeout(10_000);
    }
    assert.equal(detail.runtimeDelivery?.status, "passed", "No completed runtime verification");
    report.revisionId = detail.playRevisionId;
    await page.goto(`${base}/zh-Hans/play/${projectId}`, { waitUntil: "domcontentloaded" });
    await page.frameLocator("iframe").locator("canvas").waitFor({ timeout: 30_000 });
    await page.waitForFunction("window.runtimeEvents.some(e=>e.type==='forge-first-frame')", undefined, { timeout: 15_000 });
    const started = Date.now();
    while (Date.now() - started < 100_000) {
      const box = await page.locator("iframe").boundingBox();
      assert.ok(box);
      const phase = Math.floor((Date.now() - started) / 1500) % 4;
      await page.touchscreen.tap(box.x + box.width * [0.3, 0.7, 0.4, 0.6][phase]!, box.y + box.height * 0.65);
      await page.waitForTimeout(1200);
      const ended = await page.evaluate("window.runtimeEvents.some(e=>e.type==='forge-end'||e.type==='operone-game-end')");
      if (ended && Date.now() - started >= 65_000) break;
    }
    const events = await page.evaluate<Event[]>("window.runtimeEvents");
    report.events = events;
    assert.ok(events.some(e => e.type === "forge-boot"));
    assert.ok(events.some(e => e.type === "forge-first-frame"));
    assert.ok(events.some(e => e.type === "operone-game-input"));
    assert.ok(events.some(e => e.type === "forge-end" || e.type === "operone-game-end"), "No outcome after actual play");
    assert.equal(events.filter(e => e.type === "forge-error" || e.type === "operone-game-error").length, 0);
    await page.screenshot({ path: `${output}/played.png` });
    report.pass = true;
    report.playUrl = page.url();
    console.log(`[OK] real production iframe boot, first frame, mobile input and outcome: ${page.url()}`);
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    await page.screenshot({ path: `${output}/failure.png` }).catch(() => undefined);
    throw error;
  } finally {
    await fs.writeFile(`${output}/REPORT.json`, JSON.stringify(report, null, 2));
    await browser.close();
  }
}
void main();
