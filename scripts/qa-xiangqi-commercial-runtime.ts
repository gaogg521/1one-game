import fs from "node:fs";
import path from "node:path";
import { buildChessBlueprint } from "../src/lib/chess-blueprint";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const blueprint = buildChessBlueprint({ prompt: "中国象棋 楚河汉界 红黑双方 将军提示" });
assert(blueprint.ruleset === "xiangqi", "中国象棋 should infer xiangqi ruleset");
assert(blueprint.boardCols === 9 && blueprint.boardRows === 10, "中国象棋 should use 9x10 board");
assert(blueprint.pieceSet.length >= 7, "中国象棋 should include full piece families");

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/ChessScene.ts"), "utf8");
for (const symbol of [
  "ruleset === \"xiangqi\"",
  "private buildXiangqiPieces",
  "private legalMovesFor",
  "private blackMove",
  "boardRows",
  "pieceCount",
  "楚河",
]) {
  assert(source.includes(symbol), `ChessScene should include ${symbol}`);
}

console.log("[OK] qa-xiangqi-commercial-runtime");
