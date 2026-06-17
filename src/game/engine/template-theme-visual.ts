import Phaser from "phaser";
import type { GameSpec } from "@/lib/game-spec";
import type { PuzzleMode } from "@/lib/puzzle-blueprint";

export type ThemeMood = "ocean" | "forest" | "space" | "cyber" | "generic";

export function inferThemeMood(spec: GameSpec): ThemeMood {
  const blob = `${spec.labels.subtitle ?? ""} ${spec.title}`.toLowerCase();
  if (/海|珊瑚|水下|ocean|sea|coral|bubble/.test(blob)) return "ocean";
  if (/森林|树|草地|丛林|forest|jungle|tree|meadow/.test(blob)) return "forest";
  if (/太空|宇宙|星|银河|space|galaxy|star|cosmos/.test(blob)) return "space";
  if (/赛博|霓虹|cyber|neon|数字|digital/.test(blob)) return "cyber";
  return "generic";
}

function hexToNum(hex: string): number {
  const parsed = parseInt(hex.replace("#", ""), 16);
  return Number.isFinite(parsed) ? parsed : 0x1a2220;
}

function shiftHex(c: number, d: number): number {
  const r = Phaser.Math.Clamp(((c >> 16) & 0xff) + d, 0, 255);
  const g = Phaser.Math.Clamp(((c >> 8) & 0xff) + d, 0, 255);
  const b = Phaser.Math.Clamp((c & 0xff) + d, 0, 255);
  return (r << 16) | (g << 8) | b;
}

/** platformer 族：三层视差剪影（scrollFactor 递减，随镜头滚动） */
export function paintPlatformerParallax(
  scene: Phaser.Scene,
  spec: GameSpec,
  worldW: number,
  viewH: number,
): void {
  const mood = inferThemeMood(spec);
  const bg = hexToNum(spec.theme.backgroundColor);
  const tint = hexToNum(spec.theme.particleTint ?? spec.theme.collectibleColor ?? "#38bdf8");

  const sky = scene.add.graphics().setDepth(-18).setScrollFactor(0);
  const top = shiftHex(bg, 28);
  const mid = bg;
  sky.fillGradientStyle(top, top, mid, shiftHex(bg, -12), 1);
  sky.fillRect(0, 0, scene.scale.width, viewH);

  const layers: Array<{ factor: number; depth: number; alpha: number; lift: number }> = [
    { factor: 0.08, depth: -17, alpha: 0.45, lift: 0.18 },
    { factor: 0.22, depth: -16, alpha: 0.62, lift: 0.1 },
    { factor: 0.42, depth: -15, alpha: 0.78, lift: 0.04 },
  ];

  for (const layer of layers) {
    const g = scene.add.graphics().setDepth(layer.depth).setScrollFactor(layer.factor).setAlpha(layer.alpha);
    const ground = viewH - 36 - layer.lift * viewH;

    switch (mood) {
      case "space": {
        for (let i = 0; i < 24; i += 1) {
          const x = (i * 173) % worldW;
          const y = 40 + ((i * 97) % Math.floor(viewH * 0.55));
          g.fillStyle(i % 3 === 0 ? 0xffffff : tint, 0.35 + (i % 5) * 0.08);
          g.fillCircle(x, y, 1.5 + (i % 4));
        }
        for (let p = 0; p < 4; p += 1) {
          const x = (p * 900 + 120) % worldW;
          g.fillStyle(tint, 0.12);
          g.fillCircle(x, 80 + p * 30, 28 + p * 8);
        }
        break;
      }
      case "ocean": {
        g.fillStyle(tint, 0.22);
        for (let x = 0; x < worldW; x += 160) {
          g.fillEllipse(x + 60, ground + 20, 36, 50 + (x % 40));
          g.fillEllipse(x + 90, ground + 10, 24, 36);
        }
        g.fillStyle(0xbae6fd, 0.08);
        g.fillRect(0, ground - 20, worldW, viewH);
        break;
      }
      case "forest": {
        const trunk = shiftHex(bg, -35);
        for (let x = 0; x < worldW; x += 70 + (x % 60)) {
          const th = 50 + (x % 90);
          const tw = 24 + (x % 30);
          g.fillStyle(trunk, 0.5);
          g.fillRect(x + tw / 2 - 4, ground - 40, 8, 40);
          g.fillStyle(shiftHex(tint, -20), 0.35);
          g.fillCircle(x + tw / 2, ground - 40 - th * 0.35, tw / 2);
          g.fillCircle(x + tw / 2 - tw * 0.25, ground - 40 - th * 0.25, tw / 2.8);
          g.fillCircle(x + tw / 2 + tw * 0.25, ground - 40 - th * 0.25, tw / 2.8);
        }
        break;
      }
      case "cyber": {
        g.lineStyle(1, tint, 0.14);
        for (let gx = 0; gx < worldW; gx += 64) g.lineBetween(gx, ground - 120, gx, viewH);
        for (let gy = ground - 120; gy < viewH; gy += 48) g.lineBetween(0, gy, worldW, gy);
        for (let i = 0; i < 18; i += 1) {
          g.fillStyle(tint, 0.35);
          g.fillCircle((i * 241) % worldW, ground - 60 + (i % 6) * 14, 2 + (i % 3));
        }
        break;
      }
      default: {
        const hill = shiftHex(bg, -22);
        for (let hx = 0; hx < worldW; hx += 280) {
          g.fillStyle(hill, 0.55);
          g.fillEllipse(hx + 140, ground + 8, 320, 90);
          g.fillEllipse(hx + 300, ground + 16, 220, 60);
        }
        break;
      }
    }
  }
}

