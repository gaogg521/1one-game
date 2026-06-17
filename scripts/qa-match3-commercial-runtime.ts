import fs from "node:fs";
import path from "node:path";
import { buildPuzzleBlueprint } from "../src/lib/puzzle-blueprint";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const blueprint = buildPuzzleBlueprint({
  prompt: "开心消消乐 三消 交换 糖果 动物 连锁 道具",
});
assert(blueprint.mode === "match3", "commercial match3 should use match3 mode");
assert(blueprint.matchMechanic === "swap", "commercial match3 should use swap mechanic");
assert((blueprint.boosters?.length ?? 0) >= 3, "commercial match3 should define boosters");
assert((blueprint.specialTiles?.length ?? 0) >= 3, "commercial match3 should define special tiles");

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/PuzzleScene.ts"), "utf8");
for (const symbol of [
  "private selectedMatch3Cell",
  "private handleSwapMatch3",
  "private findLineMatches",
  "match3Specials",
  "specialTilesCreated",
]) {
  assert(source.includes(symbol), `PuzzleScene should include ${symbol}`);
}

console.log("[OK] qa-match3-commercial-runtime");
