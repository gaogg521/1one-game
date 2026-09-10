/**
 * GameForge deterministic regression.
 *
 * Covers the parts of the pipeline that must hold without a model in the loop:
 * assembly, dependency ordering, and every audit that decides whether a build
 * is allowed to reach a player. No assertion here may be satisfiable by a
 * keyword in a comment — that was exactly how the previous gates were fooled.
 */
import assert from "node:assert/strict";
import { assembleGame, checkBalanced, checkSyntax, orderModules, scanForbidden, stripCommentsAndStrings } from "../src/lib/game-forge/assemble";
import { auditBuildShape, auditCallSignatures, auditConfigPaths, auditSdkUsage, auditSharedStateReads, auditStatic } from "../src/lib/game-forge/qa-agent";
import { validateModulePlan } from "../src/lib/game-forge/design-agent";
import { checkRoleContract } from "../src/lib/game-forge/code-agent";
import { GAME_FORGE_SDK_SOURCE } from "../src/lib/game-forge/runtime-sdk";
import { SDK_SURFACE } from "../src/lib/game-forge/sdk-surface";
import type { GameDesignDoc, GameModule } from "../src/lib/game-forge/types";

const design: GameDesignDoc = {
  title: "Lantern Drift",
  pitch: "Steer a paper lantern through a night river, gathering embers before the wind dies.",
  genre: "arcade collector",
  stage: { width: 960, height: 540, orientation: "landscape", background: "#0b1020" },
  coreLoop: ["Steer the lantern", "Collect embers to refill the flame", "Dodge rain gusts", "Reach the shrine before the flame dies"],
  controls: [{ action: "steer", desktop: "WASD / arrows", touch: "virtual stick" }],
  mechanics: [
    { id: "flame_decay", summary: "The flame drains over time and refills on ember pickup.", observable: "the flame meter shrinks each second" },
    { id: "gust_hazard", summary: "Rain gusts push the lantern and cost flame on contact.", observable: "the lantern is shoved sideways" },
  ],
  progression: {
    winCondition: "Reach 30 embers before the flame empties",
    loseCondition: "The flame meter reaches zero",
    beats: [{ at: 0.3, label: "Wind rises", change: "gusts spawn 40% faster" }, { at: 0.7, label: "Storm", change: "gusts travel diagonally" }],
  },
  gameFeel: ["embers pop with a warm burst", "gust impacts shake the camera"],
  assets: [
    { key: "background", kind: "background", prompt: "night river", required: false },
    { key: "lantern", kind: "player", prompt: "paper lantern", required: true },
    { key: "gust", kind: "enemy", prompt: "rain gust", required: false },
  ],
  audio: { cues: [{ event: "pickup", sfx: "coin" }] },
  modules: [
    { id: "config", role: "config", brief: "tuning numbers", provides: ["config"], requires: [] },
    { id: "entities", role: "system", brief: "spawn logic", provides: ["spawnEmber", "spawnGust"], requires: ["config"] },
    { id: "render", role: "system", brief: "drawing", provides: ["drawScene"], requires: ["config"] },
    { id: "main", role: "main", brief: "wire it up", provides: ["main"], requires: ["spawnEmber", "drawScene"] },
  ],
};

function mod(id: string, role: GameModule["role"], source: string, provides: string[] = [], requires: string[] = []): GameModule {
  return { id, role, source, provides, requires };
}

/* ------------------------------------------------- strip comments/strings */
{
  const stripped = stripCommentsAndStrings(`
    // merge combine tier
    var label = "merge combine tier";
    /* merge combine tier */
    var real = 1;
  `);
  assert.ok(!stripped.includes("merge"), "a mechanic named only in comments or strings must not read as implemented");
  assert.ok(stripped.includes("real"), "executable code must survive stripping");
}

/* ------------------------------------------------------- forbidden APIs */
{
  assert.equal(scanForbidden("m", "var d = fetch('/x');").length, 1, "network access must be a blocker");
  assert.equal(scanForbidden("m", "requestAnimationFrame(tick);").length, 1, "an own game loop must be a blocker");
  assert.equal(scanForbidden("m", "localStorage.setItem('a', 1);").length, 1, "storage must be a blocker");
  assert.equal(scanForbidden("m", "root.addEventListener('click', f);").length, 1, "own listeners must be a blocker");
  assert.equal(scanForbidden("m", "// fetch('/x') is not allowed here\nvar a = 1;").length, 0, "a forbidden call inside a comment is not a violation");
}

