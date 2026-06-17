import Phaser from "phaser";
import type { RunnerLeaderboardEntry } from "@/lib/runner-leaderboard";

export function drawRunnerLeaderboardPanel(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  entries: readonly RunnerLeaderboardEntry[],
  zh: boolean,
): void {
  const rows = Math.min(3, entries.length);
  const panelH = 22 + Math.max(rows, 1) * 14;
  gfx.fillStyle(0x0f172a, 0.82);
  gfx.fillRoundedRect(x - w, y, w, panelH, 8);
  gfx.lineStyle(1, 0xfbbf24, 0.45);
  gfx.strokeRoundedRect(x - w, y, w, panelH, 8);
  gfx.fillStyle(0xfbbf24, 0.18);
  gfx.fillRoundedRect(x - w + 4, y + 4, w - 8, 14, 4);
}

export function formatLeaderboardRow(
  entry: RunnerLeaderboardEntry,
  rank: number,
  zh: boolean,
): string {
  const combo = entry.combo >= 2 ? (zh ? ` ·连击${entry.combo}` : ` ·x${entry.combo}`) : "";
  return `${rank}. ${entry.score}${combo}`;
}
