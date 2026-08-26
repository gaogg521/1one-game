import type { SampleGameplayCase } from "@/lib/qa/sample-gameplay-interaction";
import {
  buildExpectedSceneBySample,
  defaultDepthForScene,
  expectedSceneForSample,
  type GameplayDepthChange,
  type GameplayDepthExpect,
} from "@/lib/qa/sample-qa-defaults";
import { SAMPLES } from "@/lib/samples";

export type { GameplayDepthChange, GameplayDepthExpect };

/**
 * 单样品深度字段覆盖（Scene 默认不够时）。
 * 新样品默认走 defaultDepthForScene，不必改这里。
 */
const GAMEPLAY_DEPTH_OVERRIDES: Partial<Record<string, GameplayDepthExpect>> = {
  "number-merge-2048": { field: "puzzleMoves", change: "increased", minDelta: 1 },
  "pottery-master-3d": { field: "potteryHeight", change: "increased", minDelta: 1 },
};

function depthForSampleId(sampleId: string): GameplayDepthExpect {
  const sample = SAMPLES.find((s) => s.id === sampleId);
  const scene = sample ? expectedSceneForSample(sample) : "UnknownScene";
  return GAMEPLAY_DEPTH_OVERRIDES[sampleId] ?? defaultDepthForScene(scene);
}

/** 覆盖全部 SAMPLES；随样品馆增减自动伸缩 */
export const GAMEPLAY_DEPTH_BY_SAMPLE: Record<string, GameplayDepthExpect> = Object.fromEntries(
  SAMPLES.map((s) => [s.id, depthForSampleId(s.id)]),
);

export function gameplayDepthForCase(c: SampleGameplayCase): GameplayDepthExpect | undefined {
  return GAMEPLAY_DEPTH_BY_SAMPLE[c.sampleId];
}

export function validateGameplayDepthOffline(): string[] {
  const failures: string[] = [];
  const sampleIds = new Set(SAMPLES.map((s) => s.id));
  const scenes = buildExpectedSceneBySample();

  for (const id of sampleIds) {
    const exp = GAMEPLAY_DEPTH_BY_SAMPLE[id];
    if (!exp) failures.push(`missing depth expect: ${id}`);
    else {
      if (!exp.field.trim()) failures.push(`${id}: empty depth field`);
      if (exp.minDelta != null && exp.minDelta < 1) failures.push(`${id}: minDelta must be >= 1`);
    }
    if (!scenes[id]) failures.push(`missing expected scene for depth: ${id}`);
  }
  for (const id of Object.keys(GAMEPLAY_DEPTH_BY_SAMPLE)) {
    if (!sampleIds.has(id)) failures.push(`orphan depth expect: ${id}`);
  }
  for (const id of Object.keys(GAMEPLAY_DEPTH_OVERRIDES)) {
    if (!sampleIds.has(id)) failures.push(`orphan depth override: ${id}`);
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
