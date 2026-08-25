import assert from "node:assert/strict";
import { resolvePuzzleGridLayout } from "@/game/engine/puzzle-layout";

const mobile = resolvePuzzleGridLayout({ width: 375, height: 420, cols: 8, rows: 8, anipop: false });
assert(mobile.cell >= 30, "mobile board cells must remain tappable");
assert(mobile.oy + mobile.cell * 8 <= 420 - 62 + 0.001, "8x8 board must fit above the mobile hint area");

const desktop = resolvePuzzleGridLayout({ width: 920, height: 560, cols: 8, rows: 8, anipop: false });
assert.equal(desktop.cell, 48, "desktop keeps the intended 48px board cell");

console.log("qa:mobile-puzzle-layout: ok");
