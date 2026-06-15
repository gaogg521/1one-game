import type { SampleGameplayCase } from "@/lib/qa/sample-gameplay-interaction";

export type GameplayDepthChange = "increased" | "decreased" | "changed";

export type GameplayDepthExpect = {
  field: string;
  change: GameplayDepthChange;
  minDelta?: number;
};

/** 旗舰样品：玩法深度须可观测变化，不能只靠像素 diff */
export const GAMEPLAY_DEPTH_BY_SAMPLE: Record<string, GameplayDepthExpect> = {
  "grow-a-garden": { field: "plantedTiles", change: "increased", minDelta: 1 },
  "color-bloom": { field: "puzzleMoves", change: "increased", minDelta: 1 },
  "whimsy-differences": { field: "foundDiff", change: "increased", minDelta: 1 },
  "memory-match-mania": { field: "flippedCards", change: "increased", minDelta: 1 },
  "crashy-roads": { field: "coasterDistance", change: "increased", minDelta: 1 },
};

export function gameplayDepthForCase(c: SampleGameplayCase): GameplayDepthExpect | undefined {
  return GAMEPLAY_DEPTH_BY_SAMPLE[c.sampleId];
}

export function validateGameplayDepthOffline(): string[] {
  const failures: string[] = [];
  for (const [id, exp] of Object.entries(GAMEPLAY_DEPTH_BY_SAMPLE)) {
    if (!exp.field.trim()) failures.push(`${id}: empty depth field`);
    if (exp.minDelta != null && exp.minDelta < 1) failures.push(`${id}: minDelta must be >= 1`);
  }
  return failures;
}

export function depthChangePasses(
  before: number | undefined,
  after: number | undefined,
  expect: GameplayDepthExpect,
): boolean {
  if (before == null || after == null || !Number.isFinite(before) || !Number.isFinite(after)) return false;
  const delta = after - before;
  const min = expect.minDelta ?? 1;
  switch (expect.change) {
    case "increased":
      return delta >= min;
    case "decreased":
      return -delta >= min;
    case "changed":
      return Math.abs(delta) >= min;
    default:
      return false;
  }
}
