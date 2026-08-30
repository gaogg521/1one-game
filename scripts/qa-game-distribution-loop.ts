import assert from "node:assert/strict";
import { evaluateGameDistribution, type DistributionGameplayEvent } from "@/lib/game-distribution-loop";

function cohort(count: number, durationMs: number, options: { action?: boolean; retry?: boolean } = {}): DistributionGameplayEvent[] {
  return Array.from({ length: count }, (_, index) => {
    const sessionId = `s-${durationMs}-${index}`;
    return [
      { sessionId, event: "start", elapsedMs: 0 },
      ...(options.action ? [{ sessionId, event: "first_action", elapsedMs: 500 }] : []),
      ...(durationMs >= 60_000 ? [{ sessionId, event: "first_minute", elapsedMs: 60_000, activeMs: 60_000 }] : []),
      ...(options.retry ? [{ sessionId, event: "retry", elapsedMs: durationMs }] : []),
      { sessionId, event: "end", elapsedMs: durationMs },
    ];
  }).flat();
}

const small = evaluateGameDistribution(cohort(8, 180_000, { action: true }));
assert.equal(small.decision, "collect_samples", "small cohorts must never be promoted or rejected");

const healthy = evaluateGameDistribution([
  ...cohort(16, 180_000, { action: true, retry: true }),
  ...cohort(4, 45_000, { action: true }),
]);
assert.equal(healthy.decision, "promote");
assert.equal(healthy.eligibleForGallery, true);
assert.equal(healthy.buckets.play_2_5m, 16);

const weak = evaluateGameDistribution([
  ...cohort(25, 7_000),
  ...cohort(15, 18_000, { action: true }),
]);
assert.equal(weak.decision, "retire");
assert(weak.revisionTargets.includes("loading"));
assert(weak.revisionTargets.includes("onboarding"));

const revise = evaluateGameDistribution([
  ...cohort(12, 75_000, { action: true }),
  ...cohort(8, 20_000),
]);
assert.equal(revise.decision, "iterate");
assert(revise.diagnoses.length > 0);

console.log("[OK] qa-game-distribution-loop: collect -> iterate/promote/retire with observed retention buckets");
