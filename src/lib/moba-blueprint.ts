import type { GameSpec } from "@/lib/game-spec";

/** MOBA 1v1 战斗蓝图：与 GameSpec 中 MobaBlueprintSchema 对齐 */
export type MobaBlueprint = {
  /** 需要推掉敌方塔的数量（=敌方塔总数） */
  towersToWin: number;
  /** 玩家英雄最大血量 */
  playerHp: number;
  /** AI 英雄难度（0..1），影响走位与普攻节奏 */
  aiDifficulty: number;
  /** 玩家可用技能槽位数（Q/W/E） */
  abilities: number;
};

/** 从 spec/prompt 推断 AI 难度，确保落在 0.4..0.7 之间 */
function inferAiDifficulty(opts: { prompt?: string; spec?: GameSpec }): number {
  const intensity = opts.spec?.director?.intensity ?? 0.55;
  // 基线 0.5，按 intensity 在 0.4..0.7 之间线性映射
  const base = 0.4 + Math.max(0, Math.min(1, intensity)) * 0.3;
  const blob = (opts.prompt ?? opts.spec?.title ?? "").toLowerCase();
  if (/简单|easy|新手|beginner|casual/i.test(blob)) return 0.4;
  if (/困难|地狱|hardcore|hard|expert|pro/i.test(blob)) return 0.7;
  return Math.round(base * 100) / 100;
}

/**
 * 构建 MOBA 1v1 战斗蓝图。
 *
 * 默认：towersToWin=2，playerHp=200，aiDifficulty=0.4..0.7，abilities=3。
 * 若 spec.moba 已被 enrich 阶段写入，则按 schema 约束直接采用其字段。
 */
export function buildMobaBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
}): MobaBlueprint {
  const fromSpec = opts.spec?.moba;
  const clampInt = (v: unknown, lo: number, hi: number, dft: number) => {
    const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : dft;
    return Math.max(lo, Math.min(hi, n));
  };
  const clampFloat = (v: unknown, lo: number, hi: number, dft: number) => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : dft;
    return Math.max(lo, Math.min(hi, n));
  };

  return {
    towersToWin: clampInt(fromSpec?.towersToWin, 1, 3, 2),
    playerHp: clampInt(fromSpec?.playerHp, 80, 500, 200),
    aiDifficulty: clampFloat(fromSpec?.aiDifficulty, 0, 1, inferAiDifficulty(opts)),
    abilities: clampInt(fromSpec?.abilities, 2, 5, 3),
  };
}
