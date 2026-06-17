import fs from "node:fs";
import sharp from "sharp";

export type CanvasParityMetrics = {
  colorDist: number;
  diffRatio: number;
  width: number;
  height: number;
};

export type CanvasParityThresholds = {
  maxColorDist: number;
  maxDiffRatio: number;
};

/** 全局对标阈值（不按样品分档 — Astrocade 平台级 parity） */
export const GLOBAL_CANVAS_PARITY: CanvasParityThresholds = {
  maxColorDist: 40,
  maxDiffRatio: 0.18,
};

/** 克隆对标默认阈值（较 GLOBAL 更严） */
export const GLOBAL_CLONE_PARITY: CanvasParityThresholds = {
  maxColorDist: 32,
  maxDiffRatio: 0.08,
};

/** 旗舰样品：人眼敏感款，进一步收紧 */
export const STRICT_CLONE_PARITY: CanvasParityThresholds = {
  maxColorDist: 28,
  maxDiffRatio: 0.05,
};

export const STRICT_VISUAL_SAMPLE_IDS = new Set([
  "grow-a-garden",
  "color-bloom",
  "elastic-thief-2",
  "crashy-roads",
]);

/** orbitChopper 克隆对标：同 spec 双开页 orbit 相位略有偏差 */
const ORBIT_CHOPPER_CLONE_PARITY: CanvasParityThresholds = {
  maxColorDist: 48,
  maxDiffRatio: 0.1,
};

export async function avgRgb(buf: Buffer): Promise<[number, number, number]> {
  const { data, info } = await sharp(buf).resize(64, 64, { fit: "cover" }).raw().toBuffer({ resolveWithObject: true });
  let r = 0;
  let g = 0;
  let b = 0;
  const n = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

export function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export async function compareCanvasImages(
  pathA: string,
  pathB: string,
  size = 128,
): Promise<CanvasParityMetrics> {
  if (!fs.existsSync(pathA) || !fs.existsSync(pathB)) {
    throw new Error(`missing screenshot: ${pathA} or ${pathB}`);
  }
  const rawA = await sharp(pathA).resize(size, size, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const rawB = await sharp(pathB).resize(size, size, { fit: "fill" }).removeAlpha().raw().toBuffer();
  let diffPixels = 0;
  const total = size * size;
  for (let p = 0; p < total; p += 1) {
    const i = p * 3;
    const dr = Math.abs(rawA[i]! - rawB[i]!);
    const dg = Math.abs(rawA[i + 1]! - rawB[i + 1]!);
    const db = Math.abs(rawA[i + 2]! - rawB[i + 2]!);
    if (dr + dg + db > 48) diffPixels += 1;
  }
  const rgbA = await avgRgb(await sharp(pathA).toBuffer());
  const rgbB = await avgRgb(await sharp(pathB).toBuffer());
  return {
    colorDist: colorDist(rgbA, rgbB),
    diffRatio: diffPixels / total,
    width: size,
    height: size,
  };
}

export function passesCanvasParity(metrics: CanvasParityMetrics, thresholds: CanvasParityThresholds): boolean {
  return metrics.colorDist <= thresholds.maxColorDist && metrics.diffRatio <= thresholds.maxDiffRatio;
}

export function visualThresholdsForSample(_sampleId: string): CanvasParityThresholds {
  return GLOBAL_CANVAS_PARITY;
}

export function cloneVisualThresholdsForSample(sampleId: string): CanvasParityThresholds {
  if (sampleId === "tiny-planet-chopper") return ORBIT_CHOPPER_CLONE_PARITY;
  return STRICT_VISUAL_SAMPLE_IDS.has(sampleId) ? STRICT_CLONE_PARITY : GLOBAL_CLONE_PARITY;
}
