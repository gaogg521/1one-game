import type { GameSpec } from "@/lib/game-spec";

/**
 * 节奏音游蓝图：与 GameSpec.rhythm 字段（RhythmBlueprintSchema）对齐。
 * 由 buildRhythmBlueprint(opts) 从 spec.gameplay / spec.director?.intensity 推断默认值。
 */
export type RhythmBlueprint = {
  /** 节拍 BPM（60-220） */
  bpm: number;
  /** 轨道数（3-6） */
  lanes: number;
  /** 节点密度（0.2-1.0） */
  patternDensity: number;
  /** 命中窗口（毫秒，60-220） */
  hitWindowMs: number;
  /** 总节点数（12-160） */
  totalNotes: number;
  /** 速度倍率（玩家可选难度，0.6-2.0） */
  speedMult?: number;
};

/** 从 prompt 文本推断 BPM：欢快 / 紧张关键词偏快，舒缓偏慢 */
function inferBpm(opts: { prompt?: string; spec?: GameSpec }): number {
  const blob = (opts.prompt ?? opts.spec?.title ?? "").toLowerCase();
  if (/激烈|热血|战斗|boss|fight|combat|intense|hardcore|狂|fast/.test(blob)) return 150;
  if (/舒缓|悠扬|冥想|calm|ambient|chill|slow|冥/.test(blob)) return 95;
  if (/欢快|快乐|跳跃|bouncy|happy|cheerful/.test(blob)) return 132;
  const intensity = opts.spec?.director?.intensity ?? 0.62;
  // intensity 0.2..1.0 → bpm 95..160
  return Math.round(95 + (intensity - 0.2) * (160 - 95));
}

/** 从 intensity 推断 patternDensity（0.5-0.8） */
function inferDensity(opts: { spec?: GameSpec }): number {
  const intensity = opts.spec?.director?.intensity ?? 0.62;
  const d = 0.5 + (intensity - 0.2) * (0.8 - 0.5);
  return Math.max(0.5, Math.min(0.8, d));
}

/** 从 intensity 推断 hitWindowMs（120-160，高强度窗口更紧） */
function inferHitWindow(opts: { spec?: GameSpec }): number {
  const intensity = opts.spec?.director?.intensity ?? 0.62;
  // 高强度 → 窗口更小（160 在 0.2，120 在 1.0）
  return Math.round(160 - (intensity - 0.2) * (160 - 120));
}

/** 从 intensity 推断 totalNotes（30-80） */
function inferTotalNotes(opts: { spec?: GameSpec }): number {
  const intensity = opts.spec?.director?.intensity ?? 0.62;
  return Math.round(30 + (intensity - 0.2) * (80 - 30));
}

export function buildRhythmBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
}): RhythmBlueprint {
  const bp = opts.spec?.rhythm;
  const bpm = bp?.bpm ?? inferBpm(opts);
  const lanes = bp?.lanes ?? 4;
  const patternDensity = bp?.patternDensity ?? inferDensity(opts);
  const hitWindowMs = bp?.hitWindowMs ?? inferHitWindow(opts);
  const totalNotes = bp?.totalNotes ?? inferTotalNotes(opts);
  const speedMult = bp?.speedMult;
  return { bpm, lanes, patternDensity, hitWindowMs, totalNotes, speedMult };
}
