import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/SportsScene.ts"), "utf8");

for (const symbol of ["juiceBurst", "juiceWin", "juiceFail"]) {
  assert(source.includes(symbol), `SportsScene should use ${symbol}`);
}

assert(source.includes("schedulePhaserPlayReady"), "SportsScene should call schedulePhaserPlayReady");
assert(source.includes("setPhaserQaState"), "SportsScene should call setPhaserQaState");
assert(source.includes("buildSceneGoalGuidance"), "SportsScene should use scene goal guidance");
assert(source.includes("HudFrame"), "SportsScene should use HudFrame");
assert(source.includes("setBottomHint"), "SportsScene should show control hint via setBottomHint");

console.log("[OK] qa-sports-semantic-juice");
