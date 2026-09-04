import { resolveGameModelRoute } from "@/lib/game-model-route";
import { SAMPLES, type Sample } from "@/lib/samples";
import type { SampleInteractionKind } from "@/lib/qa/sample-gameplay-interaction";

export type GameplayDepthChange = "increased" | "decreased" | "changed";

export type GameplayDepthExpect = {
  field: string;
  change: GameplayDepthChange;
  minDelta?: number;
};

type InteractionDefault = {
  interaction: SampleInteractionKind;
  animated?: boolean;
  clickRel?: { x: number; y: number };
  clickBurst?: number;
  clickRel2?: { x: number; y: number };
};

/**
 * Samples no longer select a template Scene. Their route is the same model
 * route used for a creator prompt, retaining text versus vision routing.
 */
export function expectedSceneForSample(sample: Pick<Sample, "prompt">): string {
  return resolveGameModelRoute({ prompt: sample.prompt }).scene;
}

export function buildExpectedSceneBySample(): Record<string, string> {
  return Object.fromEntries(SAMPLES.map((sample) => [sample.id, expectedSceneForSample(sample)]));
}

export function defaultInteractionForScene(_scene: string): InteractionDefault {
  return { interaction: "click-center", clickBurst: 1 };
}

export function isAnimatedScene(_scene: string): boolean {
  return false;
}

export function defaultDepthForScene(_scene: string): GameplayDepthExpect {
  return { field: "score", change: "increased", minDelta: 1 };
}

export function sampleQaDefaults(): InteractionDefault[] {
  return [];
}