/* --------------------------------------------------- javascript syntax */
{
  // The real defect this exists for: balanced braces, valid-looking, and not
  // parseable — which kills the whole assembled script block in the browser.
  const bad = checkSyntax("spawn", "function G.tickSpawns(dt, g) { return 1; }", "system");
  assert.equal(bad.length, 1, "`function G.name(...)` must be reported");
  assert.equal(bad[0]!.code, "syntax_error");
  assert.equal(bad[0]!.severity, "blocker");
  assert.equal(checkBalanced("spawn", "function G.tickSpawns(dt, g) { return 1; }").length, 0, "brace balance alone cannot catch it — which is why the syntax check is needed");

  assert.deepEqual(checkSyntax("spawn", "G.tickSpawns = function (dt, g) { return 1; };", "system"), [], "the correct assignment form must pass");
  assert.deepEqual(checkSyntax("cfg", "G.config = { a: 1 };", "config"), [], "a config body must pass");
  // A config body is compiled with (G) only, so referencing g must fail there
  // and pass in a system module.
  assert.deepEqual(checkSyntax("sys", "var x = g.width;", "system"), [], "a system body may reference g");
  assert.equal(checkSyntax("m", "var x = ;", "system").length, 1, "plain malformed code must be reported");
}

/* -------------------------------------------------------- truncation */
{
  assert.equal(checkBalanced("m", "function a() { return 1; }").length, 0);
  const truncated = checkBalanced("m", "function a() { if (x) { return 1;");
  assert.equal(truncated.length, 1, "an unclosed block must be reported");
  assert.equal(truncated[0]!.code, "truncated");
}

/* ------------------------------------------------ duplicate HUD owners */
{
  const duplicate = assembleGame(design, [
    mod("config", "config", "G.config = {};"),
    mod("hud", "system", "G.drawHUD = function(g) { g.draw.text('Score', 10, 10); };", ["drawHUD"]),
    mod("main", "main", "G.main = function(g) { g.ui.hud([{ label: 'Score', value: 0 }]); g.start({ draw: function(r,g) { G.drawHUD(g); } }); };", ["main"], ["drawHUD"]),
  ]);
  assert.ok(duplicate.findings.some((finding) => finding.code === "duplicate_hud"), "two HUD owners must be rejected before they draw duplicate labels");
}

/* ------------------------------------------ SDK state must stay singular */
{
  const splitState = assembleGame(design, [
    mod("config", "config", "G.config = {};"),
    mod("collision", "system", "G.hit = function(g) { g.addScore(10); g.loseLife(); };", ["hit"]),
    mod("hud", "system", "G.drawHUD = function(g) { g.draw.text(String(G.state.score) + String(G.state.lives), 10, 10); };", ["drawHUD"]),
    mod("main", "main", "G.main = function(g) { G.state = { score: 0, lives: 3 }; g.start({ draw: function(r,g) { G.drawHUD(g); } }); };", ["main"], ["drawHUD"]),
  ]);
  assert.ok(splitState.findings.some((finding) => finding.code === "score_state_split"), "g.addScore with G.state.score must be rejected");
  assert.ok(splitState.findings.some((finding) => finding.code === "lives_state_split"), "g.loseLife with G.state.lives must be rejected");
}

/* -------------------------------------------- timers must actually expire */
{
  const brokenTimers = assembleGame(design, [
    mod("config", "config", "G.config = {};"),
    mod("collision", "system", "G.hit = function(g) { var player=G.player; if(player.invincible>0)return; player.invincible=1.2; };", ["hit"]),
    mod("main", "main", "G.main = function(g) { g.start({ update: function(dt,g) { g.state.time += dt; } }); };", ["main"]),
  ]);
  assert.ok(brokenTimers.findings.some((finding) => finding.code === "sdk_time_manually_advanced"), "manual SDK time advancement must be rejected");
  assert.ok(brokenTimers.findings.some((finding) => finding.code === "invincibility_never_expires"), "a permanent damage immunity timer must be rejected");

  const expiring = assembleGame(design, [
    mod("config", "config", "G.config = {};"),
    mod("collision", "system", "G.hit = function(g) { var player=G.player; if(player.invincible>0)return; player.invincible=1.2; }; G.tick=function(dt){if(G.player.invincible>0)G.player.invincible-=dt;};", ["hit", "tick"]),
    mod("main", "main", "G.main = function(g) { g.start({ update: function(dt,g) { var elapsed=g.state.time; G.tick(dt); } }); };", ["main"], ["tick"]),
  ]);
  assert.ok(!expiring.findings.some((finding) => finding.code === "sdk_time_manually_advanced" || finding.code === "invincibility_never_expires"), "SDK-owned time plus an expiring immunity timer must pass");
}

