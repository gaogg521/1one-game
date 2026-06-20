import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/FightingScene.ts"), "utf8");

for (const symbol of ["juiceHit", "juiceBurst", "juiceWin", "juiceFail"]) {
  assert(source.includes(symbol), `FightingScene should use ${symbol}`);
}

assert(source.includes("schedulePhaserPlayReady"), "FightingScene should call schedulePhaserPlayReady");
assert(source.includes("setPhaserQaState"), "FightingScene should call setPhaserQaState");
assert(source.includes("buildSceneCohesion"), "FightingScene should use scene cohesion");
assert(source.includes("buildSceneGoalGuidance"), "FightingScene should use scene goal guidance");
assert(source.includes("HudFrame"), "FightingScene should use HudFrame");
assert(source.includes("setBottomHint"), "FightingScene should show control hint via setBottomHint");
assert(source.includes("spawnDamageNumber"), "FightingScene should show damage numbers on hit");

console.log("[OK] qa-fighting-semantic-juice");
