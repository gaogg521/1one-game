import type { GameSpec } from "@/lib/game-spec";

export type PlatformerMode = "standard" | "stealth";

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

export function buildPlatformerBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
  sampleId?: string;
}): PlatformerBlueprint {
  const mode = inferPlatformerMode(opts);
  const intensity = opts.spec?.director?.intensity ?? 0.62;
  const levelLayers = Math.round(52 + intensity * 22);
  const worldWidth = Math.round(5000 + intensity * 1800);
  const suggestedWinScore = Math.round(levelLayers * 1.05 + (mode === "stealth" ? 10 : 4));

  if (mode === "stealth") {
    return {
      mode,
      doubleJump: true,
      grappleEnabled: true,
      levelLayers,
      worldWidth,
      suggestedWinScore,
    };
  }
  return { mode: "standard", levelLayers, worldWidth, suggestedWinScore };
}
