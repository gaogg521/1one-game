import assert from "node:assert/strict";
import {
  DEFAULT_COMIC_PANEL_MS,
  estimateComicPanelEtaMs,
  avgPanelMsFromSession,
  clampPanelDurationMs,
} from "../src/lib/comic-panel-eta.ts";

assert.equal(estimateComicPanelEtaMs(0), 0);
assert.equal(estimateComicPanelEtaMs(10), 10 * DEFAULT_COMIC_PANEL_MS);
assert.equal(estimateComicPanelEtaMs(4, 120_000), 480_000);
assert.equal(clampPanelDurationMs(30_000), 2 * 60 * 1000);
assert.equal(clampPanelDurationMs(600_000), 8 * 60 * 1000);
assert.equal(avgPanelMsFromSession({ panelsCompletedThisSession: 0, elapsedMs: 60_000 }), undefined);
assert.equal(avgPanelMsFromSession({ panelsCompletedThisSession: 2, elapsedMs: 120_000 }), 60_000);

console.log("[OK] qa-comic-panel-eta");
