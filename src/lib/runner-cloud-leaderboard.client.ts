import type { CloudRunnerLeaderboardSnapshot } from "@/lib/runner-leaderboard";

export async function fetchCloudRunnerLeaderboard(
  variantId: string,
): Promise<CloudRunnerLeaderboardSnapshot | null> {
  try {
    const res = await fetch(`/api/samples/runner-leaderboard?variant=${encodeURIComponent(variantId)}`);
    if (!res.ok) return null;
    return (await res.json()) as CloudRunnerLeaderboardSnapshot;
  } catch {
    return null;
  }
}

export async function submitCloudRunnerScore(params: {
  variantId: string;
  score: number;
  combo: number;
  distance: number;
  coins?: number;
  nickname?: string;
}): Promise<CloudRunnerLeaderboardSnapshot | null> {
  try {
    const res = await fetch("/api/samples/runner-leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    return (await res.json()) as CloudRunnerLeaderboardSnapshot;
  } catch {
    return null;
  }
}
