import type { GameSpec } from "@/lib/game-spec";
import { makeSeededRng, jitter } from "@/lib/prompt-fingerprint";

/** 麻将接龙（配对消除）难度倾向 */
export type MahjongSolitaireDifficulty = "casual" | "classic" | "master";

/** 与运行时配对消除引擎对齐的蓝图类型 */
export type MahjongSolitaireBlueprint = {
  difficulty: MahjongSolitaireDifficulty;
  /** 网格列数（8..16） */
  gridCols: number;
  /** 网格行数（4..8） */
  gridRows: number;
  /** 牌面种类数（10..30，对应花色 × 数字的组合数量） */
  tileVariety: number;
  /** 通关所需配对数（10..40；总牌数 = targetPairs × 2，需为偶数） */
  targetPairs: number;
  /** 时间限制（毫秒，60000..300000） */
  timeLimitMs: number;
  /** 层叠层数（1=单层 / 2=双层；部分上层牌被锁住直到下层消除） */
  stackLayers: number;
};

/**
 * 从 prompt 关键词推断难度：
 * - 大师 / 地狱 / expert → master
 * - 经典 / 标准 / classic → classic
 * - 休闲 / 简单 / casual → casual
 */
export function inferMahjongSolitaireDifficulty(opts: {
  prompt?: string;
  spec?: GameSpec;
}): MahjongSolitaireDifficulty {
  const tid = opts.spec?.templateId;
  if (tid === "mahjong-solitaire-master") return "master";
  if (tid === "mahjong-solitaire-casual") return "casual";
  const blob = (opts.prompt ?? opts.spec?.title ?? opts.spec?.labels?.subtitle ?? "").toLowerCase();
  if (/大师|地狱|expert|hardcore|挑战|极限/.test(blob)) return "master";
  if (/休闲|简单|轻松|casual|easy|relax/.test(blob)) return "casual";
  return "classic";
}

/**
 * 由 spec + prompt 构造麻将接龙运行时蓝图。
 *
 * 千人千面：从 spec.samplePlayProfile.seed 派生确定性 RNG，
 * 同 prompt 永远出同关卡；不同 prompt 出不同关卡。
 *
 * - 难度驱动 baseGridCols / baseGridRows / baseTileVariety / baseTargetPairs / baseTimeMs
 * - intensity 二次微调 ±8% 抖动
 * - 最终所有数值 clamp 到 schema 范围内
 */
export function buildMahjongSolitaireBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
  sampleId?: string;
}): MahjongSolitaireBlueprint {
  const difficulty = inferMahjongSolitaireDifficulty(opts);
  const spec = opts.spec;
  const intensity = spec?.director?.intensity ?? 0.6;
  const intensityClamped = Math.max(0, Math.min(1, intensity));

  // seed 派生确定性 RNG（同 prompt → 同关卡；不同 prompt → 不同关卡）
  const seed = spec?.samplePlayProfile?.seed ?? 0;
  const seedInt = Math.floor(seed * 0x100000000);
  const rng = makeSeededRng(seedInt || 1);

  // 难度基线
  const baseCols = difficulty === "master" ? 14 : difficulty === "casual" ? 10 : 12;
  const baseRows = difficulty === "master" ? 7 : difficulty === "casual" ? 5 : 6;
  const baseVariety = difficulty === "master" ? 24 : difficulty === "casual" ? 14 : 18;
  const basePairs = difficulty === "master" ? 32 : difficulty === "casual" ? 18 : 24;
  const baseTimeMs = difficulty === "master" ? 120000 : difficulty === "casual" ? 240000 : 180000;

  // intensity 影响：高强度 → 更多对数 / 更少时间 / 更多牌种
  const intensityPairs = Math.round(intensityClamped * 6);
  const intensityTime = Math.round(-intensityClamped * 20000);

  // seed 驱动 ±8% 抖动
  const gridCols = Math.round(jitter(rng, baseCols, 8, 16, 0.08));
  const gridRows = Math.round(jitter(rng, baseRows, 4, 8, 0.08));
  const tileVariety = Math.round(jitter(rng, baseVariety, 10, 30, 0.08));
  const targetPairs = Math.round(jitter(rng, basePairs + intensityPairs, 10, 40, 0.08));
  const timeLimitMs = Math.round(jitter(rng, baseTimeMs + intensityTime, 60000, 300000, 0.06));

  // 层叠：master 偏双层、casual 偏单层
  const stackRoll = rng();
  const stackLayers = difficulty === "master"
    ? (stackRoll < 0.7 ? 2 : 1)
    : difficulty === "casual"
      ? (stackRoll < 0.2 ? 2 : 1)
      : (stackRoll < 0.45 ? 2 : 1);

  return {
    difficulty,
    gridCols,
    gridRows,
    tileVariety,
    targetPairs,
    timeLimitMs,
    stackLayers,
  };
}
