import fs from "node:fs";
import path from "node:path";
import type { CloudRunnerLeaderboardEntry, RunnerLeaderboardEntry } from "@/lib/runner-leaderboard";
import { isRunnerLeaderboardVariant } from "@/lib/runner-leaderboard";

const DATA_DIR = path.join(process.cwd(), ".data", "runner-leaderboards");
const MAX_CLOUD_ENTRIES = 10;

function boardPath(variantId: string): string {
  return path.join(DATA_DIR, `${variantId}.json`);
}

function readBoard(variantId: string): CloudRunnerLeaderboardEntry[] {
  try {
    const file = boardPath(variantId);
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as CloudRunnerLeaderboardEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_CLOUD_ENTRIES) : [];
  } catch {
    return [];
  }
}

function writeBoard(variantId: string, entries: CloudRunnerLeaderboardEntry[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(boardPath(variantId), `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

export function getCloudRunnerLeaderboard(variantId: string): CloudRunnerLeaderboardEntry[] {
  if (!isRunnerLeaderboardVariant(variantId)) return [];
  return readBoard(variantId);
}

export type CloudRunnerInsertResult = {
  entries: CloudRunnerLeaderboardEntry[];
  rank: number;
  isNewBest: boolean;
  inserted: CloudRunnerLeaderboardEntry;
};

export type CloudRunnerLeaderboardInsert = Omit<RunnerLeaderboardEntry, "at"> & {
  nickname?: string;
};

export function insertCloudRunnerLeaderboardEntry(
  variantId: string,
  entry: CloudRunnerLeaderboardInsert,
): CloudRunnerInsertResult | null {
  if (!isRunnerLeaderboardVariant(variantId)) return null;
  const inserted: CloudRunnerLeaderboardEntry = {
    ...entry,
    nickname: entry.nickname?.trim().slice(0, 16) || "Player",
    at: new Date().toISOString(),
  };
  const prev = readBoard(variantId);
  const prevBest = prev[0]?.score ?? 0;
  const entries = [...prev, inserted].sort((a, b) => b.score - a.score).slice(0, MAX_CLOUD_ENTRIES);
  writeBoard(variantId, entries);
  const rank = entries.findIndex((e) => e.at === inserted.at) + 1;
  return {
    entries,
    rank: rank > 0 ? rank : entries.length,
    isNewBest: inserted.score > prevBest,
    inserted,
  };
}