/* --------------------------------------- entity discriminator consistency */
{
  const mismatched = assembleGame(design, [
    mod("config", "config", "G.config = {};"),
    mod("spawn", "system", "G.spawnStar=function(g){g.world.spawn('star',{x:10,y:10});};", ["spawnStar"]),
    mod("collision", "system", "G.hit=function(g){g.world.each('star',function(e){if(e.kind==='star')g.addScore(1);});};", ["hit"]),
    mod("main", "main", "G.main=function(g){g.start({init:function(){G.spawnStar(g);},update:function(){G.hit(g);}});};", ["main"], ["spawnStar", "hit"]),
  ]);
  assert.ok(mismatched.findings.some((finding) => finding.code === "entity_discriminator_mismatch"), "spawned entity.type checked as entity.kind must be rejected");
}

/* ------------------------------------------- renderer binding contract */
{
  const plan = { id: "hud", role: "system" as const, brief: "draw hud", provides: ["drawHud"], requires: [], signatures: [{ name: "drawHud", params: ["g"] }] };
  const bad = checkRoleContract(plan, "G.drawHud=function(g){r.ui.begin();r.text('x',1,1);r.ui.end();};");
  assert.ok(bad.some(f => f.code === "renderer_unbound" && f.moduleId === "hud"), "an undeclared r must be repaired in its owning system module");
  assert.ok(!checkRoleContract(plan, "G.drawHud=function(g){g.draw.ui.begin();g.draw.text('x',1,1);g.draw.ui.end();};").some(f => f.code === "renderer_unbound"));
  assert.ok(!checkRoleContract(plan, "G.drawHud=function(r,g){r.ui.begin();r.ui.end();};").some(f => f.code === "renderer_unbound"));
}

/* ------------------------------------------------- hallucinated SDK APIs */
{
  const ok = auditSdkUsage("m", "g.audio.sfx('coin'); g.fx.shake(10, 0.3); g.world.spawn('ember', {});");
  assert.equal(ok.length, 0, "valid SDK members must not be flagged");

  const bad = auditSdkUsage("m", "g.physics.step(); g.input.onSwipeLeft(f); g.audio.playSound('boom');");
  const codes = bad.filter((f) => f.code === "unknown_sdk_member").map((f) => f.message);
  assert.ok(codes.some((m) => m.includes("g.physics")), "an invented engine namespace must be a blocker");
  assert.ok(codes.some((m) => m.includes("input.onSwipeLeft")), "an invented input method must be a blocker");
  assert.ok(codes.some((m) => m.includes("audio.playSound")), "an invented audio method must be a blocker");
  assert.ok(bad.every((f) => f.severity === "blocker" || f.code === "unknown_sfx"));

  const badSfx = auditSdkUsage("m", "g.audio.sfx('kaboom');");
  assert.equal(badSfx.length, 1);
  assert.equal(badSfx[0]!.code, "unknown_sfx");
}

