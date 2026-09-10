import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const base = "https://operone.1oneclaw.com";
const output = process.env.QA_OUTPUT_DIR ?? "qa-output/prod-runtime-delivery";
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
      const prompt = process.env.QA_PROMPT ?? "手机竖屏竹林小游戏：手指左右移动小熊猫接住落下的竹子，避开石头。初始30颗心，持续70秒后按分数结算胜负，结算后可以重新开始。";
      const input = page.locator("textarea").first();
      await input.fill(prompt);
      await page.screenshot({ path: `${output}/create-mobile.png`, fullPage: true });
      if (!await page.getByRole("button", { name: /开始生成游戏/ }).isEnabled()) {
        await input.fill("");
        await input.pressSequentially(prompt, { delay: 3 });
      }
      await page.getByRole("button", { name: /开始生成游戏/ }).click();
      console.log("[production] build requested");
      await page.waitForURL(/\/play\//, { timeout: 90_000 });
      projectId = page.url().split("/play/")[1]!.split(/[?#]/)[0]!;
      await page.getByTestId("game-production-screen").waitFor({ timeout: 30_000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
      await page.screenshot({ path: `${output}/generating-mobile.png`, fullPage: true });
      await context.storageState({ path: `${output}/owner-state.json` });
    }
    report.projectId = projectId;
    await fs.writeFile(`${output}/REPORT.json`, JSON.stringify(report, null, 2));
    if (process.env.QA_RETRY_FAILED === "1") {
      await page.goto(`${base}/zh-Hans/play/${projectId}`, { waitUntil: "networkidle" });
      const retry = page.getByRole("button", { name: "重新构建" });
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
    if (process.env.QA_BUILD_ONLY === "1") {
      await fs.writeFile(`${output}/detail.json`, JSON.stringify(detail, null, 2));
      report.buildReady = true;
      console.log(`[production] build ready for separate visual and gameplay acceptance: ${projectId}`);
      return;
    }
    await page.goto(`${base}/zh-Hans/play/${projectId}`, { waitUntil: "domcontentloaded" });
    const device = await page.evaluate(() => ({ touchPoints: navigator.maxTouchPoints, width: innerWidth, height: innerHeight }));
    report.device = device;
    assert.ok(device.touchPoints > 0 && Math.min(device.width, device.height) <= 768, "Mobile touch emulation was lost");
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
    const gameBox = await page.locator("iframe").boundingBox();
    assert.ok(gameBox);
    await page.touchscreen.tap(gameBox.x + gameBox.width * 0.5, gameBox.y + gameBox.height * 0.72);
    await page.waitForFunction("window.runtimeEvents.some(e=>e.type==='forge-restart')", undefined, { timeout: 10_000 });
    report.restartObserved = true;
    await page.screenshot({ path: `${output}/played.png` });

    // Telemetry evidence is persisted asynchronously after the end event.
    let mobileEvidence = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await page.request.get(`${base}/api/projects/${projectId}`);
      const current = await response.json();
      mobileEvidence = current.core?.revision?.artifacts?.some((item: { kind: string }) => item.kind === "game_playtest_delivery") === true;
      if (mobileEvidence) break;
      await page.waitForTimeout(1000);
    }
    assert.ok(mobileEvidence, "Actual mobile first-minute and outcome evidence was not persisted");

    const publishResponse = await page.request.post(`${base}/api/works/game/${encodeURIComponent(projectId)}/publication`, {
      data: { action: "publish", revisionId: detail.playRevisionId },
    });
    const publishBody = await publishResponse.json().catch(() => ({})) as { visibility?: string };
    assert.ok(publishResponse.ok(), `Publish rejected: HTTP ${publishResponse.status()} ${JSON.stringify(publishBody)}`);
    assert.equal(publishBody.visibility, "public");

    const publicContext = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
    await publicContext.addInitScript(() => {
      const store = window as unknown as { runtimeEvents: Event[] };
      store.runtimeEvents = [];
      window.addEventListener("message", event => {
        if (event.source === document.querySelector("iframe")?.contentWindow && event.data?.type) store.runtimeEvents.push(event.data);
      });
    });
    const publicPage = await publicContext.newPage();
    const publicResponse = await publicPage.goto(`${base}/zh-Hans/play/${projectId}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    assert.ok(publicResponse?.ok(), `Public play failed: HTTP ${publicResponse?.status() ?? "none"}`);
    await publicPage.frameLocator("iframe").locator("canvas").waitFor({ timeout: 30_000 });
    await publicPage.waitForFunction("window.runtimeEvents.some(e=>e.type==='forge-first-frame')", undefined, { timeout: 15_000 });
    assert.equal(await publicPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    await publicContext.close();
    report.pass = true;
    report.playUrl = page.url();
    report.publicPlayUrl = `${base}/zh-Hans/play/${projectId}`;
    console.log(`[OK] real production iframe boot, first frame, mobile input, outcome, restart, publication and public mobile play: ${page.url()}`);
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
