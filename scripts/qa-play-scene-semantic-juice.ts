import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { hasBespokeRuntime, requiresBespokeRuntime } from "@/lib/game-runtime-policy";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import { resolveAgenticPlayRoute } from "@/lib/opengame-skills/play-route";
import { mockSpecFromPrompt } from "@/lib/mock-spec";

const retiredPath = path.join(process.cwd(), "src/game/engine/PlayScene.ts");
assert.equal(fs.existsSync(retiredPath), false, "generic PlayScene must stay deleted");

const collector = mockSpecFromPrompt("月夜收集萤火虫", { templateId: "collector" });
assert.equal(requiresBespokeRuntime(collector), true, "collector must not use a generic Phaser arena");
assert.equal(hasBespokeRuntime(collector), false, "a generic collector draft is not deliverable");
assert.equal(expectedPhaserSceneName(collector), "BespokeRuntimeRequired");
assert.equal(resolveAgenticPlayRoute("月夜收集萤火虫", collector, { respectPersisted: false }), "agentic");

const moduleCollector = {
  ...collector,
  agenticPlayRoute: "agentic" as const,
  agenticModule: { version: 1 as const, entry: "createGame", source: "function createGame(){ return { create(){} }; }" },
};
assert.equal(hasBespokeRuntime(moduleCollector), true, "an executable bespoke module restores play eligibility");

console.log("[OK] qa-play-scene-semantic-juice: generic Phaser arena retired");
