import type { GameSpec } from "@/lib/game-spec";
import type { GameDeliveryReadiness } from "@/lib/game-delivery-readiness";
import type { GameVerticalSliceScorecard } from "@/lib/game-vertical-slice";

export const GAME_PREFLIGHT_STAGE_IDS = [
  "requirements",
  "gameplay_definition",
  "prototype",
  "technical_design",
  "development",
  "balance",
] as const;

export type GameProductionStageId = (typeof GAME_PREFLIGHT_STAGE_IDS)[number] | "mobile_test" | "release" | "operations";
export type GameProductionStage = {
  id: GameProductionStageId;
  status: "ready" | "pending" | "blocked";
  evidence: string[];
};

export type GameProductionPipelineReport = {
  version: 1;
  kind: "game_production_pipeline";
  preflightVerdict: "ready" | "blocked";
  stages: GameProductionStage[];
};

/**
 * Immutable, executable hand-off from product intent to a playable build.
 * Observed mobile playtest/release/operations evidence is attached later to
 * the same CreativeRevision; those stages must not be fabricated at compile time.
 */
export function buildGameProductionPipelineReport(input: {
  spec: GameSpec;
  verticalSlice: GameVerticalSliceScorecard;
  delivery: GameDeliveryReadiness;
  sceneCount: number;
  behaviorNodeCount: number;
}): GameProductionPipelineReport {
  const { spec, verticalSlice, delivery } = input;
  const contract = spec.production?.delivery;
  const stages: GameProductionStage[] = [
    {
      id: "requirements",
      status: contract?.targetDevice === "mobile_h5" && Boolean(contract.primaryInput && contract.playerGoal) ? "ready" : "blocked",
      evidence: contract
        ? [`device:${contract.targetDevice}`, `session:${contract.targetSessionSeconds}s`, `input:${contract.primaryInput}`, `goal:${contract.playerGoal}`]
        : ["delivery_contract_missing"],
    },
    {
      id: "gameplay_definition",
      status: contract?.winCondition && contract.failCondition && (spec.gameplay.winScore ?? 0) > 0 && (spec.gameplay.lives ?? 0) > 0 ? "ready" : "blocked",
      evidence: contract
        ? [`core_action:${verticalSlice.contract.coreAction}`, `win:${contract.winCondition}`, `fail:${contract.failCondition}`]
        : ["win_fail_contract_missing"],
    },
    {
      id: "prototype",
      status: verticalSlice.verdict === "blocked" ? "blocked" : "ready",
      evidence: [`vertical_slice:${verticalSlice.verdict}`, `vertical_slice_score:${verticalSlice.score}`, `first_minute_beats:${verticalSlice.contract.firstMinute.length}`],
    },
    {
      id: "technical_design",
      status: input.sceneCount > 0 && input.behaviorNodeCount > 0 ? "ready" : "blocked",
      evidence: [`template:${spec.templateId}`, `scene_count:${input.sceneCount}`, `behavior_node_count:${input.behaviorNodeCount}`],
    },
    {
      id: "development",
      status: spec.production?.levelFlow.length === 4 && spec.production.audio.sections.length === 4 ? "ready" : "blocked",
      evidence: [`level_flow:${spec.production?.levelFlow.length ?? 0}`, `music_sections:${spec.production?.audio.sections.length ?? 0}`, "runtime_end_state:required"],
    },
    {
      id: "balance",
      status: delivery.verdict === "blocked" || delivery.balance.verdict === "blocked" ? "blocked" : "ready",
      evidence: [`delivery:${delivery.verdict}`, `delivery_score:${delivery.score}`, `scenario_pass_rate:${Math.round(delivery.balance.passRate * 100)}%`],
    },
    { id: "mobile_test", status: "pending", evidence: ["requires_observed_60s_mobile_session"] },
    { id: "release", status: "pending", evidence: ["requires_author_publish_decision"] },
    { id: "operations", status: "pending", evidence: ["requires_post_release_aggregate_telemetry"] },
  ];
  const preflightVerdict = stages
    .filter((stage) => GAME_PREFLIGHT_STAGE_IDS.includes(stage.id as (typeof GAME_PREFLIGHT_STAGE_IDS)[number]))
    .some((stage) => stage.status === "blocked")
    ? "blocked"
    : "ready";
  return { version: 1, kind: "game_production_pipeline", preflightVerdict, stages };
}
