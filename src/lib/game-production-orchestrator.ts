import type { CreativeBrief } from "@/lib/creative-brief/types";
import { assessGameAssetReadiness } from "@/lib/game-asset-readiness";
import { evaluateGameDeliveryReadiness } from "@/lib/game-delivery-readiness";
import { buildGameEditSchema } from "@/lib/game-edit-schema";
import { buildGameProductionPipelineReport, type GameProductionRole } from "@/lib/game-production-pipeline";
import type { GameSpec } from "@/lib/game-spec";
import { buildGameDesignGraphs } from "@/lib/creator-core/game-design-graph";
import { evaluateGameVerticalSlice } from "@/lib/game-vertical-slice";
import { hasBespokeRuntime, requiresBespokeRuntime } from "@/lib/game-runtime-policy";
import { evaluateAgenticVisualContract } from "@/lib/agentic/agentic-visual-contract";
import { buildGameArtDirection } from "@/lib/game-art-direction";
import { buildGamePlayabilityContract } from "@/lib/game-playability-contract";
import { evaluateAgenticMechanicsContract } from "@/lib/agentic/agentic-mechanics-contract";
import type { RealAgentExecution } from "@/lib/game-production-agents";

export type GameProductionArtifact = {
  kind: string;
  mediaType: "json" | "report";
  content: unknown;
  metadata: Record<string, unknown>;
};

export type GameProductionCandidate = {
  version: 1;
  kind: "game_production_candidate";
  decision: "ready_for_playtest" | "rejected";
  score: number;
  blockers: string[];
  requiredObservedEvidence: ["mobile_60s", "first_action", "core_loop", "failure_recovery", "win_or_loss"];
  artifactKinds: string[];
};

export type GameProductionRun = {
  version: 1;
  kind: "game_production_run";
  status: "ready_for_playtest" | "rejected";
  passes: Array<{
    index: number;
    role: GameProductionRole;
    consumes: string[];
    produces: string[];
    verdict: "passed" | "blocked";
    evidence: string[];
  }>;
  candidate: GameProductionCandidate;
  artifacts: GameProductionArtifact[];
};

/**
 * Executes the production hand-off after assets exist. Each role produces a
 * durable, game-specific deliverable consumed by later roles. This preflight
 * never pretends to be observed browser/player evidence.
 */
