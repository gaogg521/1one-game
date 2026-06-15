import path from "node:path";
import {
  cloneVisualThresholdsForSample,
  compareCanvasImages,
  passesCanvasParity,
  type CanvasParityMetrics,
} from "@/lib/qa/canvas-image-parity";
import { ANIMATED_GAMEPLAY_SAMPLES } from "@/lib/qa/sample-gameplay-interaction";

const BURST_FRAMES = Number(process.env.CLONE_VISUAL_BURST ?? "5");
const BURST_FRAMES_ANIMATED = Number(process.env.CLONE_VISUAL_BURST_ANIMATED ?? "12");
const BURST_GAP_MS = Number(process.env.CLONE_VISUAL_BURST_GAP_MS ?? "280");

export async function waitForPlayCanvas(
  page: import("@playwright/test").Page,
  projectId: string,
  baseUrl: string,
) {
  await page.goto(`${baseUrl}/play/${projectId}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(
    () => (window as Window & { __PHASER_PLAY_READY__?: boolean }).__PHASER_PLAY_READY__ === true,
    { timeout: 35_000 },
  );
  await page.waitForTimeout(350);
}

export async function captureCanvasBurst(
  page: import("@playwright/test").Page,
  outDir: string,
  prefix: string,
  count = BURST_FRAMES,
  gapMs = BURST_GAP_MS,
): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const p = path.join(outDir, `${prefix}-${i}.png`);
    await page.locator("canvas").first().screenshot({ path: p });
    paths.push(p);
    if (i < count - 1) await page.waitForTimeout(gapMs);
  }
  return paths;
}

export async function bestCloneVisualMatch(
  sourcePaths: string[],
  clonePaths: string[],
): Promise<CanvasParityMetrics> {
  let best: CanvasParityMetrics | null = null;
  for (const s of sourcePaths) {
    for (const c of clonePaths) {
      const m = await compareCanvasImages(s, c);
      if (!best || m.diffRatio < best.diffRatio) best = m;
    }
  }
  return best!;
}

/** 17 款统一 burst 对标：消除单帧/HUD 时序差 */
export async function compareCloneVisualParity(opts: {
  page: import("@playwright/test").Page;
  baseUrl: string;
  sampleId: string;
  sourceId: string;
  cloneId: string;
  shotsDir: string;
}): Promise<{ metrics: CanvasParityMetrics; visualOk: boolean }> {
  const thresholds = cloneVisualThresholdsForSample(opts.sampleId);
  const burstCount = ANIMATED_GAMEPLAY_SAMPLES.has(opts.sampleId) ? BURST_FRAMES_ANIMATED : BURST_FRAMES;

  await waitForPlayCanvas(opts.page, opts.sourceId, opts.baseUrl);
  const sourcePaths = await captureCanvasBurst(opts.page, opts.shotsDir, `source-${opts.sampleId}`, burstCount);
  await waitForPlayCanvas(opts.page, opts.cloneId, opts.baseUrl);
  const clonePaths = await captureCanvasBurst(opts.page, opts.shotsDir, `clone-${opts.sampleId}`, burstCount);
  const metrics = await bestCloneVisualMatch(sourcePaths, clonePaths);
  return { metrics, visualOk: passesCanvasParity(metrics, thresholds) };
}