/** puzzle 族：渐变底 + 模式装饰框（非 sampleId 分支） */
export function paintPuzzleThemeBackdrop(
  scene: Phaser.Scene,
  spec: GameSpec,
  w: number,
  h: number,
  mode: PuzzleMode,
): void {
  const bg = hexToNum(spec.theme.backgroundColor);
  const accent = hexToNum(spec.theme.collectibleColor ?? spec.theme.playerColor);
  const player = hexToNum(spec.theme.playerColor);

  const backdrop = scene.add.graphics().setDepth(-8);
  backdrop.fillGradientStyle(shiftHex(bg, 18), shiftHex(bg, 18), bg, shiftHex(bg, -16), 1);
  backdrop.fillRect(0, 0, w, h);

  const frame = scene.add.graphics().setDepth(-6);
  frame.lineStyle(2, accent, 0.35);
  frame.strokeRoundedRect(12, 72, w - 24, h - 120, 14);
  frame.fillStyle(player, 0.06);
  frame.fillRoundedRect(12, 72, w - 24, h - 120, 14);

  const strip = scene.add.graphics().setDepth(-5);
  strip.fillStyle(accent, 0.12);
  strip.fillRoundedRect(20, 78, w - 40, 28, 8);
  const modeColors: Record<PuzzleMode, number> = {
    match3: 0xf472b6,
    spotDifference: 0xfde047,
    memoryMatch: 0xa78bfa,
    jigsaw: 0x38bdf8,
    merge2048: 0xfb923c,
  };
  strip.fillStyle(modeColors[mode], 0.55);
  strip.fillCircle(34, 92, 6);
  strip.fillCircle(48, 92, 6);
  strip.fillCircle(62, 92, 6);
}

