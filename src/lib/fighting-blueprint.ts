import type { GameSpec } from "@/lib/game-spec";

/**
 * 格斗（fighting）蓝图：1v1 横版格斗对战。
 *
 * 与 `FightingBlueprintSchema`（src/lib/game-spec.ts）对齐：
 * - rounds：总局数（默认 3，3 局 2 胜）
 * - playerHp：单局血量上限
 * - aiDifficulty：AI 出招频率与命中率倾向，0..1
 * - moves：可选，玩家可用招式集合（light / heavy / block / special）
 */
export type FightingMove = "light" | "heavy" | "block" | "special";

export type FightingBlueprint = {
  /** 总回合数（3 局 2 胜取 3） */
  rounds: number;
  /** 玩家/AI 单局血量上限 */
  playerHp: number;
  /** AI 难度 0..1：影响出招间隔与命中率 */
  aiDifficulty: number;
  /** 玩家可用招式集合（按键映射：J/K/L/U） */
  moves?: FightingMove[];
};

/** 默认招式集合：J=轻拳 / K=重拳 / L=格挡 / U=特殊技 */
export const DEFAULT_FIGHTING_MOVES: FightingMove[] = ["light", "heavy", "block", "special"];

/**
 * 从 spec / prompt 推断 AI 难度。
 *
 * 高强度（director.intensity）映射到更激进的 AI；prompt 里的关键词可微调。
 */
export function inferFightingAiDifficulty(opts: {
  prompt?: string;
  spec?: GameSpec;
}): number {
  const blob = (opts.prompt ?? opts.spec?.title ?? "").toLowerCase();
  const intensity = opts.spec?.director?.intensity ?? 0.55;
  // 基线：intensity * 0.7 + 0.05，落在 0.05..0.75
  let diff = 0.05 + intensity * 0.7;
  if (/简单|休闲|easy|casual|新手/i.test(blob)) diff = Math.min(diff, 0.32);
  if (/困难|地狱|hard|hardcore|挑战|expert/i.test(blob)) diff = Math.max(diff, 0.72);
  if (/大师|master|宗师|极限|nightmare/i.test(blob)) diff = Math.max(diff, 0.85);
  // 钳到 0.4..0.7（任务约束：默认范围）
  return Math.max(0.4, Math.min(0.7, diff));
}

/**
 * 构建格斗蓝图。供 FightingScene（Phaser）与 fighting_runtime.gd（Godot）共同消费。
 *
 * 默认值：rounds=3、playerHp=100、aiDifficulty∈[0.4, 0.7]、moves=DEFAULT_FIGHTING_MOVES。
 */
export function buildFightingBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
}): FightingBlueprint {
  const specBp = opts.spec?.fighting;
  const rounds = specBp?.rounds ?? 3;
  const playerHp = specBp?.playerHp ?? 100;
  const aiDifficulty = specBp?.aiDifficulty ?? inferFightingAiDifficulty(opts);
  const moves = specBp?.moves ?? DEFAULT_FIGHTING_MOVES;
  return { rounds, playerHp, aiDifficulty, moves };
}
