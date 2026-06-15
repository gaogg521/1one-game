import { EXPECTED_SCENE_BY_SAMPLE } from "@/lib/qa/competitor-clone-playability-checks";
import { SAMPLES } from "@/lib/samples";

export type SampleInteractionKind =
  | "click-center"
  | "click-upper"
  | "click-lower"
  | "arrow-right"
  | "arrow-left"
  | "space";

export type SampleGameplayCase = {
  sampleId: string;
  expectedScene: string;
  interaction: SampleInteractionKind;
  /** 持续动画：用 idle burst 对比交互后 diff */
  animated?: boolean;
  /** 相对 canvas 的点击位置（0–1） */
  clickRel?: { x: number; y: number };
  /** 连点/连按次数 */
  clickBurst?: number;
  /** 第二次点击（策略/象棋等双步操作） */
  clickRel2?: { x: number; y: number };
};

/** 与 ANIMATED_CLONE_SAMPLES 对齐 */
export const ANIMATED_GAMEPLAY_SAMPLES = new Set([
  "crashy-roads",
  "rail-in-air",
  "tiny-planet-chopper",
  "elastic-thief-2",
  "gun-merge-3d-zombie-apocalypse",
  "blade-defender-merge",
  "blocky-sniper-hunter",
  "smash-the-dummy",
  "pottery-master-3d",
]);

export const SAMPLE_GAMEPLAY_CASES: SampleGameplayCase[] = [
  { sampleId: "smash-the-dummy", expectedScene: "PhysicsScene", interaction: "click-center", animated: true, clickRel: { x: 0.5, y: 0.46 }, clickBurst: 3 },
  { sampleId: "rail-in-air", expectedScene: "CoasterScene", interaction: "arrow-right", animated: true, clickBurst: 3 },
  { sampleId: "crashy-roads", expectedScene: "CoasterScene", interaction: "arrow-left", animated: true, clickBurst: 8 },
  { sampleId: "grow-a-garden", expectedScene: "FarmingScene", interaction: "click-center", clickRel: { x: 0.38, y: 0.24 }, clickBurst: 2 },
  { sampleId: "color-bloom", expectedScene: "PuzzleScene", interaction: "click-center", clickRel: { x: 0.38, y: 0.52 }, clickBurst: 2 },
  { sampleId: "whimsy-differences", expectedScene: "PuzzleScene", interaction: "click-upper", clickRel: { x: 0.32, y: 0.42 }, clickBurst: 2 },
  { sampleId: "gun-merge-3d-zombie-apocalypse", expectedScene: "TowerDefenseScene", interaction: "click-lower", animated: true, clickRel: { x: 0.71, y: 0.84 }, clickRel2: { x: 0.81, y: 0.84 } },
  { sampleId: "ultimate-3d-chess", expectedScene: "ChessScene", interaction: "click-center", clickRel: { x: 0.48, y: 0.72 }, clickRel2: { x: 0.48, y: 0.55 }, clickBurst: 2 },
  { sampleId: "elastic-thief-2", expectedScene: "PlatformerScene", interaction: "arrow-right", animated: true, clickBurst: 8 },
  { sampleId: "state-conquest", expectedScene: "StrategyScene", interaction: "click-center", clickRel: { x: 0.32, y: 0.42 }, clickRel2: { x: 0.58, y: 0.38 }, clickBurst: 2 },
  { sampleId: "tiny-planet-chopper", expectedScene: "ShooterScene", interaction: "space", animated: true, clickBurst: 3 },
  { sampleId: "blade-defender-merge", expectedScene: "TowerDefenseScene", interaction: "click-lower", animated: true, clickRel: { x: 0.71, y: 0.84 }, clickRel2: { x: 0.81, y: 0.84 } },
  { sampleId: "car-color-palette", expectedScene: "CustomizationScene", interaction: "click-center", clickRel: { x: 0.5, y: 0.42 }, clickBurst: 2 },
  { sampleId: "blocky-sniper-hunter", expectedScene: "ShooterScene", interaction: "space", animated: true, clickBurst: 3 },
  { sampleId: "memory-match-mania", expectedScene: "PuzzleScene", interaction: "click-center", clickRel: { x: 0.35, y: 0.5 }, clickBurst: 2 },
  { sampleId: "kids-puzzle", expectedScene: "PuzzleScene", interaction: "click-center", clickRel: { x: 0.4, y: 0.48 }, clickBurst: 2 },
  { sampleId: "pottery-master-3d", expectedScene: "CustomizationScene", interaction: "click-center", animated: true, clickRel: { x: 0.5, y: 0.46 }, clickBurst: 3 },
];

export function defaultClickRel(kind: SampleInteractionKind): { x: number; y: number } {
  switch (kind) {
    case "click-upper":
      return { x: 0.5, y: 0.35 };
    case "click-lower":
      return { x: 0.5, y: 0.72 };
    default:
      return { x: 0.5, y: 0.48 };
  }
}

export function validateSampleGameplayCasesOffline(): string[] {
  const failures: string[] = [];
  const sampleIds = new Set(SAMPLES.map((s) => s.id));
  const caseIds = new Set(SAMPLE_GAMEPLAY_CASES.map((c) => c.sampleId));

  for (const id of sampleIds) {
    if (!caseIds.has(id)) failures.push(`missing gameplay case: ${id}`);
  }
  for (const c of SAMPLE_GAMEPLAY_CASES) {
    if (!sampleIds.has(c.sampleId)) failures.push(`orphan gameplay case: ${c.sampleId}`);
    const expected = EXPECTED_SCENE_BY_SAMPLE[c.sampleId];
    if (expected && c.expectedScene !== expected) {
      failures.push(`${c.sampleId}: expectedScene ${c.expectedScene} !== ${expected}`);
    }
    if (ANIMATED_GAMEPLAY_SAMPLES.has(c.sampleId) && !c.animated) {
      failures.push(`${c.sampleId}: should be animated`);
    }
  }
  return failures;
}

export type SampleGameplayResult = {
  sampleId: string;
  title: string;
  projectId: string;
  apiOk: boolean;
  canvasOk: boolean;
  playReadyOk: boolean;
  sceneOk: boolean;
  actualScene: string | null;
  interactionOk: boolean;
  interactionDiff: number;
  idleCeiling: number;
  error?: string;
  pass: boolean;
};
