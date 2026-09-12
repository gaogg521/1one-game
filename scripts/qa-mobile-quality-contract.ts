import assert from "node:assert/strict";
import { GameDesignDocSchema } from "@/lib/game-forge/types";
import { buildDesignSystemPrompt, normalizeDesign } from "@/lib/game-forge/design-agent";
import { buildModuleDesignSummary, buildModuleSystemPrompt } from "@/lib/game-forge/code-agent";
import { evaluateAgenticVisualContract } from "@/lib/agentic/agentic-visual-contract";
import { mergePatchedCoreSpec } from "@/lib/spec-patch";
import { buildGameQualityPolishInstruction, selectGameQualityPolishFindings, shouldScheduleGameQualityPolish } from "@/lib/game-preflight-iteration";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { coerceGameSpec } from "@/lib/normalize-spec";

/**
 * Platform-wide mobile quality contract. Every generated game is delivered into
 * a 393x852 portrait iframe, so portrait framing, a visible protagonist and a
 * survivable first minute are generation requirements, not per-game polish.
 */

function designDoc(stage: Record<string, unknown>) {
  return GameDesignDocSchema.parse({
    title: "星轨快递",
    pitch: "驾驶补给船穿过陨石带把物资送到前哨站。",
    genre: "avoider",
    stage,
    coreLoop: ["拖动飞船躲避陨石", "收集能量星补充护盾", "抵达前哨站结算"],
    controls: [{ action: "move", desktop: "WASD", touch: "drag" }],
    mechanics: [
      { id: "dodge", summary: "拖动飞船躲开迎面而来的陨石", observable: "陨石擦过飞船时屏幕轻微震动" },
      { id: "collect", summary: "吃到能量星补充一格护盾", observable: "护盾条增加一格并弹出得分" },
    ],
    progression: {
      winCondition: "60 秒内累计得到 30 分",
      loseCondition: "累计碰撞 3 次陨石",
      beats: [
        { at: 0.3, label: "加速", change: "陨石速度提升到 70%" },
        { at: 0.8, label: "密集", change: "同屏陨石增加到 4 个" },
      ],
    },
    gameFeel: ["爆炸粒子", "命中顿帧"],
    configShape: ["player.size", "run.duration"],
    assets: [{ key: "ship", kind: "player", prompt: "blue supply ship", required: true }],
    audio: { cues: [{ event: "pickup", sfx: "coin" }] },
    modules: [
      { id: "game_config", role: "config", brief: "assign G.config with stage size, ship speed and spawn tuning numbers", provides: ["config"], requires: [], signatures: [] },
      { id: "main_game", role: "main", brief: "wire the modules together and own the init/update/draw/restart callbacks", provides: ["main"], requires: ["config"], signatures: [{ name: "main", params: ["g"] }] },
    ],
  });
}

