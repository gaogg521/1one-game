import type { CreatorQualityEngagement } from "@/lib/creator-workflow";

export type GamePlaytestAdviceKind = "collect_samples" | "first_action" | "first_minute" | "early_failure" | "retry_friction" | "healthy";
export type GamePlaytestAdvice = { kind: GamePlaytestAdviceKind; priority: "info" | "warning" | "good" };

/** Deterministic, privacy-safe creator advice based only on aggregate gameplay telemetry. */
export function buildGamePlaytestAdvice(engagement: CreatorQualityEngagement): GamePlaytestAdvice[] {
  const starts = engagement.starts ?? engagement.sampleSize;
  if (starts < 5) return [{ kind: "collect_samples", priority: "info" }];
  const advice: GamePlaytestAdvice[] = [];
  if ((engagement.firstActionRate ?? 100) < 70) advice.push({ kind: "first_action", priority: "warning" });
  if ((engagement.firstMinuteRate ?? 100) < 45) advice.push({ kind: "first_minute", priority: "warning" });
  if ((engagement.averageFailureSec ?? Number.POSITIVE_INFINITY) < 20) advice.push({ kind: "early_failure", priority: "warning" });
  if ((engagement.retryRate ?? 0) < 12 && (engagement.averageFailureSec ?? 0) > 0) advice.push({ kind: "retry_friction", priority: "warning" });
  return advice.length ? advice.slice(0, 3) : [{ kind: "healthy", priority: "good" }];
}
