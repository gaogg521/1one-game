import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/PuzzleScene.ts"), "utf8");

for (const symbol of ["juicePickup", "juiceHit", "juiceCombo", "juiceWin", "juiceFail"]) {
  assert(source.includes(symbol), `PuzzleScene should use ${symbol}`);
}

assert(source.includes("private finish"), "PuzzleScene should route final feedback through finish");

console.log("[OK] qa-puzzle-semantic-juice");
