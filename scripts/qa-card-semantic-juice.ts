import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/CardScene.ts"), "utf8");

for (const symbol of ["juiceHit", "juiceWin", "juiceFail", "juicePickup"]) {
  assert(source.includes(symbol), `CardScene should use ${symbol}`);
}

assert(source.includes("buildSceneCohesion"), "CardScene should use scene cohesion");
assert(source.includes("buildSceneGoalGuidance"), "CardScene should use scene goal guidance");
assert(source.includes("HudFrame"), "CardScene should use HudFrame");
assert(source.includes("showControlsHint"), "CardScene should show controls hint on start");

console.log("[OK] qa-card-semantic-juice");
