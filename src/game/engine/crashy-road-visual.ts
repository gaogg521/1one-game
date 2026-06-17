import Phaser from "phaser";
import type { CrashyObstacleStyle } from "@/game/engine/crashy-road-patterns";

export function drawCrashyRoadBackdrop(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  scrollPhase: number,
): void {
  gfx.fillGradientStyle(0x0f172a, 0x1e3a5f, 0x334155, 0x475569, 1);
  gfx.fillRect(0, 0, w, h);

  for (let i = 0; i < 10; i += 1) {
    const x = ((i * 97 + Math.floor(scrollPhase * 40)) % (w + 80)) - 40;
    const y = h * (0.08 + (i % 4) * 0.06);
    gfx.fillStyle(0x64748b, 0.22);
    gfx.fillCircle(x, y, 16 + (i % 3) * 8);
  }

  const horizon = h * 0.28;
  gfx.fillStyle(0x1e293b, 0.55);
  gfx.fillRect(0, horizon - 8, w, h * 0.1);
}

export function drawCrashyLaneMarkings(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  laneW: number,
  laneCenterX: (lane: number, depth: number, width: number, laneWidth: number) => number,
  scrollPhase: number,
): void {
  const horizon = h * 0.3;
  for (let lane = -1; lane <= 1; lane += 1) {
    const cx = laneCenterX(lane, 0.72, w, laneW);
    gfx.fillStyle(lane === 0 ? 0x334155 : 0x1e293b, lane === 0 ? 0.88 : 0.82);
    gfx.fillRect(cx - laneW * 0.42, horizon, laneW * 0.84, h - horizon - 40);
    gfx.lineStyle(2, lane === 0 ? 0xfbbf24 : 0x94a3b8, lane === 0 ? 0.5 : 0.32);
    gfx.lineBetween(cx - laneW * 0.42, horizon, cx - laneW * 0.42, h - 40);
    gfx.lineBetween(cx + laneW * 0.42, horizon, cx + laneW * 0.42, h - 40);
    for (let dash = horizon + 16 + ((scrollPhase * 60) % 48); dash < h - 50; dash += 48) {
      gfx.fillStyle(0xffffff, 0.2);
      gfx.fillRect(cx - 3, dash, 6, 16);
    }
  }
}

export function drawCrashyObstacleGfx(
  gfx: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  ow: number,
  oh: number,
  depth: number,
  style: CrashyObstacleStyle,
): void {
  const alpha = 0.55 + depth * 0.4;
  if (style === "barrier") {
    gfx.fillStyle(0x7f1d1d, alpha * 0.65);
    gfx.fillRoundedRect(cx - ow / 2 + 2, y + 2, ow, oh, 5);
    gfx.fillStyle(0xef4444, alpha);
    gfx.fillRoundedRect(cx - ow / 2, y, ow, oh, 5);
    gfx.fillStyle(0xfbbf24, 0.85);
    gfx.fillRect(cx - ow * 0.38, y + oh * 0.2, ow * 0.76, oh * 0.18);
    return;
  }
  if (style === "wreck") {
    gfx.fillStyle(0x292524, alpha);
    gfx.fillRoundedRect(cx - ow / 2, y + oh * 0.2, ow, oh * 0.75, 6);
    gfx.fillStyle(0x57534e, alpha * 0.9);
    gfx.fillRoundedRect(cx - ow * 0.35, y, ow * 0.7, oh * 0.45, 4);
    gfx.fillStyle(0x1e293b, 1);
    gfx.fillCircle(cx - ow * 0.22, y + oh * 0.88, oh * 0.16);
    gfx.fillCircle(cx + ow * 0.22, y + oh * 0.88, oh * 0.16);
    return;
  }
  gfx.fillStyle(0xf97316, alpha);
  gfx.fillTriangle(cx, y, cx - ow * 0.42, y + oh, cx + ow * 0.42, y + oh);
  gfx.fillStyle(0xffffff, 0.75);
  gfx.fillRect(cx - ow * 0.08, y + oh * 0.28, ow * 0.16, oh * 0.42);
}

export function drawCrashyLivesHud(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  lives: number,
  maxLives: number,
): void {
  gfx.fillStyle(0x1e293b, 0.82);
  gfx.fillRoundedRect(x, y, 18 + maxLives * 22, 28, 8);
  for (let i = 0; i < maxLives; i += 1) {
    const hx = x + 12 + i * 22;
    const filled = i < lives;
    gfx.fillStyle(filled ? 0xef4444 : 0x334155, filled ? 0.92 : 0.55);
    gfx.fillCircle(hx, y + 14, 7);
    if (filled) {
      gfx.fillStyle(0xffffff, 0.35);
      gfx.fillCircle(hx - 2, y + 12, 2);
    }
  }
}

export function drawCrashyDodgeCombo(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  streak: number,
  pulse: number,
  zh: boolean,
): void {
  if (streak < 2) return;
  const tier = streak >= 6 ? 3 : streak >= 4 ? 2 : 1;
  const s = 1 + pulse * 0.08;
  const pw = (zh ? 88 : 96) * s;
  const ph = 30 * s;
  const colors = [0x38bdf8, 0xa855f7, 0xf59e0b];
  const color = colors[tier - 1]!;
  gfx.fillStyle(0x0f172a, 0.88);
  gfx.fillRoundedRect(x - pw / 2, y, pw, ph, 8);
  gfx.lineStyle(2, color, 0.75);
  gfx.strokeRoundedRect(x - pw / 2, y, pw, ph, 8);
  gfx.fillStyle(color, 0.22);
  gfx.fillRoundedRect(x - pw / 2 + 4, y + 4, pw - 8, ph * 0.45, 5);
}

export function drawCrashyLaneWarning(
  gfx: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  ow: number,
  depth: number,
): void {
  if (depth < 0.25 || depth > 0.62) return;
  const pulse = 0.4 + Math.sin(depth * 14) * 0.2;
  gfx.lineStyle(2, 0xf87171, 0.45 * pulse);
  gfx.strokeRoundedRect(cx - ow / 2 - 4, y - 4, ow + 8, ow * 0.65 + 8, 6);
}
