import path from "node:path";
import {
  cloneVisualThresholdsForSample,
  compareCanvasImages,
  passesCanvasParity,
  type CanvasParityMetrics,
} from "@/lib/qa/canvas-image-parity";

/** 持续动画场景：单帧截图易错位，需 burst 采样取最佳匹配 */
export const ANIMATED_CLONE_SAMPLES = new Set([
  "crashy-roads",
  "rail-in-air",
  "tiny-planet-chopper",
  "elastic-thief-2",
  "gun-merge-3d-zombie-apocalypse",
  "blade-defender-merge",
  "blocky-sniper-hunter",
  "smash-the-dummy",
  "memory-match-mania",
]);

export async function waitForPlayCanvas(page: import("@playwright/test").Page, projectId: string, baseUrl: string) {
  await page.goto(`${baseUrl}/play/${projectId}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(2200);
}

export async function captureCanvasBurst(
  page: import("@playwright/test").Page,
  outDir: string,
  prefix: string,
  count = 5,
  gapMs = 320,
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

export async function compareCloneVisualParity(opts: {
  page: import("@playwright/test").Page;
  baseUrl: string;
  sampleId: string;
  sourceId: string;
  cloneId: string;
  shotsDir: string;
}): Promise<{ metrics: CanvasParityMetrics; visualOk: boolean }> {
  const thresholds = cloneVisualThresholdsForSample(opts.sampleId);
  const animated = ANIMATED_CLONE_SAMPLES.has(opts.sampleId);

  if (!animated) {
    const sourceShot = path.join(opts.shotsDir, `source-${opts.sampleId}.png`);
    const cloneShot = path.join(opts.shotsDir, `clone-${opts.sampleId}.png`);
    await waitForPlayCanvas(opts.page, opts.sourceId, opts.baseUrl);
    await opts.page.locator("canvas").first().screenshot({ path: sourceShot });
    await waitForPlayCanvas(opts.page, opts.cloneId, opts.baseUrl);
    await opts.page.waitForTimeout(700);
    await opts.page.locator("canvas").first().screenshot({ path: cloneShot });
    const metrics = await compareCanvasImages(sourceShot, cloneShot);
    return { metrics, visualOk: passesCanvasParity(metrics, thresholds) };
  }

  await waitForPlayCanvas(opts.page, opts.sourceId, opts.baseUrl);
  const sourcePaths = await captureCanvasBurst(opts.page, opts.shotsDir, `source-${opts.sampleId}`);
  await waitForPlayCanvas(opts.page, opts.cloneId, opts.baseUrl);
  const clonePaths = await captureCanvasBurst(opts.page, opts.shotsDir, `clone-${opts.sampleId}`);
  const metrics = await bestCloneVisualMatch(sourcePaths, clonePaths);
  return { metrics, visualOk: passesCanvasParity(metrics, thresholds) };
}