export function buildGameProductionRun(input: {
  spec: GameSpec;
  prompt?: string;
  brief?: CreativeBrief | null;
  assetManifest: unknown;
  productionRound?: number;
  realAgentExecutions?: RealAgentExecution[];
  realAgentOutputs?: { design: unknown; artDirection: unknown; scene: unknown; visualReview?: { passed: boolean; score: number; blockers: string[]; revisionInstructions: string[]; screenshotBytes: number } };
}): GameProductionRun {
  const verticalSlice = evaluateGameVerticalSlice(input.spec, input.brief ?? undefined);
  const delivery = evaluateGameDeliveryReadiness(input.spec);
  const assets = assessGameAssetReadiness(input.assetManifest);
  const { sceneGraph, behaviorGraph } = buildGameDesignGraphs(input.spec);
  const pipeline = buildGameProductionPipelineReport({
    spec: input.spec,
    verticalSlice,
    delivery,
    sceneCount: sceneGraph.scenes.length,
    behaviorNodeCount: behaviorGraph.nodes.length,
  });
  const editor = buildGameEditSchema(input.spec, input.prompt);
  const artDirection = buildGameArtDirection(input.spec, input.brief ?? null);
  const playability = buildGamePlayabilityContract(input.spec);
  const visualContract = evaluateAgenticVisualContract(input.spec, input.spec.agenticModule);
  const mechanicsContract = evaluateAgenticMechanicsContract(input.prompt ?? "", input.spec, input.spec.agenticModule);
  const executions = input.realAgentExecutions ?? [];
  const succeededRoles = new Set(executions.filter((item) => item.status === "succeeded").map((item) => item.role));
  const requiredRealRoles: RealAgentExecution["role"][] = ["design_director", "art_director", "scene_designer", "runtime_engineer", "audio_agent", "visual_review_agent"];
  const missingRealRoles = requiredRealRoles.filter((role) => !succeededRoles.has(role));
  const blockers = [
    ...(pipeline.preflightVerdict === "blocked" ? ["production_preflight_blocked"] : []),
    ...(verticalSlice.verdict === "blocked" ? ["vertical_slice_blocked"] : []),
    ...(delivery.verdict === "blocked" ? ["delivery_preflight_blocked"] : []),
    ...(!assets.ok ? assets.evidence.filter((entry) => entry.endsWith("_missing")) : []),
    ...(requiresBespokeRuntime(input.spec) && !hasBespokeRuntime(input.spec) ? ["generic_phaser_runtime_retired"] : []),
    ...visualContract.blockers,
    ...mechanicsContract.blockers,
    ...missingRealRoles.map((role) => `real_agent_missing:${role}`),
    ...(input.realAgentOutputs?.visualReview?.passed === true ? [] : ["visual_review_rejected", ...(input.realAgentOutputs?.visualReview?.blockers ?? [])]),
  ];
  const score = Math.max(0, Math.min(100, Math.round(
    verticalSlice.score * 0.45 + delivery.score * 0.35 + (assets.ok ? 20 : 0),
  )));
  const decision = blockers.length === 0 ? "ready_for_playtest" : "rejected";

  const artifacts: GameProductionArtifact[] = [
    {
      kind: "game_agent_execution_ledger",
      mediaType: "report",
      content: {
        version: 1,
        round: input.productionRound ?? 1,
        agents: executions,
        requiredRoles: requiredRealRoles,
        missingRoles: missingRealRoles,
        next: blockers.length === 0 ? "observed_mobile_playtest" : "automatic_preflight_revision",
      },
      metadata: { role: "orchestrator", round: input.productionRound ?? 1, truthfulEvidence: true },
    },
    {
      kind: "game_design_directive",
      mediaType: "json",
      content: {
        version: 1,
        playerFantasy: verticalSlice.contract.playerFantasy,
        coreAction: verticalSlice.contract.coreAction,
        signatureDelight: verticalSlice.contract.signatureDelight,
        firstMinute: verticalSlice.contract.firstMinute,
        delivery: input.spec.production?.delivery ?? null,
      },
      metadata: { role: "design_director", templateId: input.spec.templateId },
    },
    {
      kind: "gameplay_revision",
      mediaType: "json",
      content: {
        version: 1,
        templateId: input.spec.templateId,
        gameplay: input.spec.gameplay,
        systems: input.spec.systems ?? null,
        levelFlow: input.spec.production?.levelFlow ?? [],
        sceneGraph,
        behaviorGraph,
        verticalSlice,
      },
      metadata: { role: "gameplay_designer", verdict: verticalSlice.verdict, score: verticalSlice.score },
    },
    {
      kind: "art_direction_pack",
      mediaType: "json",
      content: {
        version: 1,
        direction: input.realAgentOutputs?.artDirection ?? artDirection,
        designAgentOutput: input.realAgentOutputs?.design ?? null,
        sceneAgentOutput: input.realAgentOutputs?.scene ?? null,
        gameplayArtDirection: verticalSlice.artDirection,
        assetManifest: input.assetManifest,
        readiness: assets,
      },
      metadata: { role: "art_director", ready: assets.ok },
    },
    {
      kind: "ux_interaction_contract",
      mediaType: "json",
      content: {
        version: 1,
        primaryInput: input.spec.production?.delivery?.primaryInput ?? null,
        firstRewardBySecond: input.spec.production?.delivery?.firstRewardBySecond ?? null,
        editor,
        restartRequired: true,
        mobileTarget: input.spec.production?.delivery?.targetDevice === "mobile_h5",
      },
      metadata: { role: "ux_designer", controls: editor.controls.length },
    },
    {
      kind: "gameplay_acceptance_contract",
      mediaType: "json",
      content: playability,
      metadata: { role: "qa_agent", templateId: input.spec.templateId, mobile: true },
    },
    {
      kind: "runtime_build_manifest",
      mediaType: "json",
      content: {
        version: 1,
        runtimeStrategy: pipeline.runtimeStrategy,
        route: input.spec.agenticPlayRoute ?? "dedicated",
        executableModule: input.spec.agenticModule
          ? { version: input.spec.agenticModule.version, entry: input.spec.agenticModule.entry }
          : null,
        sceneCount: sceneGraph.scenes.length,
        behaviorNodeCount: behaviorGraph.nodes.length,
        assetReady: assets.ok,
        visualContract,
        mechanicsContract,
      },
      metadata: { role: "runtime_engineer", strategy: pipeline.runtimeStrategy },
    },
    {
      kind: "automated_playtest_preflight",
      mediaType: "report",
      content: {
        version: 1,
        observed: false,
        scope: "deterministic_scenario_sweep",
        delivery,
        balance: delivery.balance,
        assetReadiness: assets,
        warning: "This is preflight evidence only; real mobile playtest evidence is required for publication.",
      },
      metadata: { role: "qa_agent", verdict: delivery.verdict, observed: false },
    },
    {
      kind: "visual_review_report",
      mediaType: "report",
      content: input.realAgentOutputs?.visualReview ?? { passed: false, score: 0, blockers: ["visual_review_missing"], revisionInstructions: [], screenshotBytes: 0 },
      metadata: { role: "visual_review_agent", observedScreenshot: Boolean(input.realAgentOutputs?.visualReview?.screenshotBytes) },
    },
  ];
  const candidate: GameProductionCandidate = {
    version: 1,
    kind: "game_production_candidate",
    decision,
    score,
    blockers,
    requiredObservedEvidence: ["mobile_60s", "first_action", "core_loop", "failure_recovery", "win_or_loss"],
    artifactKinds: artifacts.map((artifact) => artifact.kind),
  };
  const verdict = (blocked: boolean): "passed" | "blocked" => blocked ? "blocked" : "passed";
  const passes: GameProductionRun["passes"] = [
    { index: 1, role: "design_director", consumes: ["game_spec", "creative_brief"], produces: ["game_design_directive"], verdict: verdict(pipeline.preflightVerdict === "blocked"), evidence: [`pipeline:${pipeline.preflightVerdict}`] },
    { index: 2, role: "gameplay_designer", consumes: ["game_design_directive", "game_spec"], produces: ["gameplay_revision"], verdict: verdict(verticalSlice.verdict === "blocked"), evidence: [`vertical_slice:${verticalSlice.verdict}:${verticalSlice.score}`] },
    { index: 3, role: "art_director", consumes: ["game_design_directive", "asset_manifest"], produces: ["art_direction_pack"], verdict: verdict(!assets.ok), evidence: assets.evidence },
    { index: 4, role: "ux_designer", consumes: ["game_design_directive", "gameplay_revision"], produces: ["ux_interaction_contract"], verdict: "passed", evidence: [`controls:${editor.controls.length}`] },
    { index: 5, role: "runtime_engineer", consumes: ["gameplay_revision", "art_direction_pack", "ux_interaction_contract"], produces: ["runtime_build_manifest"], verdict: verdict(pipeline.preflightVerdict === "blocked" || !assets.ok || !visualContract.ok || !mechanicsContract.ok), evidence: [`runtime:${pipeline.runtimeStrategy}`, `assets:${assets.ok ? "ready" : "blocked"}`, ...visualContract.evidence, ...mechanicsContract.evidence] },
    { index: 6, role: "qa_agent", consumes: ["runtime_build_manifest", "game_delivery_preflight"], produces: ["automated_playtest_preflight", "game_production_candidate"], verdict: verdict(blockers.length > 0), evidence: [`candidate:${decision}:${score}`, ...blockers] },
  ];
  return { version: 1, kind: "game_production_run", status: decision, passes, candidate, artifacts };
}
