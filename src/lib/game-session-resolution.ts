import type { GameSpec } from "@/lib/game-spec";

const MIN_DELIVERY_DEADLINE_MS = 65_000;
const MAX_DELIVERY_DEADLINE_MS = 95_000;

/**
 * The publication gate needs a complete first-minute playtest, while players
 * also need a guaranteed result. Give telemetry five seconds after the target
 * session before resolving, and never let a generated collector run forever.
 */
export function gameDeliveryDeadlineMs(spec: Pick<GameSpec, "production">): number {
  const targetSeconds = spec.production?.delivery?.targetSessionSeconds ?? 60;
  return Math.min(MAX_DELIVERY_DEADLINE_MS, Math.max(MIN_DELIVERY_DEADLINE_MS, targetSeconds * 1_000 + 5_000));
}

export function collectorDeadlineOutcome(input: {
  spec: Pick<GameSpec, "templateId" | "production" | "gameplay">;
  elapsedMs: number;
  score: number;
}): { score: number; won: boolean } | null {
  if (input.spec.templateId !== "collector") return null;
  if (input.elapsedMs < gameDeliveryDeadlineMs(input.spec)) return null;
  return {
    score: input.score,
    won: input.score >= (input.spec.gameplay.winScore ?? 40),
  };
}

const COLLECTOR_OPENING_FRIENDLY_MS = 60_000;

/**
 * Opening minute stays non-lethal so a first-play session can actually last
 * long enough for first-minute telemetry. After that, honor the authored penalty.
 */
export function collectorHitPenalty(input: {
  hazardPenalty?: "loseLife" | "loseScore" | "none";
  playElapsedMs: number;
  openingFriendlyMs?: number;
}): "loseLife" | "loseScore" | "none" {
  if (input.playElapsedMs < (input.openingFriendlyMs ?? COLLECTOR_OPENING_FRIENDLY_MS)) {
    return input.hazardPenalty === "none" ? "none" : "loseScore";
  }
  return input.hazardPenalty ?? "loseLife";
}
