/**
 * Astrocade Agentic repair 闭环离线 QA
 * npm run qa:agentic-repair
 */
import { buildTemplateFallbackModule } from "../src/lib/agentic/template-fallback-modules";
import { validateAgenticSource } from "../src/lib/agentic/game-module";
import { validateAgenticRunnable } from "../src/lib/agentic/agentic-runnable";
import type { GameSpec } from "../src/lib/game-spec";

const SPEC: GameSpec = {
  version: 1,
  templateId: "physics",
  title: "Smash QA",
  theme: {
    backgroundColor: "#1a2220",
    playerColor: "#89a884",
    hazardColor: "#9d5838",
    collectibleColor: "#c9a66b",
  },
  gameplay: { playerSpeed: 300, hazardSpeed: 220, spawnIntervalMs: 640, winScore: 100 },
  labels: { player: "拳", hazard: "假人" },
};

const mod = buildTemplateFallbackModule(SPEC);
const src = validateAgenticSource(mod.source);
if (!src.ok) {
  console.error("[FAIL] template fallback forbidden", src);
  process.exit(1);
}
const run = validateAgenticRunnable(mod);
if (!run.ok) {
  console.error("[FAIL] template fallback not runnable", run);
  process.exit(1);
}

const bad = {
  version: 1 as const,
  entry: "createGame",
  source: `function createGame(ctx, Phaser) { eval("1"); return { create() {} }; }`,
};
const badCheck = validateAgenticSource(bad.source);
if (badCheck.ok) {
  console.error("[FAIL] eval should be forbidden");
  process.exit(1);
}

console.log("[OK] qa-agentic-repair: validate + runnable pipeline");
