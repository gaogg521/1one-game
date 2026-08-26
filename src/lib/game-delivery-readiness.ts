import type { GameSpec } from "@/lib/game-spec";
import { simulateGameBalance, type GameBalanceSimulation } from "@/lib/game-balance-simulation";

export type GameDeliveryReadiness = {
  version: 1;
  verdict: "ready" | "needs_review" | "blocked";
  score: number;
  evidence: string[];
  metrics: {
    targetSessionSeconds: number;
    firstRewardBySecond: number;
    variationBySecond: number;
    climaxBySecond: number;
    estimatedSuccessRate: number;
  };
  balance: GameBalanceSimulation;
};

/**
 * Deterministic preflight for every generated game.  It is deliberately not
 * presented as a real-player simulation: it catches invalid numeric envelopes
 * before a browser playtest, while telemetry and device E2E remain separate
 * release evidence.
 */
export function evaluateGameDeliveryReadiness(spec: GameSpec): GameDeliveryReadiness {
  const production = spec.production;
  const delivery = production?.delivery;
  const gameplay = spec.gameplay;
  const balance = simulateGameBalance(spec);
  const evidence: string[] = [];
  let score = 0;

  const targetSessionSeconds = delivery?.targetSessionSeconds ?? 60;
  const firstRewardBySecond = delivery?.firstRewardBySecond ?? 20;
  const variationBySecond = delivery?.variationBySecond ?? 40;
  const climaxBySecond = delivery?.climaxBySecond ?? 60;
  if (delivery) score += 25;
  else evidence.push("delivery_contract_missing");
  if (targetSessionSeconds >= 45 && targetSessionSeconds <= 90) score += 15;
  else evidence.push("session_target_out_of_range");
  if (firstRewardBySecond >= 3 && firstRewardBySecond <= 20) score += 15;
  else evidence.push("first_reward_out_of_range");
  if (variationBySecond > firstRewardBySecond && variationBySecond <= 45) score += 10;
  else evidence.push("variation_timing_invalid");
  if (climaxBySecond >= variationBySecond && climaxBySecond <= 60) score += 10;
  else evidence.push("climax_timing_invalid");

  const playerSpeed = gameplay.playerSpeed ?? 0;
  const hazardSpeed = gameplay.hazardSpeed ?? 0;
  const spawnIntervalMs = gameplay.spawnIntervalMs ?? 0;
  const lives = gameplay.lives ?? 0;
  const winScore = gameplay.winScore ?? 0;
  const movementOk = playerSpeed >= 100 && playerSpeed <= 900;
  const pressureOk = hazardSpeed > 0 && hazardSpeed <= 800 && spawnIntervalMs >= 200 && spawnIntervalMs <= 3_500;
  const outcomeOk = lives >= 1 && lives <= 8 && winScore >= 1 && winScore <= 5_000;
  if (movementOk) score += 8; else evidence.push("movement_numeric_out_of_range");
  if (pressureOk) score += 8; else evidence.push("pressure_numeric_out_of_range");
  if (outcomeOk) score += 9; else evidence.push("outcome_numeric_out_of_range");

  // Conservative heuristic used solely as a preflight signal, never as a
  // claimed player metric. More lives and a reasonable spawn window should
  // avoid immediate unwinnable first sessions.
  const estimatedSuccessRate = Math.max(0.15, Math.min(0.9,
    0.38 + lives * 0.07 + Math.min(0.12, spawnIntervalMs / 10_000) - Math.min(0.16, hazardSpeed / 7_000),
  ));
  if (estimatedSuccessRate >= 0.42 && estimatedSuccessRate <= 0.86) score += 10;
  else evidence.push("estimated_first_session_balance_needs_review");
  evidence.push(...balance.evidence);
  if (balance.verdict === "blocked") evidence.push("balance_scenario_sweep_blocked");

  evidence.push(`target_session_seconds:${targetSessionSeconds}`);
  evidence.push(`first_reward_by_second:${firstRewardBySecond}`);
  evidence.push(`estimated_success_rate:${Math.round(estimatedSuccessRate * 100)}%`);
  score = Math.min(100, score);
  const preflightVerdict = score < 55 ? "blocked" : score < 85 ? "needs_review" : "ready";
  const verdict = balance.verdict === "blocked" || preflightVerdict === "blocked"
    ? "blocked"
    : balance.verdict === "needs_review" || preflightVerdict === "needs_review"
      ? "needs_review"
      : "ready";
  return { version: 1, verdict, score, evidence, metrics: { targetSessionSeconds, firstRewardBySecond, variationBySecond, climaxBySecond, estimatedSuccessRate }, balance };
}
