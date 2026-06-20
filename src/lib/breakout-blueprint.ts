import type { GameSpec } from "@/lib/game-spec";
import { makeSeededRng, jitter } from "@/lib/prompt-fingerprint";

/**
 * Breakout（真打砖块）蓝图。
 *
 * 与 platformer-blueprint 同款思路：
 * - 从 spec.director.intensity + samplePlayProfile.seed 派生确定性参数
 * - 同 prompt 出同蓝图；不同 prompt 出不同蓝图
 * - 字段范围都有 clamp，引擎侧可直接信任
 */
export type BreakoutBlueprint = {
  /** 砖块行数（3-8） */
  brickRows: number;
  /** 砖块列数（6-12） */
  brickCols: number;
  /** 弹球初速度（像素/秒，200-500） */
  ballSpeed: number;
  /** 挡板宽度（像素，60-150） */
  paddleWidth: number;
  /** 砖块总数 = brickRows * brickCols（引擎可直接信任） */
  targetBricks: number;
};

/**
 * 从 prompt / spec 推断蓝图。无 spec 时给一组合理默认值。
 *
 * 强度影响：
 * - 高强度 → 更多行/列、更快球速、更窄挡板
 * - 低强度 → 更少砖块、慢球、宽挡板
 */
export function buildBreakoutBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
  sampleId?: string;
}): BreakoutBlueprint {
  const intensity = opts.spec?.director?.intensity ?? 0.55;

  // 千人千面：从 samplePlayProfile.seed 派生 RNG（同 prompt 永远出同蓝图）
  const seed = opts.spec?.samplePlayProfile?.seed ?? 0;
  const seedInt = Math.floor(seed * 0x100000000);
  const rng = makeSeededRng(seedInt || 1);

  // 基线随强度漂移
  const baseRows = 4 + Math.round(intensity * 2.4); // 4..7
  const baseCols = 8 + Math.round(intensity * 2.4); // 8..11
  const baseBall = 260 + intensity * 180;            // 260..440
  const basePaddle = 120 - intensity * 40;           // 120..80

  // seed 驱动 ±8% 微调
  const brickRows = Math.round(jitter(rng, baseRows, 3, 8, 0.08));
  const brickCols = Math.round(jitter(rng, baseCols, 6, 12, 0.08));
  const ballSpeed = Math.round(jitter(rng, baseBall, 200, 500, 0.08));
  const paddleWidth = Math.round(jitter(rng, basePaddle, 60, 150, 0.08));

  return {
    brickRows,
    brickCols,
    ballSpeed,
    paddleWidth,
    targetBricks: brickRows * brickCols,
  };
}
