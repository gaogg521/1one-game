/**
 * puzzle mode 离线断言（样品 sampleId 绑定）
 */
import assert from "node:assert/strict";
import { buildPuzzleBlueprint, inferPuzzleMode } from "@/lib/puzzle-blueprint";

assert.equal(inferPuzzleMode({ sampleId: "whimsy-differences" }), "spotDifference");
assert.equal(inferPuzzleMode({ sampleId: "memory-match-mania" }), "memoryMatch");
assert.equal(inferPuzzleMode({ sampleId: "kids-puzzle" }), "jigsaw");
assert.equal(inferPuzzleMode({ sampleId: "color-bloom" }), "match3");

const whimsy = buildPuzzleBlueprint({ sampleId: "whimsy-differences", prompt: "Whimsy" });
assert.equal(whimsy.mode, "spotDifference");

console.log("qa:puzzle-mode: ok");
