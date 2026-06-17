/**
 * puzzle mode 离线断言（prompt 推断 + 保留样品 sampleId）
 */
import assert from "node:assert/strict";
import { buildPuzzleBlueprint, inferPuzzleMode } from "@/lib/puzzle-blueprint";

assert.equal(
  inferPuzzleMode({ prompt: "做一个找不同小游戏，左右两幅插画" }),
  "spotDifference",
);
assert.equal(
  inferPuzzleMode({ prompt: "翻牌记忆配对小游戏" }),
  "memoryMatch",
);
assert.equal(
  inferPuzzleMode({ prompt: "儿童向拼图小游戏" }),
  "jigsaw",
);
assert.equal(inferPuzzleMode({ sampleId: "color-bloom" }), "match3");

const match3 = buildPuzzleBlueprint({ sampleId: "color-bloom", prompt: "开心消消乐" });
assert.equal(match3.mode, "match3");
assert.equal(match3.matchMechanic, "swap");
assert.equal(match3.levelCount, 3);

console.log("qa:puzzle-mode: ok");
