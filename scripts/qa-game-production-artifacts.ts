import assert from "node:assert/strict";
import { buildRuntimeAssetManifest, RUNTIME_ASSET_SCHEMA_VERSION } from "@/lib/assets/asset-runtime-resolver";
import { buildDefaultGameProductionContract } from "@/lib/game-production-contract";
import { buildGameEditSchema } from "@/lib/game-edit-schema";
import { mockSpecFromPrompt } from "@/lib/mock-spec";

const prompt = "制作一款有采集、建造、敌人和超能力的体素沙盒游戏";
const base = mockSpecFromPrompt(prompt, { templateId: "survivor" });
const spec = {
  ...base,
  agenticPlayRoute: "agentic" as const,
  production: buildDefaultGameProductionContract({ prompt, templateId: base.templateId }),
};

const editSchema = buildGameEditSchema(spec);
assert.equal(editSchema.runtimeStrategy, "independent_agentic_module");
assert.ok(editSchema.controls.some((control) => control.path === "gameplay.playerSpeed"));
assert.ok(editSchema.controls.some((control) => control.path === "production.delivery.firstRewardBySecond"));
assert.ok(editSchema.controls.every((control) => control.gameplayImpact.length > 0));

const voxelEditSchema = buildGameEditSchema({
  ...spec,
  agenticPlayRoute: "dedicated",
  samplePlayProfile: { variantId: "voxel-power-frontier", showcaseRuntime: "voxel-frontier" },
});
assert.equal(voxelEditSchema.runtimeStrategy, "independent_webgl_runtime");

const manifest = buildRuntimeAssetManifest({
  projectId: "qa-project",
  backgroundUrl: "/game-bg/qa-project.webp",
  spriteUrls: [
    { kind: "player", url: "/game-sprites/qa-project/player.webp" },
    { kind: "hazard", url: "/game-sprites/qa-project/hazard.webp" },
  ],
});
assert.equal(manifest.runtimeSchema, RUNTIME_ASSET_SCHEMA_VERSION);
assert.ok(manifest.slots?.every((slot) => slot.metadata?.semanticRole && slot.metadata.revision === 1));
assert.equal(manifest.slots?.find((slot) => slot.slot === "background")?.metadata?.aspectRatio, "9:16");

console.log("[OK] qa-game-production-artifacts: custom editor and traceable asset metadata are durable");
