import sharp from "sharp";

/** 比较两张 canvas 截图的像素差异比例（0–1） */
export async function bufferDiffRatio(a: Buffer, b: Buffer, size = 96): Promise<number> {
  const rawA = await sharp(a).resize(size, size, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const rawB = await sharp(b).resize(size, size, { fit: "fill" }).removeAlpha().raw().toBuffer();
  let diffPixels = 0;
  const total = size * size;
  for (let p = 0; p < total; p += 1) {
    const i = p * 3;
    const dr = Math.abs(rawA[i]! - rawB[i]!);
    const dg = Math.abs(rawA[i + 1]! - rawB[i + 1]!);
    const db = Math.abs(rawA[i + 2]! - rawB[i + 2]!);
    if (dr + dg + db > 48) diffPixels += 1;
  }
  return diffPixels / total;
}

/** 持续动画场景：取多帧 idle diff 的上界，交互后 diff 须明显高于 idle */
export async function idleDiffCeiling(frames: Buffer[], size = 96): Promise<number> {
  let max = 0;
  for (let i = 1; i < frames.length; i += 1) {
    const d = await bufferDiffRatio(frames[i - 1]!, frames[i]!, size);
    if (d > max) max = d;
  }
  return max;
}

export function interactionDiffPasses(opts: {
  animated: boolean;
  idleCeiling: number;
  interactionDiff: number;
  staticMinDiff?: number;
}): boolean {
  const staticMin = opts.staticMinDiff ?? 0.012;
  if (opts.animated) {
    if (opts.idleCeiling < 0.008) {
      return opts.interactionDiff >= staticMin;
    }
    return opts.interactionDiff > Math.max(opts.idleCeiling * 1.35 + 0.01, 0.035);
  }
  return opts.interactionDiff >= staticMin;
}