/* -------------------------------------------- cross-module call signatures */
{
  // The exact shape of the real bug this check exists for: one module
  // declares a 1-argument function, a sibling calls it with 2 arguments (or
  // vice versa) because it only ever saw the bare name, never a signature.
  const signedDesign: GameDesignDoc = {
    ...design,
    modules: [
      { id: "config", role: "config", brief: "tuning", provides: ["config"], requires: [], signatures: [] },
      { id: "player", role: "system", brief: "player state", provides: ["updatePlayer"], requires: ["config"], signatures: [{ name: "updatePlayer", params: ["player", "g"] }] },
      { id: "main", role: "main", brief: "wire it up", provides: ["main"], requires: ["updatePlayer"], signatures: [{ name: "main", params: ["g"] }] },
    ],
  };
  const goodCall = auditCallSignatures(signedDesign, [
    mod("main", "main", "G.main = function (g) { G.updatePlayer(state, g); };"),
  ]);
  assert.deepEqual(goodCall, [], "a call matching the declared arity must not be flagged");

  const wrongArity = auditCallSignatures(signedDesign, [
    mod("main", "main", "G.main = function (g) { G.updatePlayer(state); };"),
  ]);
  assert.equal(wrongArity.length, 1, "a call with the wrong argument count must be flagged");
  assert.equal(wrongArity[0]!.code, "signature_mismatch");
  assert.equal(wrongArity[0]!.moduleId, "main", "the finding must attribute to the CALLING module, not the definer");
  assert.equal(wrongArity[0]!.severity, "blocker");

  // The definition site itself (`G.updatePlayer = function (player, g) {...}`)
  // must never be mistaken for a call.
  const definitionOnly = auditCallSignatures(signedDesign, [
    mod("player", "system", "G.updatePlayer = function (player, g) { player.x += g.width; };"),
  ]);
  assert.deepEqual(definitionOnly, [], "a function definition must not be flagged as a mismatched call");

  // A provided name with NO signature is a data value. Calling it is the
  // "G.config is not a function" first-frame crash.
  const calledData = auditCallSignatures(signedDesign, [
    mod("main", "main", "G.main = function (g) { var c = G.config(); };"),
  ]);
  assert.equal(calledData.length, 1, "calling a data value must be flagged");
  assert.equal(calledData[0]!.code, "data_called_as_function");
  assert.equal(calledData[0]!.severity, "blocker");

  const readData = auditCallSignatures(signedDesign, [
    mod("main", "main", "G.main = function (g) { var s = G.config.player.speed; };"),
  ]);
  assert.deepEqual(readData, [], "reading a data value's fields must not be flagged");
}

/* ---------------------------------------------------- config path shape */
{
  // The real bug this exists for: config.player.jumpVelocity was declared,
  // but a system module read the leaf name flattened at the top level.
  const shapedDesign: GameDesignDoc = { ...design, configShape: ["player.jumpVelocity", "player.gravity", "goals.targetShoots"] };

  const flattened = auditConfigPaths(shapedDesign, [
    mod("player", "system", "var v = cfg.jumpVelocity; var g2 = cfg.gravity;"),
  ]);
  assert.equal(flattened.length, 2, "reading a declared leaf name flattened must be flagged once per leaf");
  assert.ok(flattened.every((f) => f.code === "config_path_flattened"));
  assert.ok(flattened[0]!.message.includes("player.jumpVelocity"), "the message must name the correct nested path");

  const nested = auditConfigPaths(shapedDesign, [
    mod("player", "system", "var v = cfg.player.jumpVelocity; var t = cfg.goals.targetShoots;"),
  ]);
  assert.deepEqual(nested, [], "reading through the declared nested path must not be flagged");

  const configModuleItself = auditConfigPaths(shapedDesign, [
    mod("config", "config", "G.config = { jumpVelocity: 1 };"),
  ]);
  assert.deepEqual(configModuleItself, [], "the config module defines the shape and is never itself audited against it");

  const noShapeDeclared = auditConfigPaths({ ...design, configShape: [] }, [
    mod("player", "system", "var v = cfg.jumpVelocity;"),
  ]);
  assert.deepEqual(noShapeDeclared, [], "with no declared shape there is nothing to cross-check against");
}

/* ------------------------------------------- undeclared shared state read */
{
  // The real defect: two core systems opened with `var p = G.player; if (!p) return;`
  // while nothing ever assigned G.player, so both silently no-oped every frame
  // and the build still looked green.
  const planned: GameDesignDoc = {
    ...design,
    modules: [
      { id: "config", role: "config", brief: "tuning", provides: ["config"], requires: [], signatures: [] },
      { id: "player", role: "system", brief: "movement", provides: ["updatePlayer"], requires: ["config"], signatures: [{ name: "updatePlayer", params: ["dt", "g"] }] },
      { id: "main", role: "main", brief: "wire", provides: ["main"], requires: ["updatePlayer"], signatures: [{ name: "main", params: ["g"] }] },
    ],
  };

  const ghost = auditSharedStateReads(planned, [
    mod("player", "system", "G.updatePlayer = function (dt, g) { var p = G.player; if (!p) return; p.x += 1; };"),
  ]);
  assert.equal(ghost.length, 1, "reading a G name nobody provides must be flagged");
  assert.equal(ghost[0]!.code, "undeclared_shared_state");
  assert.equal(ghost[0]!.severity, "blocker");
  assert.ok(ghost[0]!.message.includes("G.player"));

  // Assigning it in any module makes it legitimate, declared in the plan or not.
  const assigned = auditSharedStateReads(planned, [
    mod("player", "system", "G.player = { x: 0 }; G.updatePlayer = function (dt, g) { var p = G.player; p.x += 1; };"),
  ]);
  assert.deepEqual(assigned, [], "a name assigned by some module is not undeclared");

  // Names the assembler itself puts on G are always in scope.
  const builtins = auditSharedStateReads(planned, [
    mod("main", "main", "G.main = function (g) { var t = G.ctx.title; var c = G.config; var d = G.design; };"),
  ]);
  assert.deepEqual(builtins, [], "G.ctx / G.config / G.design are provided by the assembler");
}

