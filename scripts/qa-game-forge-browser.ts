/**
 * Emits a real assembled GameForge build as a standalone HTML page so the
 * engine can be exercised in an actual browser.
 *
 * The modules below are hand-written the way a code agent is asked to write
 * them, and the page is byte-for-byte the same shape as the iframe srcDoc the
 * player receives. If this page runs, the SDK contract runs.
 */
import fs from "node:fs";
import path from "node:path";
import { assembleGame } from "../src/lib/game-forge/assemble";
import { auditStatic } from "../src/lib/game-forge/qa-agent";
import { GAME_FORGE_SDK_SOURCE } from "../src/lib/game-forge/runtime-sdk";
import type { GameDesignDoc, GameModule } from "../src/lib/game-forge/types";

const design: GameDesignDoc = {
  title: "Ember Drift",
  pitch: "Steer a lantern upriver, catch embers, dodge gusts before the flame dies.",
  genre: "arcade collector",
  stage: { width: 960, height: 540, orientation: "landscape", background: "#0a1224" },
  coreLoop: ["Steer the lantern", "Catch embers for score and flame", "Dodge gusts", "Reach the target score"],
  controls: [{ action: "steer", desktop: "WASD / arrows", touch: "virtual stick" }],
  mechanics: [
    { id: "flame_decay", summary: "Flame drains over time, embers refill it.", observable: "the flame bar shrinks" },
    { id: "gust_hazard", summary: "Gusts cost flame on contact.", observable: "screen shakes on contact" },
  ],
  progression: {
    winCondition: "Reach 12 embers",
    loseCondition: "Flame reaches zero",
    beats: [{ at: 0.4, label: "Wind rises", change: "gusts spawn faster" }, { at: 0.8, label: "Storm", change: "gusts move faster" }],
  },
  gameFeel: ["embers pop", "gusts shake the camera"],
  assets: [
    { key: "background", kind: "background", prompt: "night river", required: false },
    { key: "lantern", kind: "player", prompt: "paper lantern", required: false },
    { key: "gust", kind: "enemy", prompt: "rain gust", required: false },
    { key: "ember", kind: "collectible", prompt: "glowing ember", required: false },
  ],
  audio: { cues: [{ event: "pickup", sfx: "coin" }, { event: "damage", sfx: "hurt" }] },
  modules: [
    { id: "config", role: "config", brief: "tuning", provides: ["config"], requires: [] },
    { id: "art", role: "system", brief: "asset holders", provides: ["art"], requires: ["config"] },
    { id: "spawner", role: "system", brief: "spawn embers and gusts", provides: ["spawnEmber", "spawnGust", "tickSpawns"], requires: ["config"] },
    { id: "player", role: "system", brief: "lantern control", provides: ["makeLantern", "updateLantern"], requires: ["config"] },
    { id: "main", role: "main", brief: "wire and run", provides: ["main"], requires: ["art", "spawnEmber", "makeLantern"] },
  ],
};

