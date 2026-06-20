import type { GameSpec } from "@/lib/game-spec";

/** 体育运动类型（与 SportsBlueprintSchema.sport 对齐） */
export type SportKind = "basketball" | "football" | "tennis" | "golf" | "bowling";

/**
 * 体育运动蓝图：与 `SportsBlueprintSchema` 对齐。
 * - sport：篮球/足球/网球/高尔夫/保龄球
 * - targetScore：通关所需得分（10-30）
 * - timeLimitMs：单局限时（60s-90s）
 * - aiDifficulty：AI 对手/守门员强度 0..1
 * - gravity：抛物线重力（默认 9.8）
 * - ballSpeed：球抛出初速参考（8-12）
 */
export type SportsBlueprint = {
  sport: SportKind;
  targetScore: number;
  timeLimitMs: number;
  aiDifficulty: number;
  gravity?: number;
  ballSpeed?: number;
};

/** 从 prompt / spec 推断运动类型 */
export function inferSportKind(opts: {
  prompt?: string;
  spec?: GameSpec;
}): SportKind {
  const tid = opts.spec?.templateId?.toLowerCase() ?? "";
  if (tid === "basketball" || tid === "sports-basketball") return "basketball";
  if (tid === "football" || tid === "soccer") return "football";
  if (tid === "tennis") return "tennis";
  if (tid === "golf") return "golf";
  if (tid === "bowling") return "bowling";

  const blob = `${opts.prompt ?? ""} ${opts.spec?.title ?? ""} ${opts.spec?.labels?.subtitle ?? ""}`.toLowerCase();
  if (/篮球|basketball|投篮|hoop|扣篮|slam dunk|三分|three.?point/.test(blob)) return "basketball";
  if (/足球|football|soccer|射门|goal.?kick|点球|penalty|守门|goalkeeper/.test(blob)) return "football";
  if (/网球|tennis|挥拍|serve|volley|ace 球/.test(blob)) return "tennis";
  if (/高尔夫|golf|挥杆|putt|tee|birdie|par /.test(blob)) return "golf";
  if (/保龄球|bowling|strike|spare|球瓶|pin ?down/.test(blob)) return "bowling";

  // 兜底：默认篮球（最经典的抛物线投篮）
  return "basketball";
}

/**
 * 构建 sports 蓝图：
 * - sport 从 prompt/spec 推断
 * - targetScore 10-30（intensity 越高越偏上限）
 * - timeLimitMs 60000-90000（intensity 越高越紧）
 * - aiDifficulty 0.3-0.7（随 intensity 上升）
 * - gravity 9.8
 * - ballSpeed 8-12（随 intensity 上升）
 */
export function buildSportsBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
}): SportsBlueprint {
  const sport = inferSportKind(opts);
  const intensity = opts.spec?.director?.intensity ?? 0.5;
  const clamped = Math.max(0, Math.min(1, intensity));

  const targetScore = Math.round(10 + clamped * 20); // 10..30
  const timeLimitMs = Math.round(90000 - clamped * 30000); // 90s..60s（强度高→时间短）
  const aiDifficulty = Math.round((0.3 + clamped * 0.4) * 100) / 100; // 0.3..0.7
  const gravity = 9.8;
  const ballSpeed = Math.round((8 + clamped * 4) * 10) / 10; // 8.0..12.0

  return {
    sport,
    targetScore,
    timeLimitMs,
    aiDifficulty,
    gravity,
    ballSpeed,
  };
}