/* ----------------------------------------------------- build shape audit */
{
  const empty = auditBuildShape(design, [mod("main", "main", "G.main = function (g) { g.start({}); };")]);
  const codes = empty.map((f) => f.code);
  for (const expected of ["no_win_path", "no_lose_path", "no_artwork", "silent_build", "no_touch_input", "no_hud"]) {
    assert.ok(codes.includes(expected), `an empty build must report ${expected}`);
  }
  assert.ok(codes.includes("required_asset_unused"), "a required asset slot that is never read must be reported");

  const complete = auditBuildShape(design, [mod("main", "main", `
    var art = g.assets.image(ctx.assets.lantern, 'player', '#f59e0b');
    G.main = function (g) {
      g.start({
        update: function (dt) {
          var a = g.input.axis();
          if (a.x) { g.audio.sfx('coin'); g.fx.burst(10, 10, {}); }
          if (g.state.score >= 30) g.win(g.state.score);
          if (g.state.time > 90) g.lose(0);
        },
        draw: function (r) { r.sprite(art, 10, 10, 32, 32); g.ui.hud([{ label: 'S', value: g.state.score }]); }
      });
    };
  `)]);
  assert.deepEqual(complete.map((f) => f.code), [], "a complete build must produce no shape findings");
}

/* ------------------------------------------------------------- ordering */
{
  const modules = [
    mod("main", "main", "G.main = function (g) { g.start({}); };", ["main"], ["drawScene"]),
    mod("render", "system", "G.drawScene = function () {};", ["drawScene"], ["config"]),
    mod("config", "config", "G.config = { width: 960 };", ["config"], []),
  ];
  const { ordered, findings } = orderModules(modules);
  assert.deepEqual(ordered.map((m) => m.id), ["config", "render", "main"], "modules must be ordered config -> systems -> main");
  assert.deepEqual(findings, []);
}

/* ------------------------------------------------------------- assembly */
{
  const modules = [
    mod("config", "config", "G.config = { width: 960, height: 540, lives: 3 };", ["config"], []),
    mod("entities", "system", "G.spawnEmber = function () { return g.world.spawn('ember', { x: 10, y: 10 }); };", ["spawnEmber"], ["config"]),
    mod("main", "main", "G.main = function (g) { g.start({ init: function () { G.spawnEmber(); } }); };", ["main"], ["spawnEmber"]),
  ];
  const { source, findings } = assembleGame(design, modules);
  assert.deepEqual(findings.filter((f) => f.severity === "blocker"), [], "a well formed build must assemble without blockers");
  assert.ok(/function mountGame\(root, ctx\)/.test(source), "assembly must expose the mountGame entry point");
  assert.ok(source.indexOf("MOD_config(G);") < source.indexOf("MOD_entities(G, g);"), "config must run before systems");
  assert.ok(source.includes("G.main(g);"), "assembly must invoke the main module");
  assert.ok(source.includes("GameForge.create(root,"), "assembly must construct the engine");
  // The assembled file has to be syntactically valid JavaScript.
  assert.doesNotThrow(() => new Function(`${GAME_FORGE_SDK_SOURCE.replace("(function (global)", "(function (global_unused)").replace("})(window);", "});")}\n${source}`), "the assembled runtime must parse");
}

/* --------------------------------------------------- missing main module */
{
  const { findings } = assembleGame(design, [mod("config", "config", "G.config = {};", ["config"], [])]);
  assert.ok(findings.some((f) => f.code === "main_missing"), "a build with no main module must be blocked");
}

/* -------------------------------------------------- static audit rollup */
{
  const modules = [
    mod("config", "config", "G.config = { width: 960 };", ["config"], []),
    mod("main", "main", "G.main = function (g) { g.start({}); }; g.nonsense();", ["main"], []),
  ];
  const findings = auditStatic(design, modules);
  assert.ok(findings.some((f) => f.code === "unknown_sdk_member"), "the rollup must include SDK surface violations");
  assert.ok(findings.some((f) => f.severity === "blocker"), "a hallucinated API must block the build");
}

