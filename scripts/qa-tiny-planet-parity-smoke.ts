/** tiny-planet-chopper 单款 parity 冒烟 */
import "dotenv/config";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { SAMPLES } from "../src/lib/samples";
import { sampleProjectId } from "../src/lib/sample-gallery";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { compareCanvasImages, GLOBAL_CANVAS_PARITY, passesCanvasParity } from "../src/lib/qa/canvas-image-parity";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";
const OUT = path.join(process.cwd(), "qa-output", "tiny-planet-test");

async function screenshotPlay(page: import("@playwright/test").Page, projectId: string, shotPath: string) {
  await page.goto(`${BASE}/play/${projectId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const phaserTab = page.getByTestId("runtime-tab-phaser");
  if (await phaserTab.isVisible().catch(() => false)) await phaserTab.click();
  await page.locator("canvas").first().waitFor({ timeout: 45_000 });
  await page
    .waitForFunction(() => (window as unknown as { __PHASER_PLAY_READY__?: boolean }).__PHASER_PLAY_READY__ === true, null, {
      timeout: 30_000,
    })
    .catch(() => {});
  await page.waitForTimeout(900);
  fs.mkdirSync(path.dirname(shotPath), { recursive: true });
  await page.locator("canvas").first().screenshot({ path: shotPath });
}

async function main() {
  const sample = SAMPLES.find((s) => s.id === "tiny-planet-chopper")!;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  await page.goto(`${BASE}/zh-Hans`, { waitUntil: "domcontentloaded", timeout: 90_000 });

  const create = await page.request.post(`${BASE}/api/projects`, {
    data: { prompt: sample.prompt, spec: mockSpecFromPrompt(sample.prompt) },
  });
  const { project } = (await create.json()) as { project?: { id?: string } };
  const userId = project?.id;
  if (!userId) throw new Error("no user id");

  const sampleShot = path.join(OUT, "sample.png");
  const userShot = path.join(OUT, "user.png");
  await screenshotPlay(page, sampleProjectId(sample.id), sampleShot);
  await screenshotPlay(page, userId, userShot);

  const metrics = await compareCanvasImages(sampleShot, userShot);
  const ok = passesCanvasParity(metrics, GLOBAL_CANVAS_PARITY);
  console.log(`[${ok ? "OK" : "GAP"}] tiny-planet-chopper dist=${metrics.colorDist.toFixed(1)} diff=${(metrics.diffRatio * 100).toFixed(0)}%`);
  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
