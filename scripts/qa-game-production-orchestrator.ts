import assert from "node:assert/strict";
import { buildGameProductionRun } from "@/lib/game-production-orchestrator";
import { buildDefaultGameProductionContract } from "@/lib/game-production-contract";
import { mockSpecFromPrompt } from "@/lib/mock-spec";

const prompt = "制作一款有采集、建造、敌人和超能力的体素沙盒游戏";
const base = mockSpecFromPrompt(prompt, { templateId: "survivor" });
const spec = {
  ...base,
  agenticPlayRoute: "agentic" as const,
  agenticModule: { version: 1 as const, entry: "createGame", source: "function createGame(ctx){ return { create(scene){ const bg=ctx.assets?.backgroundKey; const player=ctx.assets?.playerKey; const enemy=ctx.assets?.enemyKey; if(bg) scene.add.image(1,1,bg); if(player) scene.add.sprite(2,2,player); if(enemy) scene.add.sprite(3,3,enemy); } }; }" },
  production: buildDefaultGameProductionContract({ prompt, templateId: base.templateId }),
};
const assetManifest = {
  backgroundUrl: "/game-bg/qa.webp",
  sprites: [
    { kind: "player", url: "/game-sprites/qa/player.webp" },
    { kind: "hazard", url: "/game-sprites/qa/hazard.webp" },
  ],
  manifest: { slots: [
    { slot: "background", url: "/game-bg/qa.webp" },
    { slot: "player", url: "/game-sprites/qa/player.webp" },
    { slot: "enemy", url: "/game-sprites/qa/hazard.webp" },
  ] },
};

const run = buildGameProductionRun({ spec, assetManifest });
assert.equal(run.passes.length, 6, "all production roles must execute");
assert.deepEqual(run.passes.map((pass) => pass.role), [
  "design_director", "gameplay_designer", "art_director", "ux_designer", "runtime_engineer", "qa_agent",
]);
assert.equal(run.candidate.decision, "ready_for_playtest");
assert.ok(run.candidate.artifactKinds.includes("runtime_build_manifest"));
assert.ok(run.artifacts.some((artifact) => artifact.kind === "gameplay_revision"));
const automated = run.artifacts.find((artifact) => artifact.kind === "automated_playtest_preflight");
assert.equal((automated?.content as { observed?: boolean }).observed, false, "preflight must not impersonate observed playtest evidence");
assert.ok(run.passes.every((pass, index) => pass.index === index + 1 && pass.consumes.length > 0 && pass.produces.length > 0));

const genericVisual = buildGameProductionRun({
  spec: { ...spec, agenticModule: { version: 1, entry: "createGame", source: "function createGame(){ return { create(){} }; }" } },
  assetManifest,
});
assert.equal(genericVisual.candidate.decision, "rejected");
assert.ok(genericVisual.candidate.blockers.includes("runtime_player_asset_unused"));

const rejected = buildGameProductionRun({ spec, assetManifest: null });
assert.equal(rejected.candidate.decision, "rejected");
assert.ok(rejected.candidate.blockers.some((blocker) => blocker.includes("asset") || blocker.includes("background")));

const { agenticModule: _module, ...legacyArenaSpec } = spec;
const legacyArena = buildGameProductionRun({
  spec: { ...legacyArenaSpec, agenticPlayRoute: "dedicated" },
  assetManifest,
});
assert.equal(legacyArena.candidate.decision, "rejected");
assert.ok(legacyArena.candidate.blockers.includes("generic_phaser_runtime_retired"));

console.log("[OK] qa-game-production-orchestrator: six material passes, candidate promotion and real-playtest boundary are enforced");
