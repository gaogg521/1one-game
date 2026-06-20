import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/MobaScene.ts"), "utf8");

for (const symbol of ["juiceBurst", "juiceHit", "juiceWin", "juiceFail"]) {
  assert(source.includes(symbol), `MobaScene should use ${symbol}`);
}

assert(source.includes("buildSceneCohesion"), "MobaScene should use scene cohesion");
assert(source.includes("buildSceneGoalGuidance"), "MobaScene should use scene goal guidance");
assert(source.includes("HudFrame"), "MobaScene should use HudFrame");
assert(source.includes("setBottomHint"), "MobaScene should show control hint via setBottomHint");

console.log("[OK] qa-moba-semantic-juice");
