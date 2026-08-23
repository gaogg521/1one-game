import { buildGamePlaytestAdvice } from "../src/lib/game-playtest-advice";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

assert(buildGamePlaytestAdvice({ sampleSize: 2 })[0]?.kind === "collect_samples", "small samples must not create false diagnosis");
const risky = buildGamePlaytestAdvice({ sampleSize: 10, starts: 10, firstActionRate: 40, firstMinuteRate: 20, averageFailureSec: 8, retryRate: 2 });
assert(risky.some((item) => item.kind === "first_action"), "low first action must surface onboarding advice");
assert(risky.some((item) => item.kind === "early_failure"), "early failure must surface difficulty advice");
assert(buildGamePlaytestAdvice({ sampleSize: 10, starts: 10, firstActionRate: 90, firstMinuteRate: 70, retryRate: 20 })[0]?.kind === "healthy", "healthy data needs a positive non-actionable result");
console.log("[OK] qa-game-playtest-advice");