const modules: GameModule[] = [
  {
    id: "config", role: "config", provides: ["config"], requires: [],
    source: `
G.config = {
  width: 960, height: 540, background: '#0a1224', lives: 3, seed: 20260905,
  lanternSpeed: 300, flameMax: 100, flameDrain: 6.5, flameGain: 14, gustCost: 22,
  targetEmbers: __TARGET_EMBERS__, emberEvery: 0.85, gustEvery: 1.5
};`,
  },
  {
    id: "art", role: "system", provides: ["art"], requires: ["config"],
    source: `
G.art = {
  bg: g.assets.image(ctx.assets.background, 'background', '#132a4a'),
  lantern: g.assets.image(ctx.assets.lantern, 'player', '#fbbf24'),
  gust: g.assets.image(ctx.assets.gust, 'enemy', '#60a5fa'),
  ember: g.assets.image(ctx.assets.ember, 'collectible', '#f97316')
};`,
  },
  {
    id: "spawner", role: "system", provides: ["spawnEmber", "spawnGust", "tickSpawns"], requires: ["config"],
    source: `
var cfg = G.config;
var emberTimer = 0, gustTimer = 0;

G.spawnEmber = function () {
  g.world.spawn('ember', { x: g.width + 30, y: g.rng.range(70, g.height - 70), vx: -g.rng.range(90, 150), r: 16 });
};

G.spawnGust = function () {
  var fast = g.state.time > 30;
  g.world.spawn('gust', { x: g.width + 40, y: g.rng.range(60, g.height - 60), vx: -g.rng.range(fast ? 200 : 130, fast ? 300 : 210), r: 24 });
};

G.tickSpawns = function (dt) {
  var rush = g.state.time > 18 ? 0.6 : 1;
  emberTimer -= dt;
  if (emberTimer <= 0) { emberTimer = cfg.emberEvery * rush; G.spawnEmber(); }
  gustTimer -= dt;
  if (gustTimer <= 0) { gustTimer = cfg.gustEvery * rush; G.spawnGust(); }
};`,
  },
  {
    id: "player", role: "system", provides: ["makeLantern", "updateLantern"], requires: ["config"],
    source: `
G.makeLantern = function () {
  return g.world.spawn('lantern', { x: g.width * 0.28, y: g.height / 2, r: 22, flame: G.config.flameMax });
};

G.updateLantern = function (dt, lantern) {
  var cfg = G.config;
  var a = g.input.axis();
  lantern.vx = a.x * cfg.lanternSpeed;
  lantern.vy = a.y * cfg.lanternSpeed;
  lantern.x = g.clamp(lantern.x, 30, g.width - 30);
  lantern.y = g.clamp(lantern.y, 30, g.height - 30);
  if (a.len > 0.05) g.fx.trail(lantern.x - 14, lantern.y + 6, '#fb923c', 3);
  lantern.flame -= cfg.flameDrain * dt;
  if (lantern.flame <= 0) { lantern.flame = 0; g.lose(g.state.score); }
};`,
  },
  {
    id: "main", role: "main", provides: ["main"], requires: ["art", "spawnEmber", "makeLantern"],
    source: `
G.main = function (g) {
  var lantern = null;
  var scroll = 0;

  function init() {
    lantern = G.makeLantern();
    g.ui.hint('Steer with WASD, arrows or the on-screen stick');
    g.ui.banner('Ember Drift', 'Catch ' + G.config.targetEmbers + ' embers', 1800);
  }

  function update(dt) {
    scroll += 42 * dt;
    G.tickSpawns(dt);
    G.updateLantern(dt, lantern);

    g.world.each('ember', function (e) { if (e.x < -40) g.world.kill(e); });
    g.world.each('gust', function (e) { if (e.x < -60) g.world.kill(e); });

    g.world.collide('lantern', 'ember', function (l, e) {
      g.world.kill(e);
      l.flame = Math.min(G.config.flameMax, l.flame + G.config.flameGain);
      g.audio.sfx('coin');
      g.fx.burst(e.x, e.y, { count: 16, color: '#fbbf24', speedMax: 200 });
      g.addScore(1, e.x, e.y);
      g.ui.clearHint();
      if (g.state.score >= G.config.targetEmbers) g.win(g.state.score);
    });

    g.world.collide('lantern', 'gust', function (l, e) {
      g.world.kill(e);
      l.flame -= G.config.gustCost;
      g.audio.sfx('hurt');
      g.fx.shake(16, 0.3);
      g.fx.freeze(70);
      g.fx.burst(e.x, e.y, { count: 12, color: '#93c5fd', gravity: 0 });
    });
  }

  function draw(r) {
    r.backdrop(G.art.bg, (scroll % 240), 0);
    g.world.each('ember', function (e) { r.sprite(G.art.ember, e.x, e.y, 30, 30, g.state.time * 2); });
    g.world.each('gust', function (e) { r.sprite(G.art.gust, e.x, e.y, 46, 46, 0, 0.9); });
    if (lantern) r.sprite(G.art.lantern, lantern.x, lantern.y, 52, 52, Math.sin(g.state.time * 4) * 0.12);

    g.ui.hud([
      { label: 'EMBERS', value: g.state.score + '/' + G.config.targetEmbers },
      { label: 'TIME', value: Math.floor(g.state.time) + 's' }
    ]);
    if (lantern) g.ui.progress(16, 60, 240, 16, lantern.flame / G.config.flameMax, '#fb923c');
  }

  g.start({ init: init, update: update, draw: draw, restart: init });
};`,
  },
];

// Test-only knob so the win path can be reached in a bounded browser check.
// It rewrites the reference module, not the SDK or the pipeline.
const targetEmbers = Number(process.env.FORGE_QA_TARGET || 12);
for (const m of modules) m.source = m.source.replace("__TARGET_EMBERS__", String(targetEmbers));

const findings = auditStatic(design, modules);
const blockers = findings.filter((f) => f.severity === "blocker");
for (const f of findings) console.log(`  [${f.severity}] ${f.moduleId}:${f.code} — ${f.message}`);
if (blockers.length) {
  console.error(`[FAIL] hand-written reference build has ${blockers.length} blocker(s)`);
  process.exit(1);
}

const assembled = assembleGame(design, modules);
const assemblyBlockers = assembled.findings.filter((f) => f.severity === "blocker");
if (assemblyBlockers.length) {
  console.error("[FAIL] assembly blockers:", assemblyBlockers);
  process.exit(1);
}

const ctx = {
  title: design.title,
  prompt: design.pitch,
  winScore: targetEmbers,
  // Intentionally empty: this proves the placeholder path renders a real game
  // even when the asset pipeline produced nothing at all.
  assets: {} as Record<string, string>,
};

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${design.title}</title><style>html,body,#game{margin:0;width:100%;height:100%;overflow:hidden;background:#06130e}*{box-sizing:border-box}</style></head><body><main id="game"></main>
<script>${GAME_FORGE_SDK_SOURCE}</script>
<script>
const ctx=${JSON.stringify(ctx)};
const post=(t,p)=>{try{parent.postMessage(Object.assign({type:t},p||{}),'*')}catch(e){}};
window.__forge={events:[],errors:[]};
window.addEventListener('message',(e)=>{if(e.data&&e.data.type)window.__forge.events.push(e.data);});
ctx.finish=(won,score=0)=>{window.__forge.events.push({type:'operone-game-end',won:!!won,score:score});post('operone-game-end',{won:!!won,score:score});};
ctx.reportError=(e)=>{window.__forge.errors.push(String(e&&e.message?e.message:e));post('operone-game-error',{message:String(e)});};
try{
${assembled.source}
;if(typeof mountGame!=='function')throw new Error('mountGame missing');
mountGame(document.getElementById('game'),ctx);
}catch(error){ctx.reportError(error);console.error(error);}
</script></body></html>`;

const outDir = process.argv[2] ?? path.join(process.cwd(), "qa-output", "game-forge");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "reference-build.html");
fs.writeFileSync(outFile, html, "utf8");

console.log(`[OK] reference build assembled`);
console.log(`  modules      : ${modules.length}`);
console.log(`  module chars : ${modules.reduce((n, m) => n + m.source.length, 0)}`);
console.log(`  assembled    : ${assembled.source.length} chars`);
console.log(`  sdk          : ${GAME_FORGE_SDK_SOURCE.length} chars`);
console.log(`  page         : ${outFile}`);
