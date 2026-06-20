import type { GameSpec } from "@/lib/game-spec";
import { makeSeededRng, jitter } from "@/lib/prompt-fingerprint";

/** 水果忍者玩法风格：影响抛出节奏与炸弹密度 */
export type FruitNinjaPlayStyle =
  | "casual"   // 慢节奏，少炸弹，新手友好
  | "classic"  // 经典平衡
  | "frenzy";  // 高密度，多炸弹，硬核

/** 与 FruitNinjaBlueprintSchema 对齐 */
export type FruitNinjaBlueprint = {
  /** 通关目标分数 */
  targetScore: number;
  /** 单局时间限制（毫秒） */
  timeLimitMs: number;
  /** 水果/炸弹抛出间隔（毫秒） */
  spawnIntervalMs: number;
  /** 单次抛出生成炸弹的概率 0..1 */
  bombChance: number;
  /** 玩法风格（仅影响派生参数，不影响 schema 字段集合） */
  playStyle: FruitNinjaPlayStyle;
};

export function inferFruitNinjaPlayStyle(opts: {
  prompt?: string;
  spec?: GameSpec;
}): FruitNinjaPlayStyle {
  const blob = (opts.prompt ?? opts.spec?.title ?? "").toLowerCase();
  if (/疯狂|地狱|frenzy|hardcore|极速|硬核|暴走|挑战/.test(blob)) return "frenzy";
  if (/休闲|放松|简单|casual|easy|relax|新手|kids?|儿童/.test(blob)) return "casual";
  // 按强度兜底：高强度→frenzy，低强度→casual，中等→classic
  const intensity = opts.spec?.director?.intensity ?? 0.55;
  return intensity > 0.72 ? "frenzy" : intensity < 0.42 ? "casual" : "classic";
}

/**
 * 构建水果忍者蓝图。
 * - targetScore 50-100
 * - timeLimitMs 60000-90000
 * - spawnIntervalMs 800-1200
 * - bombChance 0.15-0.25
 * 千人千面：同模板不同 prompt 派生 seed 微调数值（同 prompt 永远出同蓝图）。
 */
export function buildFruitNinjaBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
  sampleId?: string;
}): FruitNinjaBlueprint {
  const playStyle = inferFruitNinjaPlayStyle(opts);
  const intensity = opts.spec?.director?.intensity ?? 0.55;

  // 千人千面：从 samplePlayProfile.seed 派生 seed，微调数值
  const seed = opts.spec?.samplePlayProfile?.seed ?? 0;
  const seedInt = Math.floor(seed * 0x100000000);
  const rng = makeSeededRng(seedInt || 1);

  // 玩法风格影响基线
  const baseTarget = playStyle === "frenzy" ? 90 : playStyle === "casual" ? 60 : 75;
  const baseTime = playStyle === "frenzy" ? 70000 : playStyle === "casual" ? 85000 : 78000;
  const baseInterval = playStyle === "frenzy" ? 880 : playStyle === "casual" ? 1150 : 1000;
  const baseBomb = playStyle === "frenzy" ? 0.24 : playStyle === "casual" ? 0.16 : 0.20;

  // spec.fruitNinja 优先（若 enrich 已写入），否则用派生值
  const rawFn = opts.spec?.fruitNinja;
  const rawTarget = typeof rawFn?.targetScore === "number" ? rawFn.targetScore : 0;
  const rawTime = typeof rawFn?.timeLimitMs === "number" ? rawFn.timeLimitMs : 0;
  const rawInterval = typeof rawFn?.spawnIntervalMs === "number" ? rawFn.spawnIntervalMs : 0;
  const rawBomb = typeof rawFn?.bombChance === "number" ? rawFn.bombChance : -1;

  // intensity 微调：高强度→目标分↑、间隔↓、炸弹↑
  const targetFromStyle = baseTarget + Math.round(intensity * 12);
  const intervalFromStyle = Math.round(baseInterval - intensity * 80);
  const bombFromStyle = baseBomb + intensity * 0.04;

  // seed 驱动 ±6% 微调（同 prompt 永远出同蓝图；不同 prompt 出不同蓝图）
  const targetScore = rawTarget > 0
    ? rawTarget
    : Math.round(jitter(rng, targetFromStyle, 50, 100, 0.06));
  const timeLimitMs = rawTime > 0
    ? rawTime
    : Math.round(jitter(rng, baseTime, 60000, 90000, 0.05));
  const spawnIntervalMs = rawInterval > 0
    ? rawInterval
    : Math.round(jitter(rng, intervalFromStyle, 800, 1200, 0.06));
  const bombChance = rawBomb >= 0
    ? rawBomb
    : Math.min(0.25, Math.max(0.15, jitter(rng, bombFromStyle, 0.15, 0.25, 0.05)));

  return {
    targetScore,
    timeLimitMs,
    spawnIntervalMs,
    bombChance,
    playStyle,
  };
}
