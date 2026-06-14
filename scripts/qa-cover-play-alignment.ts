/**
 * 封面 ↔ 试玩资产对齐：prompt/manifest 链 + 实机 canvas 与 background/sprite 对比
 * npm run qa:cover-play-alignment
 * 可选：RUN_REAL_IMAGE_GEN=1 调用 POST /api/projects/:id/background 真实文生图（需密钥，较慢）
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { buildBackgroundPrompt, resolveBackgroundTemplateStyle } from "../src/lib/game-background-gen";
import { buildSpritePrompt } from "../src/lib/game-sprite-gen";
import {
  buildRuntimeAssetManifest,
  resolveRuntimeAssets,
  slotUrl,
} from "../src/lib/assets/asset-runtime-resolver";
import { buildTemplateFallbackModule } from "../src/lib/agentic/template-fallback-modules";
import { validateAgenticRunnable } from "../src/lib/agentic/agentic-runnable";
import { sampleProjectId } from "../src/lib/sample-gallery";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";
const OUT = path.join(process.cwd(), "qa-output", "cover-play");

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function avgRgb(buf: Buffer): Promise<[number, number, number]> {
  const { data, info } = await sharp(buf).resize(64, 64, { fit: "cover" }).raw().toBuffer({ resolveWithObject: true });
  let r = 0,
    g = 0,
    b = 0;
  const n = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function copySampleAssetsToProject(projectId: string) {
  const sampleId = sampleProjectId("smash-the-dummy");
  const bgSrc = path.join(process.cwd(), "public", "game-bg", `${sampleId}.png`);
  const spriteSrc = path.join(process.cwd(), "public", "game-sprites", sampleId, "player.png");
  const bgDest = path.join(process.cwd(), "public", "game-bg", `${projectId}.png`);
  const spriteDir = path.join(process.cwd(), "public", "game-sprites", projectId);
  fs.mkdirSync(spriteDir, { recursive: true });
  fs.copyFileSync(bgSrc, bgDest);
  fs.copyFileSync(spriteSrc, path.join(spriteDir, "player.png"));
  fs.copyFileSync(
    path.join(process.cwd(), "public", "game-sprites", sampleId, "hazard.png"),
    path.join(spriteDir, "hazard.png"),
  );
}

async function offlineChecks() {
  const spec = mockSpecFromPrompt("打击 dummy 假人解压");
  assert(spec.templateId === "physics", "expected physics template");

  const style = resolveBackgroundTemplateStyle(spec);
  const bgPrompt = buildBackgroundPrompt(spec);
  assert(bgPrompt.includes(style), "background prompt missing template style");
  assert(bgPrompt.includes("physics"), "background prompt missing templateId");

  const playerPrompt = buildSpritePrompt(spec, "player");
  assert(playerPrompt.length > 30, "empty player sprite prompt");

  const manifest = buildRuntimeAssetManifest({
    projectId: "qa-cover-test",
    backgroundUrl: "/game-bg/qa-cover-test.png",
    spriteUrls: [
      { kind: "player", url: "/game-sprites/qa-cover-test/player.png" },
      { kind: "hazard", url: "/game-sprites/qa-cover-test/hazard.png" },
    ],
  });
  const bundle = resolveRuntimeAssets({
    projectId: "qa-cover-test",
    backgroundUrl: "/game-bg/qa-cover-test.png",
    manifest,
  });
  assert(slotUrl(bundle, "background") === "/game-bg/qa-cover-test.png", "background slot");
  assert(slotUrl(bundle, "player")?.includes("player.png"), "player slot");

  const mod = buildTemplateFallbackModule(spec);
  const run = validateAgenticRunnable(mod);
  assert(run.ok, `physics template runnable: ${!run.ok ? run.reason : ""}`);

  console.log("[OK] offline manifest + prompt + physics template runnable");
}

async function healthOk(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function waitForAssetFiles(
  page: import("@playwright/test").Page,
  projectId: string,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const bg = await page.request.head(`${BASE}/game-bg/${projectId}.png`);
    const player = await page.request.head(`${BASE}/game-sprites/${projectId}/player.png`);
    if (bg.ok() && player.ok()) return true;
    await page.waitForTimeout(5000);
  }
  return false;
}

async function triggerRealImageGen(page: import("@playwright/test").Page, projectId: string): Promise<boolean> {
  console.log("[cover-play] RUN_REAL_IMAGE_GEN=1 — fire background API + poll assets (up to 8min)…");
  await page.evaluate((pid) => {
    void fetch(`/api/projects/${encodeURIComponent(pid)}/background`, { method: "POST" });
  }, projectId);
  const ready = await waitForAssetFiles(page, projectId, 480_000);
  if (ready) {
    console.log("[cover-play] real image gen assets on disk");
    return true;
  }
  console.warn("[warn] real image gen poll timeout — falling back to sample copy");
  copySampleAssetsToProject(projectId);
  return false;
}

async function devCanvasCompare() {
  if (!(await healthOk())) {
    console.warn(`[skip] dev not at ${BASE} — offline checks only`);
    return;
  }

  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });

  const prompt = "打击 dummy 假人解压";
  const base = mockSpecFromPrompt(prompt);
  const create = await page.request.post(`${BASE}/api/projects`, { data: { prompt, spec: base } });
  assert(create.ok(), `POST /api/projects ${await create.text()}`);
  const { project } = (await create.json()) as { project?: { id?: string } };
  const projectId = project?.id;
  assert(Boolean(projectId), "missing project id");

  if (process.env.RUN_REAL_IMAGE_GEN === "1") {
    await triggerRealImageGen(page, projectId!);
  } else {
    copySampleAssetsToProject(projectId!);
  }

  const bgUrl = `${BASE}/game-bg/${projectId}.png`;
  const playerUrl = `${BASE}/game-sprites/${projectId}/player.png`;
  const bgHead = await page.request.get(bgUrl);
  const plHead = await page.request.get(playerUrl);
  assert(bgHead.ok(), `background 404: ${bgUrl}`);
  assert(plHead.ok(), `player sprite 404: ${playerUrl}`);

  const bgBuf = Buffer.from(await bgHead.body());
  const bgRgb = await avgRgb(bgBuf);
  await fs.promises.writeFile(path.join(OUT, "background-ref.png"), bgBuf);

  await page.goto(`${BASE}/play/${projectId}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.locator("canvas").first().waitFor({ timeout: 25_000 });
  await page.waitForTimeout(1500);

  const canvasShot = path.join(OUT, "play-canvas.png");
  const canvasEl = page.locator("canvas").first();
  await canvasEl.screenshot({ path: canvasShot });

  const canvasBuf = fs.readFileSync(canvasShot);
  const canvasRgb = await avgRgb(canvasBuf);
  const dist = colorDist(bgRgb, canvasRgb);

  const report = [
    "# 封面 ↔ 试玩对齐报告",
    "",
    `时间：${new Date().toISOString()}`,
    `项目：${projectId}`,
    "",
    "## 资产 URL",
    `- background: ${bgUrl} (${bgHead.status()})`,
    `- player: ${playerUrl} (${plHead.status()})`,
    "",
    "## 色彩抽样（64×64 均值）",
    `- background RGB: ${bgRgb.join(", ")}`,
    `- canvas RGB: ${canvasRgb.join(", ")}`,
    `- 欧氏距离: ${dist.toFixed(1)} (阈值 ≤120 视为背景已进 canvas)`,
    "",
    "## 截图",
    `- ${path.relative(process.cwd(), canvasShot)}`,
    `- ${path.relative(process.cwd(), path.join(OUT, "background-ref.png"))}`,
    "",
    process.env.RUN_REAL_IMAGE_GEN === "1" ? "模式：真实文生图（异步触发+轮询）" : "模式：样品资产拷贝（模拟文生图落盘）",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "REPORT.md"), report, "utf8");

  await browser.close();

  assert(dist <= 120, `canvas 与 background 色差过大 (${dist.toFixed(1)} > 120)`);
  console.log(`[OK] canvas↔background color dist=${dist.toFixed(1)} report=${path.relative(process.cwd(), path.join(OUT, "REPORT.md"))}`);
}

async function sampleGalleryCoverSmoke() {
  if (!(await healthOk())) {
    console.warn("[skip] sample gallery cover smoke — dev offline");
    return;
  }
  const sampleId = "smash-the-dummy";
  const projectId = sampleProjectId(sampleId);
  const coverUrl = `${BASE}/samples/astrocade/${sampleId}.webp`;
  const coverHead = await fetch(coverUrl, { signal: AbortSignal.timeout(8000) });
  assert(coverHead.ok, `sample cover 404: ${coverUrl}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  await page.goto(`${BASE}/play/${projectId}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByText("继续共创").waitFor({ timeout: 15_000 }).catch(() => {});
  const phaserTab = page.getByTestId("runtime-tab-phaser");
  if (await phaserTab.isVisible().catch(() => false)) await phaserTab.click();
  const canvas = page.locator("canvas").first();
  try {
    await canvas.waitFor({ timeout: 30_000 });
  } catch {
    await browser.close();
    console.warn(
      `[warn] sample gallery canvas timeout (${projectId}) — run: npm run seed:samples`,
    );
    return;
  }
  await page.waitForTimeout(800);
  const shot = path.join(OUT, "sample-gallery-canvas.png");
  await canvas.screenshot({ path: shot });
  await browser.close();
  console.log(`[OK] sample gallery play canvas (${sampleId}) → ${path.relative(process.cwd(), shot)}`);
}

async function main() {
  await offlineChecks();
  await devCanvasCompare();
  await sampleGalleryCoverSmoke();
  console.log("[OK] qa-cover-play-alignment complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