/** 找不同双面板装饰框 */
export function paintSpotDiffPanels(
  scene: Phaser.Scene,
  spec: GameSpec,
  lx: number,
  rx: number,
  y: number,
  pw: number,
  ph: number,
): void {
  const accent = hexToNum(spec.theme.collectibleColor ?? spec.theme.playerColor);
  const hazard = hexToNum(spec.theme.hazardColor);
  for (const [x, label] of [[lx, "A"], [rx, "B"]] as const) {
    const g = scene.add.graphics().setDepth(1);
    g.lineStyle(3, accent, 0.65);
    g.strokeRoundedRect(x, y, pw, ph, 10);
    g.fillStyle(hazard, 0.08);
    g.fillRoundedRect(x + 4, y + 4, pw - 8, ph - 8, 8);
    scene.add
      .text(x + 14, y + 10, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#ffffff",
        backgroundColor: spec.theme.collectibleColor ?? spec.theme.playerColor,
        padding: { x: 6, y: 2 },
      })
      .setDepth(2);
  }
}

/** memory / jigsaw 棋盘区装饰 */
export function paintPuzzleBoardFrame(
  scene: Phaser.Scene,
  spec: GameSpec,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const accent = hexToNum(spec.theme.collectibleColor ?? spec.theme.playerColor);
  const g = scene.add.graphics().setDepth(0);
  g.lineStyle(2, accent, 0.4);
  g.strokeRoundedRect(x - 8, y - 8, w + 16, h + 16, 10);
  g.fillStyle(accent, 0.05);
  g.fillRoundedRect(x - 8, y - 8, w + 16, h + 16, 10);
}

/** coaster 族：天空渐变 + 地平线光带（Primary 伪 3D） */
export function paintCoasterSkyBackdrop(
  scene: Phaser.Scene,
  spec: GameSpec,
  w: number,
  h: number,
  endlessRoad: boolean,
): void {
  const mood = inferThemeMood(spec);
  const bg = hexToNum(spec.theme.backgroundColor);
  const accent = hexToNum(spec.theme.collectibleColor ?? spec.theme.playerColor);
  const sky = scene.add.graphics().setDepth(-3).setScrollFactor(0);
  const top = shiftHex(bg, endlessRoad ? 32 : 24);
  sky.fillGradientStyle(top, top, bg, shiftHex(bg, -8), 1);
  sky.fillRect(0, 0, w, h);
  const horizon = h * (endlessRoad ? 0.3 : 0.34);
  const band = scene.add.graphics().setDepth(-2).setScrollFactor(0);
  band.fillStyle(accent, mood === "space" ? 0.18 : 0.12);
  band.fillRect(0, horizon - 6, w, 12);
  if (mood === "space") {
    for (let i = 0; i < 40; i += 1) {
      scene.add
        .circle((i * 47) % w, (i * 29) % Math.floor(horizon), 1 + (i % 3), 0xffffff, 0.35 + (i % 4) * 0.12)
        .setDepth(-2)
        .setScrollFactor(0);
    }
  }
}

/** customization 族：工作室灯光与展示台 */
export function paintCustomizationStudio(
  scene: Phaser.Scene,
  spec: GameSpec,
  w: number,
  h: number,
  mode: "carPaint" | "pottery",
): void {
  const bg = hexToNum(spec.theme.backgroundColor);
  const accent = hexToNum(spec.theme.collectibleColor ?? spec.theme.playerColor);
  const backdrop = scene.add.graphics().setDepth(-4);
  backdrop.fillGradientStyle(shiftHex(bg, 14), shiftHex(bg, 14), shiftHex(bg, -18), shiftHex(bg, -28), 1);
  backdrop.fillRect(0, 0, w, h);
  const stage = scene.add.graphics().setDepth(-3);
  const sy = h * (mode === "pottery" ? 0.58 : 0.52);
  stage.fillStyle(0x000000, 0.22);
  stage.fillEllipse(w / 2, sy, w * 0.55, 48);
  stage.lineStyle(2, accent, 0.35);
  stage.strokeEllipse(w / 2, sy, w * 0.55, 48);
  const spot = scene.add.graphics().setDepth(-2);
  spot.fillStyle(accent, 0.08);
  spot.fillTriangle(w / 2 - 80, 0, w / 2 + 80, 0, w / 2, h * 0.45);
}
