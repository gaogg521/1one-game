import { GAMEPLAY_DEPTH_BY_SAMPLE } from "@/lib/qa/gameplay-depth";
import {
  defaultInteractionForScene,
  expectedSceneForSample,
  isAnimatedScene,
} from "@/lib/qa/sample-qa-defaults";
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

/**
 * 仅保留「默认 Scene 交互不够」的样品覆盖（坐标/键位）。
 * 新样品默认按 Scene 族自动生成，不必往这里加。
 */
const SAMPLE_GAMEPLAY_OVERRIDES: Partial<
  Record<string, Omit<SampleGameplayCase, "sampleId" | "expectedScene">>
> = {
  "number-merge-2048": { interaction: "arrow-right", clickBurst: 2 },
  "classic-xiangqi-board": {
    interaction: "click-center",
    clickRel: { x: 0.48, y: 0.66 },
    clickRel2: { x: 0.48, y: 0.56 },
    clickBurst: 2,
  },
  "classic-international-chess": {
    interaction: "click-center",
    clickRel: { x: 0.48, y: 0.72 },
    clickRel2: { x: 0.48, y: 0.56 },
    clickBurst: 2,
  },
  "zen-go-board": { interaction: "click-center", clickRel: { x: 0.24, y: 0.24 }, clickBurst: 2 },
  "jungle-animal-chess": {
    interaction: "click-center",
    clickRel: { x: 0.08, y: 0.9 },
    clickRel2: { x: 0.08, y: 0.78 },
    clickBurst: 2,
  },
  "grow-a-garden": { interaction: "click-center", clickRel: { x: 0.38, y: 0.24 }, clickBurst: 2 },
  "color-bloom": { interaction: "click-center", clickRel: { x: 0.38, y: 0.52 }, clickBurst: 2 },
};

function buildCaseForSample(sampleId: string): SampleGameplayCase {
  const sample = SAMPLES.find((s) => s.id === sampleId)!;
  const expectedScene = expectedSceneForSample(sample);
  const defaults = defaultInteractionForScene(expectedScene);
  const override = SAMPLE_GAMEPLAY_OVERRIDES[sampleId];
  return {
    sampleId,
    expectedScene,
    interaction: defaults.interaction,
    animated: defaults.animated ?? (isAnimatedScene(expectedScene) || undefined),
    clickRel: defaults.clickRel,
    clickBurst: defaults.clickBurst,
    clickRel2: defaults.clickRel2,
    ...override,
  };
}

/** 覆盖全部 SAMPLES；随样品馆增减自动伸缩 */
export const SAMPLE_GAMEPLAY_CASES: SampleGameplayCase[] = SAMPLES.map((s) =>
  buildCaseForSample(s.id),
);

/** 派生：animated=true 的样品集合（兼容旧引用） */
export const ANIMATED_GAMEPLAY_SAMPLES = new Set(
  SAMPLE_GAMEPLAY_CASES.filter((c) => c.animated).map((c) => c.sampleId),
);

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

  if (SAMPLE_GAMEPLAY_CASES.length !== SAMPLES.length) {
    failures.push(
      `case count ${SAMPLE_GAMEPLAY_CASES.length} !== SAMPLES ${SAMPLES.length} (should auto-cover)`,
    );
  }
  for (const id of sampleIds) {
    if (!caseIds.has(id)) failures.push(`missing gameplay case: ${id}`);
  }
  for (const c of SAMPLE_GAMEPLAY_CASES) {
    if (!sampleIds.has(c.sampleId)) failures.push(`orphan gameplay case: ${c.sampleId}`);
    const sample = SAMPLES.find((s) => s.id === c.sampleId);
    if (sample) {
      const derived = expectedSceneForSample(sample);
      if (c.expectedScene !== derived) {
        failures.push(`${c.sampleId}: expectedScene ${c.expectedScene} !== derived ${derived}`);
      }
    }
    if (isAnimatedScene(c.expectedScene) && !c.animated) {
      failures.push(`${c.sampleId}: animated scene should set animated=true`);
    }
    if (GAMEPLAY_DEPTH_BY_SAMPLE[c.sampleId] && !c.clickBurst && c.interaction.startsWith("click")) {
      failures.push(`${c.sampleId}: depth case needs clickBurst >= 1`);
    }
  }
  for (const id of Object.keys(SAMPLE_GAMEPLAY_OVERRIDES)) {
    if (!sampleIds.has(id)) failures.push(`orphan gameplay override: ${id}`);
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
  gameplayDepthOk: boolean;
  gameplayDepthField?: string;
  idleCeiling: number;
  error?: string;
  pass: boolean;
};
