import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/FarmingScene.ts"), "utf8");

for (const symbol of ["juicePickup", "juiceCombo", "juiceWin"]) {
  assert(source.includes(symbol), `FarmingScene should use ${symbol}`);
}

assert(source.includes("harvestStreak"), "FarmingScene should keep harvest streak semantics");
assert(!source.includes("juiceBurst(this, tile.rect.x, tile.rect.y, c.color, 14)"), "Farming harvest should not use old ad-hoc burst");

console.log("[OK] qa-farming-semantic-juice");
