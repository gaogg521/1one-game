import type { GameSpec } from "@/lib/game-spec";

/**
 * 斗地主蓝图（独立 family `douDizhu`）。
 *
 * 3 人对局：玩家 + 2 AI；54 张扑克（含大小王）。每人 17 张 + 3 张底牌。
 * - 叫地主：玩家可叫 1-3 分，最高分者得地主 + 拿 3 张底牌
 * - 出牌：地主先出，按顺时针；下家必须出更大牌型或 pass
 * - 牌型：单张 / 对子 / 三张 / 三带一 / 顺子 / 连对 / 飞机 / 炸弹 / 王炸
 * - 胜负：地主出完 → 地主胜；任一农民出完 → 农民胜
 */
export type DouDizhuBlueprint = {
  /** 叫地主起始底分（1-3）。玩家可选不叫；最高分者得地主。 */
  startingBid: 1 | 2 | 3;
  /** AI 难度（0.3 易 ~ 1.0 大师）：影响 AI 是否抢叫、是否优先出大牌、是否拆牌。 */
  aiDifficulty: number;
  /** 每人初始手牌数（标准斗地主为 17）。 */
  playerHandSize: number;
  /** 底牌张数（标准斗地主为 3，由地主收走）。 */
  bottomCards: number;
};

/**
 * 由 spec 派生斗地主蓝图。LLM 可直接输出 `douDizhu` 字段；缺省时按强度 / 标题兜底。
 *
 * 不依赖 spec.douDizhu（该字段尚未在 GameSchema 中声明，避免破坏现有 schema）；
 * 从 spec.gameplay.intensity / samplePlayProfile / 标题等元信息推断。
 */
export function buildDouDizhuBlueprint(opts: {
  spec?: GameSpec;
  prompt?: string;
  sampleId?: string;
}): DouDizhuBlueprint {
  const spec = opts.spec;
  const intensity = spec?.director?.intensity ?? 0.6;

  // 起始底分：高强度 → 更激进（3 分起叫）；低强度 → 1 分起叫
  let startingBid: 1 | 2 | 3 = 2;
  if (intensity >= 0.75) startingBid = 3;
  else if (intensity < 0.4) startingBid = 1;

  // AI 难度：与强度联动，clamp 0.3-1.0
  const aiDifficulty = Math.max(0.3, Math.min(1.0, intensity));

  // 允许 sampleId / prompt 微调难度
  const blob = (opts.prompt ?? spec?.title ?? "").toLowerCase();
  if (/大师|expert|hardcore|地狱|legend/.test(blob)) {
    return { startingBid: 3, aiDifficulty: 1.0, playerHandSize: 17, bottomCards: 3 };
  }
  if (/新手|入门|easy|简单|休闲/.test(blob)) {
    return { startingBid: 1, aiDifficulty: 0.35, playerHandSize: 17, bottomCards: 3 };
  }

  return {
    startingBid,
    aiDifficulty,
    playerHandSize: 17,
    bottomCards: 3,
  };
}