/* ------------------------------------------------------------ SDK parses */
{
  assert.doesNotThrow(() => new Function(GAME_FORGE_SDK_SOURCE), "the runtime SDK must be valid JavaScript");
  assert.ok(GAME_FORGE_SDK_SOURCE.includes("global.GameForge ="), "the SDK must publish the GameForge global");
  for (const forbidden of ["fetch(", "localStorage", "XMLHttpRequest"]) {
    assert.ok(!GAME_FORGE_SDK_SOURCE.includes(forbidden), `the SDK itself must not use ${forbidden}`);
  }
}

/* ------------------------------- aliased SDK subsystems ---------------- */
{
  // Observed in a real build: `const r = g.draw;` then `r.ellipse(...)`.
  // Every accessor pattern anchors on "g.", so the alias escaped all of them;
  // `draw` was not even a listed table despite being the same object as `r`.
  // The audit reported zero findings and the game threw
  // "r.ellipse is not a function" before rendering a frame.
  const flagged = (source: string) =>
    auditSdkUsage("m", source).some((f) => f.code === "unknown_sdk_member");

  assert.ok(flagged("const r = g.draw;\nr.ellipse(1,2,3,4);"), "a fake member on an aliased subsystem must be caught");
  assert.ok(flagged("g.draw.ellipse(1,2,3,4);"), "g.draw must be checked, not only g.r");
  assert.ok(flagged("g.r.ellipse(1,2,3,4);"), "g.r must still be checked");
  assert.ok(!flagged("const r = g.draw;\nr.circle(1,2,3);\nr.rect(0,0,4,4);"), "real renderer members through an alias must pass");
  assert.ok(!flagged("var assets = g.assets;\nassets.image('u','player','#fff');"), "real members on any aliased subsystem must pass");
  // `var w = g.width` aliases a number, not a table; treating it as one would
  // flag every method call on it.
  assert.ok(!flagged("var w = g.width;\nw.toFixed(2);"), "a value alias must not be audited as a subsystem");

  // g.draw and g.r are the same object in the SDK, so their surfaces must not
  // drift apart.
  assert.deepStrictEqual(SDK_SURFACE.draw, SDK_SURFACE.r, "g.draw and g.r are the same object and must list the same members");
}

/* ------------------------------- ambiguous signature parameters -------- */
{
  // Observed in a real build: the plan declared "tickPlayer(dt, g, input)".
  // The caller passed the {x,y} vector g.input.axis() returned; the callee
  // read the same name as the input SYSTEM and called .axis() on the vector.
  // The game threw on its first frame and every static check stayed green,
  // because arity matched and both modules used only real SDK members. The
  // parameter NAME was the defect, so the plan must not survive validation.
  const plan = (params: string[]) =>
    ({
      title: "t", pitch: "p", genre: "arcade",
      modules: [
        { id: "cfg", role: "config", brief: "b", provides: ["config"], requires: [], signatures: [] },
        { id: "sys", role: "system", brief: "b", provides: ["tickPlayer"], requires: ["config"], signatures: [{ name: "tickPlayer", params }] },
        { id: "main", role: "main", brief: "b", provides: ["main"], requires: ["config", "tickPlayer"], signatures: [{ name: "main", params: ["g"] }] },
      ],
    }) as unknown as Parameters<typeof validateModulePlan>[0];

  const rejected = validateModulePlan(plan(["dt", "g", "input"]));
  assert.ok(!rejected.ok, "a signature parameter named after an engine subsystem must be rejected");
  assert.match(rejected.ok ? "" : rejected.reason, /ambiguous_param/, "the rejection must name the ambiguity");

  for (const name of ["audio", "assets", "fx", "ui", "world", "draw", "stage", "rng"]) {
    assert.ok(!validateModulePlan(plan(["dt", "g", name])).ok, `"${name}" is an engine subsystem and must not be a parameter name`);
  }

  // Naming the value instead of the system is the fix, and must pass.
  assert.ok(validateModulePlan(plan(["dt", "g", "axis"])).ok, '"axis" names the value being passed and must be accepted');
  assert.ok(validateModulePlan(plan(["dt", "g", "player"])).ok, "entity parameters must still be accepted");
}

console.log("[OK] qa-game-forge: assembly, ordering, SDK-surface audit, build-shape and signature-ambiguity gates hold");
