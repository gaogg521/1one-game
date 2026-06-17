import Phaser from "phaser";
import type { RunnerRunRecap } from "@/lib/runner-leaderboard";

function formatSurvival(sec: number, zh: boolean): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m <= 0) return zh ? `${s} 秒` : `${s}s`;
  return zh ? `${m} 分 ${s} 秒` : `${m}m ${s}s`;
}

function causeLabel(cause: RunnerRunRecap["cause"], zh: boolean): string {
  if (cause === "caught") return zh ? "被追上" : "Caught";
  if (cause === "lives") return zh ? "生命耗尽" : "Out of lives";
  return zh ? "撞障" : "Crash";
}

export function drawRunnerDeathRecapPanel(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  recap: RunnerRunRecap,
  zh: boolean,
): { panelW: number; panelH: number; x: number; y: number } {
  const panelW = Math.min(300, w - 24);
  const panelH = recap.coins != null ? 118 : 104;
  const x = (w - panelW) / 2;
  const y = Math.max(96, h - panelH - 108);

  gfx.fillStyle(0x0f172a, 0.9);
  gfx.fillRoundedRect(x, y, panelW, panelH, 12);
  gfx.lineStyle(1.5, recap.beatPrevBest ? 0xfbbf24 : 0x64748b, recap.beatPrevBest ? 0.75 : 0.5);
  gfx.strokeRoundedRect(x, y, panelW, panelH, 12);
  gfx.fillStyle(recap.beatPrevBest ? 0xfbbf24 : 0x38bdf8, 0.2);
  gfx.fillRoundedRect(x + 6, y + 6, panelW - 12, 22, 6);

  return { panelW, panelH, x, y };
}

export function runnerDeathRecapLines(recap: RunnerRunRecap, zh: boolean): string[] {
  const lines = [
    zh ? `距离 ${recap.distance} m` : `${recap.distance} m`,
    zh ? `最高连击 x${recap.maxCombo}` : `Best combo x${recap.maxCombo}`,
    zh ? `存活 ${formatSurvival(recap.survivalSec, zh)}` : `Time ${formatSurvival(recap.survivalSec, zh)}`,
    zh ? `死因 · ${causeLabel(recap.cause, zh)}` : `Cause · ${causeLabel(recap.cause, zh)}`,
  ];
  if (recap.coins != null) {
    lines.unshift(zh ? `金币 ${recap.coins}` : `${recap.coins} coins`);
  }
  if (recap.beatPrevBest) {
    lines.push(zh ? "超越个人最佳！" : "New personal best!");
  } else if (recap.prevBestScore > 0) {
    const gap = recap.prevBestScore - recap.score;
    lines.push(zh ? `距最佳还差 ${gap}` : `${gap} below best`);
  }
  return lines;
}

export function runnerDeathRecapTitle(recap: RunnerRunRecap, zh: boolean): string {
  return zh ? `本局 ${recap.score} 分` : `Run · ${recap.score}`;
}
