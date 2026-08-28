import assert from "node:assert/strict";
import { buildDefaultGameProductionContract } from "@/lib/game-production-contract";
import { evaluateGameDeliveryReadiness } from "@/lib/game-delivery-readiness";
import {
  buildGameProductionPipelineReport,
  GAME_PRODUCTION_ROLES,
} from "@/lib/game-production-pipeline";
import { evaluateGameVerticalSlice } from "@/lib/game-vertical-slice";
import { mockSpecFromPrompt } from "@/lib/mock-spec";

function buildSpec(route: "dedicated" | "agentic", withModule: boolean) {
  const prompt = "制作一款有采集、建造、敌人和超能力的体素沙盒游戏";
  const base = mockSpecFromPrompt(prompt, { templateId: "survivor" });
  return {
    ...base,
    production: buildDefaultGameProductionContract({ prompt, templateId: base.templateId }),
    agenticPlayRoute: route,
    ...(withModule
      ? { agenticModule: { version: 1 as const, entry: "createGame", source: "export function createGame() {}" } }
      : {}),
  };
}

function reportFor(spec: ReturnType<typeof buildSpec>) {
  return buildGameProductionPipelineReport({
    spec,
    verticalSlice: evaluateGameVerticalSlice(spec),
    delivery: evaluateGameDeliveryReadiness(spec),
    sceneCount: 2,
    behaviorNodeCount: 6,
  });
}

const playable = reportFor(buildSpec("agentic", true));
assert.equal(playable.runtimeStrategy, "independent_agentic_module");
assert.deepEqual(new Set(playable.roleCoverage), new Set(GAME_PRODUCTION_ROLES));
assert.equal(playable.requiredPlaytests.length, 5);
assert.deepEqual(playable.requiredPlaytests.map((scenario) => scenario.id), [
  "first_input",
  "core_loop",
  "failure_recovery",
  "win_state",
  "mobile_session",
]);
for (const stage of playable.stages) {
  assert.ok(stage.owner, `${stage.id}: owner is required`);
  assert.ok(stage.objective, `${stage.id}: objective is required`);
  assert.ok(stage.deliverables.length > 0, `${stage.id}: deliverables are required`);
  assert.ok(stage.acceptance.length > 0, `${stage.id}: acceptance criteria are required`);
}

const missingRuntime = reportFor(buildSpec("agentic", false));
const technical = missingRuntime.stages.find((stage) => stage.id === "technical_design");
assert.equal(technical?.status, "blocked", "agentic route must fail closed when its executable module is absent");
assert.equal(missingRuntime.preflightVerdict, "blocked");

const art = playable.stages.find((stage) => stage.id === "asset_production");
assert.equal(art?.status, "pending", "compile time must not fabricate durable asset evidence");

const webglSpec = { ...buildSpec("dedicated", false), samplePlayProfile: { variantId: "voxel-power-frontier", showcaseRuntime: "voxel-frontier" as const } };
const webgl = reportFor(webglSpec);
assert.equal(webgl.runtimeStrategy, "independent_webgl_runtime");
assert.equal(webgl.stages.find((stage) => stage.id === "technical_design")?.status, "ready");

console.log("[OK] qa-game-production-pipeline: six-role plan, runtime gate, asset handoff and observed playtests are explicit");
