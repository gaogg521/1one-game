import type { GameSpec } from "@/lib/game-spec";

/** 卡牌战斗蓝图：手牌 + 法力 + 牌组 + AI 难度（与 CardBlueprintSchema 对齐） */
export type CardBlueprint = {
  /** 起手手牌数 */
  startingHand: number;
  /** 法力上限 */
  maxMana: number;
  /** 牌组规模 */
  deckSize: number;
  /** AI 决策强度 0..1（越高越倾向于打出可用牌） */
  aiDifficulty: number;
  /** 玩家初始血量 */
  playerHp: number;
};

/** 确定性 0..1 伪随机（与其它 blueprint 风格一致） */
function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * 推断起手手牌数。强难度 / 高强度 → 5；否则 4。
 */
function inferStartingHand(opts: { spec?: GameSpec }): number {
  const intensity = opts.spec?.director?.intensity ?? 0.55;
  const ai = opts.spec?.card?.aiDifficulty ?? 0.5;
  const score = intensity * 0.6 + ai * 0.4;
  return score > 0.6 ? 5 : 4;
}

/**
 * 推断法力上限。高强度 → 10（更长对局），低强度 → 8。
 */
function inferMaxMana(opts: { spec?: GameSpec }): number {
  const intensity = opts.spec?.director?.intensity ?? 0.55;
  if (intensity > 0.72) return 10;
  if (intensity < 0.42) return 8;
  return 9;
}

/**
 * 推断牌组规模。长对局 / 高 winScore → 更大；速通 → 更小。
 */
function inferDeckSize(opts: { spec?: GameSpec }): number {
  const intensity = opts.spec?.director?.intensity ?? 0.55;
  const winScore = opts.spec?.gameplay?.winScore ?? 0;
  const bonus = Math.max(0, Math.floor((winScore - 8) / 4));
  const base = intensity > 0.7 ? 28 : intensity < 0.4 ? 24 : 26;
  return clamp(base + bonus, 16, 40);
}

/**
 * 推断 AI 难度。受 director.intensity 与卡牌关键词影响。
 */
function inferAiDifficulty(opts: { prompt?: string; spec?: GameSpec }): number {
  const blob = (opts.prompt ?? opts.spec?.title ?? "").toLowerCase();
  const intensity = opts.spec?.director?.intensity ?? 0.55;
  let d = clamp(0.35 + intensity * 0.35, 0.3, 0.7);
  if (/简单|easy|休闲|casual|新手|beginner/i.test(blob)) d = Math.min(d, 0.35);
  if (/困难|hard|挑战|地狱|hardcore|expert|master|高难/i.test(blob)) d = Math.max(d, 0.65);
  return clamp(d, 0.3, 0.7);
}

/**
 * 推断玩家初始血量。默认 30；高难度场景略降，长对局略升。
 */
function inferPlayerHp(opts: { spec?: GameSpec }): number {
  const intensity = opts.spec?.director?.intensity ?? 0.55;
  if (intensity > 0.75) return 28;
  if (intensity < 0.4) return 32;
  return 30;
}

/**
 * 由 GameSpec / prompt 推导卡牌战斗蓝图。
 * 默认值：startingHand 4-5 · maxMana 8-10 · deckSize 24-30 · aiDifficulty 0.3-0.7 · playerHp 30。
 */
export function buildCardBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
}): CardBlueprint {
  const seedRaw = opts.spec?.title?.length ?? (opts.prompt?.length ?? 7);
  const seed = (seedRaw * 1000 + 7) | 0;
  const intensity = opts.spec?.director?.intensity ?? 0.55;

  let startingHand = inferStartingHand(opts);
  let maxMana = inferMaxMana(opts);
  let deckSize = inferDeckSize(opts);
  let aiDifficulty = inferAiDifficulty(opts);
  let playerHp = inferPlayerHp(opts);

  // spec 显式值优先（若已由 generate-spec 注入）
  const explicit = opts.spec?.card;
  if (explicit) {
    if (typeof explicit.startingHand === "number") startingHand = clamp(Math.round(explicit.startingHand), 3, 7);
    if (typeof explicit.maxMana === "number") maxMana = clamp(Math.round(explicit.maxMana), 5, 12);
    if (typeof explicit.deckSize === "number") deckSize = clamp(Math.round(explicit.deckSize), 16, 40);
    if (typeof explicit.aiDifficulty === "number") aiDifficulty = clamp(explicit.aiDifficulty, 0, 1);
    if (typeof explicit.playerHp === "number") playerHp = clamp(Math.round(explicit.playerHp), 10, 60);
  }

  // 用种子做 ±1 的微调，避免同强度下完全雷同
  startingHand = clamp(startingHand + (rnd(seed, 1) > 0.7 ? 1 : 0), 3, 7);
  maxMana = clamp(maxMana + (rnd(seed, 2) > 0.6 ? 1 : 0) - (rnd(seed, 3) > 0.8 ? 1 : 0), 5, 12);
  deckSize = clamp(deckSize + Math.round(rnd(seed, 4) * 2) - 1, 16, 40);
  // 难度由强度主导，种子只做毫秒级抖动
  aiDifficulty = clamp(aiDifficulty + (rnd(seed, 5) - 0.5) * 0.06, 0.3, 0.7);

  // 低强度场景顺手保证至少 3 分钟对局：deckSize 不至于太小
  if (intensity < 0.4 && deckSize < 22) deckSize = 22;

  return {
    startingHand,
    maxMana,
    deckSize,
    aiDifficulty,
    playerHp,
  };
}
