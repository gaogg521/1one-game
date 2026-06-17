export type RunnerDeathCause = "crash" | "caught" | "lives";

export const RUNNER_LEADERBOARD_VARIANTS = ["temple-relic-runner", "crashy-roads"] as const;
export type RunnerLeaderboardVariant = (typeof RUNNER_LEADERBOARD_VARIANTS)[number];

export type RunnerLeaderboardEntry = {
  score: number;
  combo: number;
  distance: number;
  coins?: number;
  at: string;
};

export type RunnerRunRecap = {
  variantId: RunnerLeaderboardVariant;
  score: number;
  distance: number;
  coins?: number;
  maxCombo: number;
  cause: RunnerDeathCause;
  survivalSec: number;
  prevBestScore: number;
  deltaFromBest: number;
  beatPrevBest: boolean;
};

export type CloudRunnerLeaderboardEntry = RunnerLeaderboardEntry & {
  nickname: string;
};

export type CloudRunnerLeaderboardSnapshot = {
  variantId: string;
  entries: CloudRunnerLeaderboardEntry[];
  rank?: number;
  isNewBest?: boolean;
};

export type RunnerLeaderboardSnapshot = {
  variantId: string;
  entries: RunnerLeaderboardEntry[];
  rank: number;
  isNewBest: boolean;
  inserted: RunnerLeaderboardEntry;
};

const MAX_ENTRIES = 5;
const STORAGE_PREFIX = "runner-lb:";

export function isRunnerLeaderboardVariant(variantId?: string): variantId is RunnerLeaderboardVariant {
  return variantId === "temple-relic-runner" || variantId === "crashy-roads";
}

export function loadRunnerLeaderboard(variantId: string): RunnerLeaderboardEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${variantId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RunnerLeaderboardEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

export function buildRunnerRunRecap(params: {
  variantId: RunnerLeaderboardVariant;
  score: number;
  distance: number;
  coins?: number;
  maxCombo: number;
  cause: RunnerDeathCause;
  survivalSec: number;
  prevBestScore?: number;
}): RunnerRunRecap {
  const prevBestScore = params.prevBestScore ?? 0;
  const deltaFromBest = params.score - prevBestScore;
  return {
    variantId: params.variantId,
    score: params.score,
    distance: params.distance,
    coins: params.coins,
    maxCombo: params.maxCombo,
    cause: params.cause,
    survivalSec: params.survivalSec,
    prevBestScore,
    deltaFromBest,
    beatPrevBest: params.score > prevBestScore,
  };
}

export function recordRunnerLeaderboardEntry(
  variantId: string,
  entry: Omit<RunnerLeaderboardEntry, "at">,
): RunnerLeaderboardSnapshot {
  const inserted: RunnerLeaderboardEntry = { ...entry, at: new Date().toISOString() };
  const prev = loadRunnerLeaderboard(variantId);
  const prevBest = prev[0]?.score ?? 0;
  const entries = [...prev, inserted].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(`${STORAGE_PREFIX}${variantId}`, JSON.stringify(entries));
  }
  const rank = entries.findIndex((e) => e.at === inserted.at) + 1;
  return {
    variantId,
    entries,
    rank: rank > 0 ? rank : entries.length,
    isNewBest: inserted.score >= prevBest,
    inserted,
  };
}
