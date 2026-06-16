import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/PlayScene.ts"), "utf8");

for (const symbol of ["juicePickup", "juiceHit", "juiceBoss", "juiceWin", "juiceFail"]) {
  assert(source.includes(symbol), `PlayScene should use ${symbol}`);
}

assert(source.includes("private fxCollect"), "PlayScene should keep collect feedback behind fxCollect");
assert(source.includes("private fxDamage"), "PlayScene should keep damage feedback behind fxDamage");
assert(source.includes("juiceBoss(this"), "PlayScene boss lifecycle should use semantic boss feedback");

console.log("[OK] qa-play-scene-semantic-juice");
