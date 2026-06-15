import Phaser from "phaser";
import type { GameSpec } from "@/lib/game-spec";
import type { FarmingCrop } from "@/lib/farming-blueprint";

function hexToNum(hex: string): number {
  const parsed = parseInt(hex.replace("#", ""), 16);
  return Number.isFinite(parsed) ? parsed : 0x365314;
}

function shiftHex(c: number, d: number): number {
  const r = Phaser.Math.Clamp(((c >> 16) & 0xff) + d, 0, 255);
  const g = Phaser.Math.Clamp(((c >> 8) & 0xff) + d, 0, 255);
  const b = Phaser.Math.Clamp((c & 0xff) + d, 0, 255);
  return (r << 16) | (g << 8) | b;
}

/** 田园天空 + 草地 + 可选木栅栏 */
export function paintFarmingGardenBackdrop(
  scene: Phaser.Scene,
  spec: GameSpec,
  w: number,
  h: number,
  opts?: { decorativeFence?: boolean; gridOx: number; gridOy: number; gridW: number; gridH: number },
): void {
  const bg = hexToNum(spec.theme.backgroundColor);
  const sky = scene.add.graphics().setDepth(-5);
  sky.fillGradientStyle(0x7dd3fc, 0x7dd3fc, shiftHex(bg, 8), bg, 1);
  sky.fillRect(0, 0, w, h * 0.42);

  const grass = scene.add.graphics().setDepth(-4);
  grass.fillGradientStyle(shiftHex(bg, 12), shiftHex(bg, 4), shiftHex(bg, -8), shiftHex(bg, -16), 1);
  grass.fillRect(0, h * 0.38, w, h * 0.62);

  scene.add.circle(w * 0.82, h * 0.12, 28, 0xfef08a, 0.92).setDepth(-3);
  for (let i = 0; i < 3; i += 1) {
    const cx = w * (0.15 + i * 0.22);
    scene.add.ellipse(cx, h * 0.1, 56 + i * 12, 22, 0xffffff, 0.55).setDepth(-3);
  }

  if (opts?.decorativeFence) {
    const pad = 18;
    const fx = opts.gridOx - pad;
    const fy = opts.gridOy - pad;
    const fw = opts.gridW + pad * 2;
    const fh = opts.gridH + pad * 2;
    const fence = scene.add.graphics().setDepth(1);
    fence.fillStyle(0x78350f, 0.35);
    fence.fillRoundedRect(fx, fy, fw, fh, 8);
    fence.lineStyle(4, 0xfde047, 0.7);
    fence.strokeRoundedRect(fx, fy, fw, fh, 8);
    fence.lineStyle(2, 0xa16207, 0.5);
    for (let x = fx + 8; x < fx + fw; x += 22) {
      fence.lineBetween(x, fy, x, fy + fh);
    }
  }
}

const CROP_EMOJI: Record<string, string> = {
  carrot: "🥕",
  tomato: "🍅",
  corn: "🌽",
  sunflower: "🌻",
  berry: "🫐",
};

export function cropEmoji(cropId: string): string {
  return CROP_EMOJI[cropId] ?? "🌱";
}

/** 在格心绘制作物（stage 0–4：土→芽→叶→花→成熟） */
export function drawCropPlant(
  g: Phaser.GameObjects.Graphics,
  crop: FarmingCrop,
  stage: number,
  cx: number,
  cy: number,
  cell: number,
): void {
  g.clear();
  const col = hexToNum(crop.color);
  const s = Phaser.Math.Clamp(stage, 0, 4);
  const scale = cell * 0.38;

  if (s <= 0) return;

  if (s === 1) {
    g.fillStyle(0x84cc16, 1);
    g.fillRoundedRect(cx - 3, cy + 2, 6, 10, 2);
    return;
  }

  g.fillStyle(col, 1);
  if (crop.id === "corn") {
    g.fillRoundedRect(cx - scale * 0.22, cy - scale * 0.1, scale * 0.44, scale * 0.7, 4);
    g.fillStyle(0x16a34a, 0.9);
    g.fillTriangle(cx - scale * 0.5, cy, cx - scale * 0.2, cy - scale * 0.5, cx, cy);
    g.fillTriangle(cx + scale * 0.5, cy, cx + scale * 0.2, cy - scale * 0.5, cx, cy);
  } else if (crop.id === "sunflower") {
    g.fillStyle(0x854d0e, 1);
    g.fillCircle(cx, cy + scale * 0.15, scale * 0.12);
    g.fillStyle(0xfacc15, 1);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      g.fillEllipse(cx + Math.cos(a) * scale * 0.28, cy + Math.sin(a) * scale * 0.22, scale * 0.14, scale * 0.1);
    }
    g.fillStyle(0x713f12, 1);
    g.fillCircle(cx, cy + scale * 0.12, scale * 0.16);
  } else if (crop.id === "carrot") {
    g.fillStyle(0x16a34a, 0.9);
    g.fillTriangle(cx - scale * 0.15, cy - scale * 0.35, cx, cy - scale * 0.55, cx + scale * 0.15, cy - scale * 0.35);
    g.fillStyle(col, 1);
    g.fillTriangle(cx - scale * 0.2, cy - scale * 0.05, cx, cy + scale * 0.35, cx + scale * 0.2, cy - scale * 0.05);
  } else if (crop.id === "tomato") {
    g.fillStyle(0x16a34a, 0.85);
    g.fillEllipse(cx - scale * 0.3, cy - scale * 0.1, scale * 0.22, scale * 0.12);
    g.fillEllipse(cx + scale * 0.3, cy - scale * 0.1, scale * 0.22, scale * 0.12);
    g.fillStyle(col, 1);
    g.fillCircle(cx, cy + scale * 0.1, scale * (0.22 + s * 0.06));
    g.fillStyle(0x14532d, 0.6);
    g.fillCircle(cx - scale * 0.08, cy + scale * 0.02, scale * 0.04);
  } else {
    g.fillCircle(cx, cy + scale * 0.08, scale * (0.2 + s * 0.08));
    g.fillStyle(0x16a34a, 0.85);
    g.fillEllipse(cx - scale * 0.35, cy - scale * 0.05, scale * 0.28, scale * 0.14);
    g.fillEllipse(cx + scale * 0.35, cy - scale * 0.05, scale * 0.28, scale * 0.14);
  }

  if (s >= 4) {
    g.lineStyle(2, 0xfef08a, 0.75);
    g.strokeCircle(cx, cy, scale * 0.42);
  }
}

export function soilFillForState(state: string, cropColor?: string, progress = 0): number {
  if (state === "empty") return 0x3f6212;
  if (state === "seeded") return 0x4d7c0f;
  if (state === "growing") {
    const base = cropColor ? hexToNum(cropColor) : 0x365314;
    return Phaser.Display.Color.GetColor(
      Phaser.Math.Linear(0x36, (base >> 16) & 0xff, progress * 0.35),
      Phaser.Math.Linear(0x53, (base >> 8) & 0xff, progress * 0.35),
      Phaser.Math.Linear(0x14, base & 0xff, progress * 0.35),
    );
  }
  if (state === "ready") return cropColor ? hexToNum(cropColor) : 0x65a30d;
  return 0x365314;
}
