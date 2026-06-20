import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/RhythmScene.ts"), "utf8");

for (const symbol of ["juiceBurst", "juiceWin", "juiceFail"]) {
  assert(source.includes(symbol), `RhythmScene should use ${symbol}`);
}

assert(source.includes("schedulePhaserPlayReady"), "RhythmScene should call schedulePhaserPlayReady");
assert(source.includes("buildSceneGoalGuidance"), "RhythmScene should use scene goal guidance");
assert(source.includes("HudFrame"), "RhythmScene should use HudFrame");

console.log("[OK] qa-rhythm-semantic-juice");
