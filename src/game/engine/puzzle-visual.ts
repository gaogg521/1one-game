import Phaser from "phaser";
import type { GameSpec } from "@/lib/game-spec";

function hexToNum(hex: string): number {
  const parsed = parseInt(hex.replace("#", ""), 16);
  return Number.isFinite(parsed) ? parsed : 0x6366f1;
}

function shiftHex(c: number, d: number): number {
  const r = Phaser.Math.Clamp(((c >> 16) & 0xff) + d, 0, 255);
  const g = Phaser.Math.Clamp(((c >> 8) & 0xff) + d, 0, 255);
  const b = Phaser.Math.Clamp((c & 0xff) + d, 0, 255);
  return (r << 16) | (g << 8) | b;
}

/** Color Bloom 治愈渐变 + 漂浮光斑 */
export function paintColorBloomBackdrop(scene: Phaser.Scene, spec: GameSpec, w: number, h: number): void {
  const bg = hexToNum(spec.theme.backgroundColor);
  const accent = hexToNum(spec.theme.collectibleColor ?? "#f472b6");
  const sky = scene.add.graphics().setDepth(-8);
  sky.fillGradientStyle(0xfdf2f8, 0xfdf2f8, shiftHex(bg, 6), bg, 1);
  sky.fillRect(0, 0, w, h);

  for (let i = 0; i < 14; i += 1) {
    const cx = (i * 97 + 40) % w;
    const cy = 60 + ((i * 53) % Math.floor(h * 0.55));
    const r = 18 + (i % 5) * 8;
    scene.add.circle(cx, cy, r, accent, 0.06 + (i % 3) * 0.03).setDepth(-7);
  }

  const frame = scene.add.graphics().setDepth(-6);
  frame.lineStyle(2, accent, 0.28);
  frame.strokeRoundedRect(10, 68, w - 20, h - 116, 16);
  frame.fillStyle(0xffffff, 0.04);
  frame.fillRoundedRect(10, 68, w - 20, h - 116, 16);
}

/** 光泽宝石块（match3） */
export function drawMatch3Gem(
  g: Phaser.GameObjects.Graphics,
  colorHex: string,
  x: number,
  y: number,
  size: number,
  rich = false,
): void {
  const col = hexToNum(colorHex);
  const pad = 3;
  const w = size - pad * 2;
  const h = size - pad * 2;
  const rx = x + pad;
  const ry = y + pad;

  g.fillStyle(shiftHex(col, -40), 0.55);
  g.fillRoundedRect(rx + 2, ry + 3, w, h, rich ? 10 : 6);

  g.fillStyle(col, 1);
  g.fillRoundedRect(rx, ry, w, h, rich ? 10 : 6);

  if (rich) {
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(rx + w * 0.32, ry + h * 0.28, w * 0.28, h * 0.18);
    g.lineStyle(1.5, shiftHex(col, 30), 0.5);
    g.strokeRoundedRect(rx, ry, w, h, 10);
  }
}

/** 找不同 —  whimsical 插画场景（左右面板可微调差异） */
export function paintWhimsyPanelScene(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  pw: number,
  ph: number,
  seed: number,
  variant: "left" | "right",
): void {
  g.clear();
  const sky = variant === "left" ? 0xc4b5fd : 0xfbcfe8;
  const grass = variant === "left" ? 0x86efac : 0x6ee7b7;
  g.fillStyle(sky, 0.35);
  g.fillRoundedRect(x + 4, y + 4, pw - 8, ph - 8, 8);
  g.fillStyle(grass, 0.25);
  g.fillRect(x + 4, y + ph * 0.55, pw - 8, ph * 0.4);

  const sunX = x + pw * (variant === "left" ? 0.78 : 0.72);
  g.fillStyle(0xfde047, 0.7);
  g.fillCircle(sunX, y + ph * 0.18, 16);

  for (let i = 0; i < 3; i += 1) {
    const cx = x + pw * (0.15 + i * 0.28);
    const cy = y + ph * (0.12 + (i % 2) * 0.04);
    g.fillStyle(0xffffff, 0.5);
    g.fillEllipse(cx, cy, 36 + i * 8, 14);
  }

  const treeCount = variant === "left" ? 3 : 3;
  for (let i = 0; i < treeCount; i += 1) {
    const tx = x + pw * (0.12 + i * 0.3);
    const ty = y + ph * 0.62;
    const th = 28 + ((seed + i * 7) % 20);
    g.fillStyle(0x854d0e, 0.7);
    g.fillRect(tx - 3, ty - 8, 6, 18);
    g.fillStyle(variant === "left" && i === 1 ? 0x4ade80 : 0x22c55e, 0.75);
    g.fillCircle(tx, ty - th * 0.4, 14 + (i % 2) * 4);
  }

  if (variant === "right") {
    g.fillStyle(0xf472b6, 0.55);
    g.fillCircle(x + pw * 0.55, y + ph * 0.42, 8);
  } else {
    g.fillStyle(0xa78bfa, 0.55);
    g.fillCircle(x + pw * 0.48, y + ph * 0.38, 6);
  }

  if (variant === "left") {
    g.fillStyle(0xfbbf24, 0.6);
    g.fillRect(x + pw * 0.62, y + ph * 0.7, 22, 14);
    g.fillTriangle(x + pw * 0.62, y + ph * 0.7, x + pw * 0.73, y + ph * 0.7, x + pw * 0.675, y + ph * 0.62);
  }
}

const MEMORY_EMOJIS = ["🌸", "🦋", "🍀", "⭐", "🎈", "🍄", "🌈", "🐝", "🍎", "🎵", "🌙", "🔮"];

export function memoryCardEmoji(id: number): string {
  return MEMORY_EMOJIS[id % MEMORY_EMOJIS.length] ?? "✨";
}

/** 儿童拼图块 emoji */
export function kidsJigsawEmoji(pieceIdx: number): string {
  const emojis = ["🐶", "🐱", "🐰", "🦊", "🐻", "🐼", "🦁", "🐸", "🐯"];
  return emojis[pieceIdx % emojis.length] ?? "⭐";
}

/** 塔防合成格 — 枪械/剑塔 tier 图标 */
export function mergeTierLabel(tier: number, variantId?: string): string {
  if (tier <= 0) return "";
  if (variantId === "blade-defender-merge") {
    return ["", "🗡️", "⚔️", "🔱", "👑"][tier] ?? `${tier}`;
  }
  return ["", "🔫", "🔫×2", "💥", "🏆"][tier] ?? `${tier}`;
}

export function mergeTierColor(tier: number): number {
  return [0, 0x64748b, 0x38bdf8, 0xa78bfa, 0xfbbf24][tier] ?? 0x1e293b;
}
