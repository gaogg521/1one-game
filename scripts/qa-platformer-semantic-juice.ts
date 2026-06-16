import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/PlatformerScene.ts"), "utf8");

for (const symbol of ["juicePickup", "juiceHit", "juiceWin", "juiceFail"]) {
  assert(source.includes(symbol), `PlatformerScene should use ${symbol}`);
}

assert(source.includes("private fxCollect"), "PlatformerScene should keep collect feedback behind fxCollect");
assert(source.includes("private fxDamage"), "PlatformerScene should keep damage feedback behind fxDamage");

console.log("[OK] qa-platformer-semantic-juice");
