import assert from "node:assert/strict";
import { buildGameProductionRun } from "@/lib/game-production-orchestrator";
import { buildDefaultGameProductionContract } from "@/lib/game-production-contract";
import { buildGameArtDirection } from "@/lib/game-art-direction";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import type { RealAgentExecution } from "@/lib/game-production-agents";

const prompt = "制作一款有采集、建造、敌人和超能力的体素沙盒游戏";
const base = mockSpecFromPrompt(prompt, { templateId: "survivor" });
const coffeeDirection = buildGameArtDirection(base, null, "温暖手绘咖啡店，猫咪陪伴玩家完成咖啡订单");
assert.match(coffeeDirection.promptSuffix, /咖啡店/);
assert.equal(coffeeDirection.creatorIntent, "温暖手绘咖啡店，猫咪陪伴玩家完成咖啡订单");
const independentFixture = `function mountGame(root, ctx) {
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540; root.replaceChildren(canvas);
  const g = canvas.getContext('2d'); const background = new Image(); const player = new Image(); const enemy = new Image();
  background.src = ctx.assets.background || ''; player.src = ctx.assets.player || ''; enemy.src = ctx.assets.enemy || '';
  let resource = 0, structure = 0, energy = 3, finished = false;
  function draw() { g.fillRect(0, 0, 960, 540); if (background.complete) g.drawImage(background, 0, 0, 960, 540); if (player.complete) g.drawImage(player, 420, 290, 96, 96); if (enemy.complete) g.drawImage(enemy, 690, 280, 96, 96); g.fillText('collect resource build structure power enemy', 40, 60); requestAnimationFrame(draw); }
  canvas.addEventListener('pointerdown', () => { resource += 1; structure += resource > 2 ? 1 : 0; energy -= 1; if (!finished && structure > 0) { finished = true; ctx.finish(true, resource); } }); draw();
}`;
const spec = {
  ...base,
  agenticPlayRoute: "agentic" as const,
  agenticModule: { version: 2 as const, entry: "mountGame" as const, source: independentFixture },
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
  bgm: { source: "audio_model", model: "qa-audio-model" },
};

const now = new Date(0).toISOString();
const realAgentExecutions: RealAgentExecution[] = (["design_director", "art_director", "scene_designer", "runtime_engineer", "audio_agent", "visual_review_agent"] as const).map((role) => ({
  role, provider: "qa-provider", model: "qa-model", status: "succeeded", startedAt: now, completedAt: now,
  inputDigest: `in-${role}`, outputDigest: `out-${role}`, mutates: [role],
}));
const realAgentOutputs = { design: {}, artDirection: {}, scene: {}, visualReview: { passed: true, score: 88, blockers: [], revisionInstructions: [], screenshotBytes: 4096 } };

const unlabeled = buildGameProductionRun({ spec, assetManifest });
assert.equal(unlabeled.candidate.decision, "rejected", "role labels without real model executions must fail closed");
assert.ok(unlabeled.candidate.blockers.includes("real_agent_missing:art_director"));
const run = buildGameProductionRun({ spec, assetManifest, realAgentExecutions, realAgentOutputs });
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
  spec: { ...spec, agenticModule: { version: 2, entry: "mountGame", source: "function mountGame(root, ctx) { root.textContent = 'empty'; ctx.finish(false, 0); }" } },
  assetManifest,
});
assert.equal(genericVisual.candidate.decision, "rejected");
assert.ok(genericVisual.candidate.blockers.includes("runtime_player_asset_unused"));

const racingPrompt = "四辆车按住加速，在铁路道口躲避列车，每轮最后一名淘汰，三轮决赛，包含实时名次、车库升级和杯赛进度";
const semanticFake = buildGameProductionRun({
  prompt: racingPrompt,
  spec: {
    ...spec,
    agenticModule: {
      version: 2,
      entry: "mountGame",
      source: `${independentFixture}\n/* cars train rounds garage cup */`,
    },
  },
  assetManifest,
});
assert.equal(semanticFake.candidate.decision, "rejected", "mechanics named only in comments must not pass");
assert.ok(semanticFake.candidate.blockers.includes("mechanic_missing:rail_hazard"));

const semanticSource = `function mountGame(root, ctx) {
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540; root.replaceChildren(canvas);
  const g = canvas.getContext('2d'); const background = new Image(); const player = new Image(); const enemy = new Image();
  background.src = ctx.assets.background || ''; player.src = ctx.assets.player || ''; enemy.src = ctx.assets.enemy || '';
  let cars = [], train = null, round = 1, rank = 4, speed = 0, eliminated = false, garageUpgrade = 0, cup = 0;
  canvas.addEventListener('pointerdown', () => { speed += 1; }); canvas.addEventListener('pointerup', () => { speed -= 1; });
  function draw() { if (background.complete) g.drawImage(background, 0, 0, 960, 540); if (player.complete) cars.push(player); if (enemy.complete) train = enemy; if (rank === cars.length) eliminated = true; if (round === 3) { cup += garageUpgrade + 1; ctx.finish(true, cup); } requestAnimationFrame(draw); } draw();
}`;
const semanticReady = buildGameProductionRun({
  prompt: racingPrompt,
  spec: { ...spec, agenticModule: { version: 2, entry: "mountGame", source: semanticSource } },
  assetManifest,
  realAgentExecutions,
  realAgentOutputs,
});
assert.equal(semanticReady.candidate.decision, "ready_for_playtest");

const rejected = buildGameProductionRun({ spec, assetManifest: null });
assert.equal(rejected.candidate.decision, "rejected");
assert.ok(rejected.candidate.blockers.some((blocker) => blocker.includes("asset") || blocker.includes("background")));

const { agenticModule: _module, ...legacyArenaSpec } = spec;
const legacyArena = buildGameProductionRun({
  spec: { ...legacyArenaSpec, agenticPlayRoute: "dedicated" },
  assetManifest,
});
assert.equal(legacyArena.candidate.decision, "rejected");
assert.ok(legacyArena.candidate.blockers.includes("independent_runtime_missing"));

console.log("[OK] qa-game-production-orchestrator: six material passes, candidate promotion and real-playtest boundary are enforced");
