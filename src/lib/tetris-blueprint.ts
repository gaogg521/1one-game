import type { GameSpec } from "@/lib/game-spec";

/** 与 GameSpec.tetris（TetrisBlueprintSchema）对齐的运行时蓝图类型 */
export type TetrisBlueprint = {
  /** 网格宽（列数） */
  gridWidth: number;
  /** 网格高（行数） */
  gridHeight: number;
  /** 目标消行数（达到即胜利） */
  targetLines: number;
  /** 起始下落速度（毫秒/步） */
  startSpeedMs: number;
  /** 每消 10 行递减的毫秒数（提速步长） */
  speedStepMs: number;
};

/**
 * 由 spec + prompt 构造运行时俄罗斯方块蓝图。
 *
 * - gridWidth 固定 10、gridHeight 固定 20（经典 10×20 井字格）
 * - targetLines：20..40，按 director.intensity 映射（高强度 → 多消行）
 * - startSpeedMs：800..1000，强度高 → 起步更快
 * - speedStepMs：固定 80（每消 10 行 -80ms，即提速一档）
 *
 * 若 spec.tetris 已提供值则优先使用，避免覆盖生成阶段写入的种子化配置。
 */
export function buildTetrisBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
}): TetrisBlueprint {
  const spec = opts.spec;
  const existing = spec?.tetris;
  const intensityRaw = spec?.director?.intensity ?? 0.6;
  const intensity = Math.max(0, Math.min(1, intensityRaw));

  const gridWidth = existing?.gridWidth ?? 10;
  const gridHeight = existing?.gridHeight ?? 20;

  // 目标消行数：强度 0 → 20，强度 1 → 40，线性映射并四舍五入到整数
  const defaultTargetLines = Math.round(20 + intensity * 20);
  const targetLines = existing?.targetLines ?? Math.max(10, Math.min(80, defaultTargetLines));

  // 起始速度：强度高 → 起步快（800ms），强度低 → 起步慢（1000ms）
  const defaultStartSpeedMs = Math.round(1000 - intensity * 200);
  const startSpeedMs = existing?.startSpeedMs ?? defaultStartSpeedMs;

  // 提速步长：每消 10 行减 80ms，schema 允许 20..200，固定 80 经典感
  const speedStepMs = existing?.speedStepMs ?? 80;

  return {
    gridWidth,
    gridHeight,
    targetLines,
    startSpeedMs,
    speedStepMs,
  };
}
