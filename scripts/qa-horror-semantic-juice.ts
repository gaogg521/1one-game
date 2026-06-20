import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/HorrorScene.ts"), "utf8");

for (const symbol of ["juiceBurst", "juiceFail", "juiceFlash", "juiceWin"]) {
  assert(source.includes(symbol), `HorrorScene should use ${symbol}`);
}

assert(source.includes("buildSceneCohesion"), "HorrorScene should use scene cohesion");
assert(source.includes("buildSceneGoalGuidance"), "HorrorScene should use scene goal guidance");
assert(source.includes("HudFrame"), "HorrorScene should use HudFrame");
assert(source.includes("showControlsHint"), "HorrorScene should show controls hint on start");

console.log("[OK] qa-horror-semantic-juice");
