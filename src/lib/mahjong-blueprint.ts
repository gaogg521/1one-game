import type { GameSpec } from "@/lib/game-spec";

/** 麻将规则变体 */
export type MahjongVariant = "sichuan" | "national" | "japanese";

/** 与 GameSpec.mahjong（MahjongBlueprintSchema）对齐的运行时蓝图类型 */
export type MahjongBlueprint = {
  variant: MahjongVariant;
  startingPoints: number;
  aiDifficulty: number;
  rounds: number;
  enableDora?: boolean;
};

/**
 * 从 prompt 关键词推断规则变体：
 * - 四川 / 血战 → sichuan
 * - 日本 / riichi → japanese
 * - 国标 / 默认 → national
 */
export function inferMahjongVariant(opts: {
  prompt?: string;
  spec?: GameSpec;
}): MahjongVariant {
  const tid = opts.spec?.templateId;
  if (tid === "sichuan" || tid === "mahjong-sichuan") return "sichuan";
  if (tid === "japanese" || tid === "mahjong-riichi") return "japanese";
  const blob = (opts.prompt ?? opts.spec?.title ?? opts.spec?.labels?.subtitle ?? "").toLowerCase();
  if (/四川|血战|血战到底|sichuan|blood battle|blood-mode/.test(blob)) return "sichuan";
  if (/日本|立直|riichi|japanese|日麻/.test(blob)) return "japanese";
  return "national";
}

/**
 * 由 spec + prompt 构造运行时麻将蓝图。
 * - variant 默认 national，关键词覆盖
 * - startingPoints 默认 500（schema 范围 250..1000）
 * - aiDifficulty 默认按 director.intensity 映射到 0.4..0.7
 * - rounds 默认 4（schema 范围 1..8）
 * - enableDora 仅 japanese 变体为 true
 */
export function buildMahjongBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
}): MahjongBlueprint {
  const variant = inferMahjongVariant(opts);
  const spec = opts.spec;
  const existing = spec?.mahjong;

  const intensity = spec?.director?.intensity ?? 0.6;
  // 把 0..1 强度映射到 0.4..0.7 的 AI 难度区间（保证 AI 不过分强也不过分弱）
  const intensityClamped = Math.max(0, Math.min(1, intensity));
  const defaultAi = Math.round((0.4 + intensityClamped * 0.3) * 100) / 100;

  const startingPoints = existing?.startingPoints ?? 500;
  const aiDifficulty = existing?.aiDifficulty ?? defaultAi;
  const rounds = existing?.rounds ?? 4;

  const enableDora =
    existing?.enableDora ?? (variant === "japanese" ? true : false);

  return {
    variant,
    startingPoints,
    aiDifficulty,
    rounds,
    enableDora,
  };
}
