import type { SampleGameplayCase } from "@/lib/qa/sample-gameplay-interaction";
import { SAMPLES } from "@/lib/samples";

export type GameplayDepthChange = "increased" | "decreased" | "changed";

export type GameplayDepthExpect = {
  field: string;
  change: GameplayDepthChange;
  minDelta?: number;
};

/** 14 款样品 — 玩法深度须可观测变化（不能只靠像素 diff） */
export const GAMEPLAY_DEPTH_BY_SAMPLE: Record<string, GameplayDepthExpect> = {
  "number-merge-2048": { field: "puzzleMoves", change: "increased", minDelta: 1 },
  "classic-xiangqi-board": { field: "moves", change: "increased", minDelta: 1 },
  "classic-international-chess": { field: "moves", change: "increased", minDelta: 1 },
  "zen-go-board": { field: "moves", change: "increased", minDelta: 1 },
  "jungle-animal-chess": { field: "moves", change: "increased", minDelta: 1 },
  "temple-relic-runner": { field: "coasterDistance", change: "increased", minDelta: 1 },
  "smash-the-dummy": { field: "hits", change: "increased", minDelta: 1 },
  "grow-a-garden": { field: "plantedTiles", change: "increased", minDelta: 1 },
  "color-bloom": { field: "puzzleMoves", change: "increased", minDelta: 1 },
  "gun-merge-3d-zombie-apocalypse": { field: "qaTouches", change: "increased", minDelta: 1 },
  "elastic-thief-2": { field: "playerX", change: "changed", minDelta: 1 },
  "blade-defender-merge": { field: "qaTouches", change: "increased", minDelta: 1 },
  "pottery-master-3d": { field: "potteryHeight", change: "increased", minDelta: 1 },
  "crashy-roads": { field: "coasterDistance", change: "increased", minDelta: 1 },
};

export function gameplayDepthForCase(c: SampleGameplayCase): GameplayDepthExpect | undefined {
  return GAMEPLAY_DEPTH_BY_SAMPLE[c.sampleId];
}

export function validateGameplayDepthOffline(): string[] {
  const failures: string[] = [];
  const sampleIds = new Set(SAMPLES.map((s) => s.id));
  for (const id of sampleIds) {
    if (!GAMEPLAY_DEPTH_BY_SAMPLE[id]) failures.push(`missing depth expect: ${id}`);
  }
  for (const [id, exp] of Object.entries(GAMEPLAY_DEPTH_BY_SAMPLE)) {
    if (!sampleIds.has(id)) failures.push(`orphan depth expect: ${id}`);
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
  const a = after != null && Number.isFinite(after) ? after : undefined;
  if (a == null) return false;
  const b = before != null && Number.isFinite(before) ? before : 0;
  const delta = a - b;
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
