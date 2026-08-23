import { assessLiteraryEngagementHealth, LITERARY_QUALITY_MIN_SAMPLES } from "../src/lib/literary-engagement";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function summary(input: Partial<Parameters<typeof assessLiteraryEngagementHealth>[0]> = {}) {
  return {
    sampleSize: LITERARY_QUALITY_MIN_SAMPLES,
    starts: LITERARY_QUALITY_MIN_SAMPLES,
    completed: LITERARY_QUALITY_MIN_SAMPLES,
    completionRate: 100,
    averageProgressRate: 100,
    unitViews: LITERARY_QUALITY_MIN_SAMPLES * 2,
    unitViewsByIndex: [{ unitIndex: 1, viewers: LITERARY_QUALITY_MIN_SAMPLES }, { unitIndex: 2, viewers: LITERARY_QUALITY_MIN_SAMPLES }],
    ...input,
  };
}

function main() {
  const insufficient = assessLiteraryEngagementHealth(summary({ sampleSize: LITERARY_QUALITY_MIN_SAMPLES - 1, starts: LITERARY_QUALITY_MIN_SAMPLES - 1 }));
  assert(insufficient.status === "insufficient_sample" && insufficient.alerts.length === 0, "small cohorts must never receive a quality alert");

  const healthy = assessLiteraryEngagementHealth(summary());
  assert(healthy.status === "healthy", "a complete cohort must be healthy");

  const attention = assessLiteraryEngagementHealth(summary({
    completed: 3,
    completionRate: 30,
    averageProgressRate: 20,
    unitViews: 4,
    unitViewsByIndex: [{ unitIndex: 1, viewers: 4 }],
  }));
  assert(attention.status === "attention", "reliable poor consumption must receive an advisory alert");
  assert(attention.alerts.some((alert) => alert.code === "low_completion"), "low completion must be explained");
  assert(attention.alerts.some((alert) => alert.code === "early_dropoff" && alert.recommendedUnitIndex === 1), "early dropoff must identify a repair unit");
  console.log("[OK] qa-literary-engagement-alerts");
}

main();
