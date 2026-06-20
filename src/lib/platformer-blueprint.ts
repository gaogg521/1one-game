import type { GameSpec } from "@/lib/game-spec";
import { makeSeededRng, jitter } from "@/lib/prompt-fingerprint";

export type PlatformerMode = "standard" | "stealth";

/** 关卡生成风格 */
export type PlatformerLevelStyle =
  | "explore"   // 宽平台多路径，探索感强
  | "challenge" // 密集障碍精准跳跃
  | "speedrun"; // 直线紧凑，追求速通

export type PlatformerBlueprint = {
  mode: PlatformerMode;
  /** stealth：空中二段跳 */
  doubleJump?: boolean;
  /** stealth：Shift 弹性摆荡 */
  grappleEnabled?: boolean;
  /**  procedurally 生成的平台层数 */
  levelLayers: number;
  /** 横版世界宽度（像素） */
  worldWidth: number;
  /** 与关卡 gem 密度对齐的 winScore 建议值 */
  suggestedWinScore: number;
  /** 关卡风格（影响平台宽度、间距、障碍密度） */
  levelStyle: PlatformerLevelStyle;
};

export function inferPlatformerMode(opts: {
  prompt?: string;
  spec?: GameSpec;
  sampleId?: string;
}): PlatformerMode {
  if (opts.sampleId === "elastic-thief-2") return "stealth";
  const tid = opts.spec?.templateId;
  if (tid === "stealth") return "stealth";
  const blob = (opts.prompt ?? opts.spec?.title ?? "").toLowerCase();
  if (/潜行|elastic thief|偷取|守卫.*激光|摆荡|grapple|swing steal|伸缩/i.test(blob)) return "stealth";
  return "standard";
}

export function inferPlatformerLevelStyle(opts: {
  prompt?: string;
  spec?: GameSpec;
}): PlatformerLevelStyle {
  const blob = (opts.prompt ?? opts.spec?.title ?? "").toLowerCase();
  if (/速跑|速通|speedrun|speed run|跑酷|最快|限时|time[\s-]?trial|dash/.test(blob)) return "speedrun";
  if (/挑战|困难|精准|地狱|hardcore|hard|challenge|precision|高难/.test(blob)) return "challenge";
  if (/探索|冒险|开放|收集|open[\s-]?world|adventure|explore|discovery/.test(blob)) return "explore";
  // 按强度兜底：高强度→challenge，低强度→explore，中等→challenge
  const intensity = opts.spec?.director?.intensity ?? 0.62;
  return intensity > 0.72 ? "challenge" : intensity < 0.45 ? "explore" : "challenge";
}

export function buildPlatformerBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
  sampleId?: string;
}): PlatformerBlueprint {
  const mode = inferPlatformerMode(opts);
  const levelStyle = inferPlatformerLevelStyle(opts);
  const intensity = opts.spec?.director?.intensity ?? 0.62;

  // 千人千面：从 prompt 派生 seed，微调关卡规模与密度（同模板不同 prompt 出不同关卡）
  const seed = opts.spec?.samplePlayProfile?.seed ?? 0;
  const seedInt = Math.floor(seed * 0x100000000);
  const rng = makeSeededRng(seedInt || 1);

  // 关卡风格影响世界宽度与层数
  const baseLayers = levelStyle === "speedrun" ? 38 : levelStyle === "explore" ? 60 : 52;
  const baseWidth = levelStyle === "speedrun" ? 4200 : levelStyle === "explore" ? 6400 : 5000;
  const rawWinScore = opts.spec?.gameplay?.winScore ?? 0;
  // 高目标分时自动放大关卡（每超出基线 10 分额外增 4 层）
  const winScoreBonus = Math.max(0, Math.floor((rawWinScore - 50) / 10)) * 4;
  // seed 驱动 ±8% 层数与宽度微调（同 prompt 永远出同关卡；不同 prompt 出不同关卡）
  const levelLayers = Math.round(jitter(rng, baseLayers + intensity * 22 + winScoreBonus, 30, 90, 0.08));
  const worldWidth = Math.round(jitter(rng, baseWidth + intensity * 1800 + winScoreBonus * 80, 3000, 9000, 0.08));
  const suggestedWinScore = Math.round(levelLayers * 1.05 + (mode === "stealth" ? 10 : 4));

  if (mode === "stealth") {
    return {
      mode,
      doubleJump: true,
      grappleEnabled: true,
      levelLayers,
      worldWidth,
      suggestedWinScore,
      levelStyle,
    };
  }
  return { mode: "standard", levelLayers, worldWidth, suggestedWinScore, levelStyle };
}
