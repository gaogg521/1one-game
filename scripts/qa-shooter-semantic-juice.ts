import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/ShooterScene.ts"), "utf8");

for (const symbol of ["juiceHit", "juiceBoss", "juicePickup", "juiceWin", "juiceFail"]) {
  assert(source.includes(symbol), `ShooterScene should use ${symbol}`);
}

assert(source.includes("private fxExplosion"), "ShooterScene should keep explosion feedback behind fxExplosion");
assert(source.includes("juiceBoss(this, common)"), "ShooterScene should use boss semantic feedback for large explosions");
assert(source.includes("juiceHit(this, common)"), "ShooterScene should use hit semantic feedback for normal explosions");

console.log("[OK] qa-shooter-semantic-juice");
