/**
 * 入库链路：coerceGameSpec / prepareGameSpecForPersist 保留 agenticModule
 * npm run qa:agentic-persist-coerce
 */
import { prepareGameSpecForPersist } from "@/lib/spec-patch";
import { coerceGameSpec } from "@/lib/normalize-spec";
import { shouldUseAgenticRuntime } from "@/lib/agentic/game-module";
import type { GameSpec } from "@/lib/game-spec";

const PROMPT =
  "Build an epic side-scrolling platformer with 3 levels, character select, and final boss Thanos.";

const raw: GameSpec = {
  version: 1,
  templateId: "platformer",
  title: "Test Agentic Persist",
  theme: {
    backgroundColor: "#141816",
    playerColor: "#89a884",
    hazardColor: "#9d5838",
  },
  gameplay: {
    playerSpeed: 300,
    hazardSpeed: 280,
    spawnIntervalMs: 640,
    jumpStrength: 420,
    gravity: 950,
  },
  labels: { player: "Hero", hazard: "Boss" },
  agenticPlayRoute: "agentic",
  agenticModule: {
    version: 1,
    source: `export function createGame(ctx, Phaser) {
  return { create() { ctx.onScore(1); } };
}`,
    entry: "createGame",
  },
};

const coerced = coerceGameSpec(raw);
if (!coerced.ok || !coerced.spec.agenticModule?.source) {
  console.error("[FAIL] coerceGameSpec dropped agenticModule");
  process.exit(1);
}
if (coerced.spec.agenticPlayRoute !== "agentic") {
  console.error("[FAIL] coerceGameSpec dropped agenticPlayRoute");
  process.exit(1);
}

const persisted = prepareGameSpecForPersist(raw, PROMPT);
if (!shouldUseAgenticRuntime(persisted)) {
  console.error("[FAIL] prepareGameSpecForPersist lost agentic runtime", {
    route: persisted.agenticPlayRoute,
    hasModule: Boolean(persisted.agenticModule?.source),
  });
  process.exit(1);
}

console.log("[OK] qa:agentic-persist-coerce");
