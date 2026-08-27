import assert from "node:assert/strict";
import { collectorDeadlineOutcome, gameDeliveryDeadlineMs } from "@/lib/game-session-resolution";
import type { GameSpec } from "@/lib/game-spec";

const collector = {
  templateId: "collector",
  gameplay: { winScore: 50 },
  production: { delivery: { targetSessionSeconds: 60 } },
} as GameSpec;

assert.equal(gameDeliveryDeadlineMs(collector), 65_000, "60-second delivery sessions must leave time for first-minute evidence");
assert.equal(collectorDeadlineOutcome({ spec: collector, elapsedMs: 64_999, score: 12 }), null, "collector must stay active before its deadline");
assert.deepEqual(
  collectorDeadlineOutcome({ spec: collector, elapsedMs: 65_000, score: 12 }),
  { score: 12, won: false },
  "collector must fail clearly at the deadline when its goal is incomplete",
);
assert.deepEqual(
  collectorDeadlineOutcome({ spec: collector, elapsedMs: 65_000, score: 50 }),
  { score: 50, won: true },
  "collector must preserve a completed win at the deadline",
);
assert.equal(
  collectorDeadlineOutcome({ spec: { ...collector, templateId: "avoider" }, elapsedMs: 90_000, score: 0 }),
  null,
  "the collector fallback must not override other game runtimes",
);

console.log("[OK] qa-game-session-resolution: generated collector sessions always resolve after first-minute evidence");