function main() {
  // 1. Portrait is the default framing, not landscape.
  const defaults = designDoc({ background: "#0b1020" }).stage;
  assert.equal(defaults.orientation, "portrait", JSON.stringify(defaults));
  assert.ok(defaults.height > defaults.width, "an omitted stage must default upright");

  // 2. "either" is a hedge; delivery resolves it to the phone it ships on.
  const hedged = normalizeDesign(designDoc({ width: 960, height: 540, orientation: "either", background: "#0b1020" })).stage;
  assert.equal(hedged.orientation, "portrait");
  assert.ok(hedged.height > hedged.width, `either must resolve upright, got ${hedged.width}x${hedged.height}`);

  // 3. An explicit landscape request is still honoured.
  const wide = normalizeDesign(designDoc({ width: 540, height: 960, orientation: "landscape", background: "#0b1020" })).stage;
  assert.equal(wide.orientation, "landscape");
  assert.ok(wide.width > wide.height);

  // 4. The prompt skeleton models must copy is itself portrait.
  const designPrompt = buildDesignSystemPrompt();
  assert.match(designPrompt, /"orientation":\s*"portrait"/, "the literal skeleton is what models copy");
  assert.doesNotMatch(designPrompt, /"orientation":\s*"landscape"/);
  for (const clause of [/393x852/, /9% of the stage/, /48 virtual pixels/, /first 60 seconds must be survivable/, /1\.5 seconds/]) {
    assert.match(designPrompt, clause, `design contract missing ${clause}`);
  }

  // 5. Every module agent sees the same numbers, derived from the real stage.
  const summary = buildModuleDesignSummary(normalizeDesign(designDoc({ width: 540, height: 960, orientation: "portrait", background: "#0b1020" })));
  assert.match(summary, /PHONE DELIVERY/);
  // 540 shorter axis * 9% = 49px, above the 48px absolute floor.
  assert.match(summary, /Player actor >= 49px/, summary);
  assert.match(buildModuleDesignSummary(normalizeDesign(designDoc({ width: 360, height: 640, orientation: "portrait", background: "#0b1020" }))), /Player actor >= 48px/, "the absolute floor holds on a small stage");
  assert.match(summary, /<=1 threat before 10s/);
  const modulePrompt = buildModuleSystemPrompt();
  for (const clause of [/Phone delivery bar/, /Math\.min\(g\.width, g\.height\) \* 0\.09/, /at least 3 mistakes/]) {
    assert.match(modulePrompt, clause, `module contract missing ${clause}`);
  }

  // 6. The visual contract must recognise the Forge idiom. Matching only the
  // DOM `new Image()` idiom reported runtime_sprite_actor_missing against every
  // correct Forge build, which is how a shipped game read as visually broken.
  const spec = mockSpecFromPrompt("太空快递", { templateId: "avoider" });
  const forgeSource = [
    "var ship = g.assets.image(ctx.assets.player, 'player', '#4da3ff');",
    "var rock = g.assets.image(ctx.assets.enemy, 'enemy', '#ff5a5a');",
    "var sky = g.assets.image(ctx.assets.background, 'background', '#0b1020');",
    "r.sprite(ship, p.x, p.y, 64, 64);",
  ].join("\n");
  const forge = evaluateAgenticVisualContract(spec, { version: 2, entry: "mountGame", source: forgeSource });
  assert.deepEqual(forge.blockers, [], JSON.stringify(forge));
  assert.equal(forge.ok, true);

  // The legacy DOM idiom still passes, and geometry-only still fails.
  const legacy = evaluateAgenticVisualContract(spec, {
    version: 2,
    entry: "mountGame",
    source: "var i=new Image();i.src=ctx.assets.player;ctx.assets.enemy;ctx.assets.background;",
  });
  assert.deepEqual(legacy.blockers, []);
  const geometry = evaluateAgenticVisualContract(spec, {
    version: 2,
    entry: "mountGame",
    source: "ctx.fillRect(0,0,100,100);",
  });
  assert.ok(geometry.blockers.includes("runtime_sprite_actor_missing"));
  assert.ok(geometry.blockers.includes("runtime_player_asset_unused"));

  // 7. A spec patch may not silently drop what the model was never asked to
  // emit. The structured schema covers core fields only, so everything else --
  // the forge build above all -- is preserved by construction.
  const base = coerceGameSpec({
    ...spec,
    forgeBuild: { version: 1, design: { title: "keep me" }, modules: [{ id: "main_game", source: "//x" }] },
  });
  const withForge = base.ok ? base.spec : spec;
  const merged = mergePatchedCoreSpec(withForge, {
    title: "太空快递 Pro",
    templateId: "farming",
    gameplay: { hazardSpeed: 140 },
    theme: { playerColor: "#4da3ff" },
  }) as Record<string, unknown>;
  assert.equal(merged.title, "太空快递 Pro");
  assert.equal((merged.gameplay as { hazardSpeed: number }).hazardSpeed, 140);
  assert.equal((merged.gameplay as { playerSpeed: number }).playerSpeed, withForge.gameplay.playerSpeed, "untouched gameplay fields survive");
  assert.equal(merged.templateId, withForge.templateId, "a patch must not swap the template out from under the built runtime");
  assert.deepEqual(merged.forgeBuild, withForge.forgeBuild, "the generated runtime must survive a spec patch");
  assert.deepEqual(merged.production, withForge.production);
  assert.equal(mergePatchedCoreSpec(withForge, "not an object"), null);

  // 8. A playable-but-poor build must trigger exactly one background polish
  // round. Before this, every quality finding died as evidence nobody read.
  const observed = [
    "visual_review_rejected",
    "real_agent_missing:audio_agent",
    "advisory:runtime_letterboxed",
    "advisory:required_asset_missing:ship",
    "runtime_sprite_actor_missing",
    "vertical_slice_blocked",
  ];
  const findings = selectGameQualityPolishFindings(observed);
  assert.deepEqual(findings.sort(), ["runtime_letterboxed", "runtime_sprite_actor_missing", "vertical_slice_blocked"], JSON.stringify(findings));
  assert.equal(selectGameQualityPolishFindings(["visual_review_rejected", "real_agent_missing:audio_agent"]).length, 0, "noisy advisories must not burn a production round");

  assert.equal(shouldScheduleGameQualityPolish({ productionRound: 1, maxProductionRounds: 3, findings }), true);
  assert.equal(shouldScheduleGameQualityPolish({ productionRound: 1, maxProductionRounds: 3, findings: [] }), false, "a clean build is left alone");
  // The polish job produces a round-2 build; polish must not fire again there,
  // or a single game would regenerate itself forever.
  assert.equal(shouldScheduleGameQualityPolish({ productionRound: 2, maxProductionRounds: 3, findings }), false, "polish is one round deep");
  assert.equal(shouldScheduleGameQualityPolish({ productionRound: 3, maxProductionRounds: 5, findings }), false);

  const polishInstruction = buildGameQualityPolishInstruction(findings);
  assert.match(polishInstruction, /已经可以玩/, "polish must not read as a failure");
  assert.match(polishInstruction, /g\.width \/ g\.height/);
  assert.match(polishInstruction, /1\.5 秒无敌/);
  assert.match(polishInstruction, /9%/);
  assert.doesNotMatch(polishInstruction, /vertical_slice_blocked/, "raw codes must be translated into an actionable ask");

  console.log("[OK] mobile quality contract: portrait framing, actor floor, first-minute envelope, forge asset use, patch preserves the built runtime, one bounded polish round");
}

main();
