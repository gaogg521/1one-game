import Phaser from "phaser";
import type { GameSpec } from "@/lib/game-spec";
import type { PuzzleMode } from "@/lib/puzzle-blueprint";

export type ThemeMood = "ocean" | "forest" | "space" | "cyber" | "generic";

const ASSET_STYLE_MOOD: Partial<Record<string, ThemeMood>> = {
  "hard-sci-fi": "space",
  "neon-cyber": "cyber",
  "bullet-hell": "cyber",
  "kawaii-mecha": "cyber",
  "nature-organic": "forest",
  "cute-cartoon": "forest",
  "dark-fantasy": "forest",
  "wuxia-flight": "forest",
};

export function inferThemeMood(spec: GameSpec): ThemeMood {
  // 优先读 theme-adapter 写入的 phaserMood（千人千面深度适配）
  const phaserMood = spec.samplePlayProfile?.phaserMood;
  if (phaserMood === "ocean" || phaserMood === "forest" || phaserMood === "space" || phaserMood === "cyber") {
    return phaserMood;
  }
  const blob = `${spec.labels.subtitle ?? ""} ${spec.title}`.toLowerCase();
  if (/海|珊瑚|水下|ocean|sea|coral|bubble/.test(blob)) return "ocean";
  if (/森林|树|草地|丛林|forest|jungle|tree|meadow/.test(blob)) return "forest";
  if (/太空|宇宙|星|银河|space|galaxy|star|cosmos/.test(blob)) return "space";
  if (/赛博|霓虹|cyber|neon|数字|digital/.test(blob)) return "cyber";
  const assetMood = ASSET_STYLE_MOOD[spec.presentation?.assetStyle ?? ""];
  if (assetMood) return assetMood;
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

/** platformer 族：四层视差剪影（scrollFactor 递减，随镜头滚动） */
export function paintPlatformerParallax(
  scene: Phaser.Scene,
  spec: GameSpec,
  worldW: number,
  viewH: number,
): void {
  const mood = inferThemeMood(spec);
  const bg = hexToNum(spec.theme.backgroundColor);
  const tint = hexToNum(spec.theme.particleTint ?? spec.theme.collectibleColor ?? "#38bdf8");

  // Sky gradient (fixed to viewport)
  const sky = scene.add.graphics().setDepth(-20).setScrollFactor(0);
  const top = shiftHex(bg, 32);
  sky.fillGradientStyle(top, top, bg, shiftHex(bg, -18), 1);
  sky.fillRect(0, 0, scene.scale.width, viewH);

  // Vignette sides (depth cue)
  const vig = scene.add.graphics().setDepth(-19).setScrollFactor(0);
  vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.22, 0, 0, 0.22);
  vig.fillRect(0, 0, scene.scale.width * 0.12, viewH);
  vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.22, 0.22, 0);
  vig.fillRect(scene.scale.width * 0.88, 0, scene.scale.width * 0.12, viewH);

  const layers: Array<{ factor: number; depth: number; alpha: number; lift: number }> = [
    { factor: 0.04, depth: -18, alpha: 0.32, lift: 0.22 }, // deepest
    { factor: 0.12, depth: -17, alpha: 0.48, lift: 0.16 },
    { factor: 0.28, depth: -16, alpha: 0.66, lift: 0.08 },
    { factor: 0.48, depth: -15, alpha: 0.82, lift: 0.02 }, // nearest bg
  ];

  for (const [li, layer] of layers.entries()) {
    const g = scene.add.graphics().setDepth(layer.depth).setScrollFactor(layer.factor).setAlpha(layer.alpha);
    const ground = viewH - 36 - layer.lift * viewH;
    const scale = 0.55 + li * 0.15; // deeper layers = smaller elements

    switch (mood) {
      case "space": {
        // sceneDecorWords 精细化：nebula/planets/asteroids/holograms
        const decorWords = (spec.samplePlayProfile?.themeWords ?? []).join(" ").toLowerCase();
        const hasNebula = decorWords.includes("nebula");
        const hasPlanets = decorWords.includes("planet");
        const hasAsteroids = decorWords.includes("asteroid");
        const starCount = li === 0 ? 60 : li === 1 ? 36 : 18;
        for (let i = 0; i < starCount; i += 1) {
          const x = (i * (173 + li * 37)) % worldW;
          const y = 20 + ((i * (97 + li * 23)) % Math.floor(viewH * 0.65));
          const r = (0.8 + (i % 4) * 0.5) * scale;
          g.fillStyle(i % 5 === 0 ? tint : 0xffffff, 0.3 + (i % 5) * 0.1);
          g.fillCircle(x, y, r);
        }
        if (hasNebula && li < 2) {
          // 星云：大块半透明色团
          g.fillStyle(tint, 0.05 + li * 0.02);
          for (let n = 0; n < 3; n += 1) {
            const x = ((n * 533 + li * 200)) % worldW;
            g.fillEllipse(x, 80 + n * 50, 180 * scale, 70 * scale);
          }
          g.fillStyle(shiftHex(tint, 40), 0.04);
          for (let n = 0; n < 2; n += 1) {
            g.fillEllipse((n * 700 + 300) % worldW, 150 + n * 40, 140 * scale, 50 * scale);
          }
        }
        if (li < 2) {
          for (let p = 0; p < (hasPlanets ? 3 : 2); p += 1) {
            const x = ((p + li) * 880 + 120) % worldW;
            const r = (22 + p * 12) * scale;
            g.fillStyle(tint, 0.08 + li * 0.03);
            g.fillCircle(x, 70 + p * 28, r);
            g.fillStyle(shiftHex(tint, 30), 0.04);
            g.fillCircle(x - r * 0.3, 70 + p * 28 - r * 0.3, r * 0.55);
          }
        }
        if (hasAsteroids && li >= 1) {
          // 小行星带
          g.fillStyle(shiftHex(tint, -40), 0.3);
          for (let a = 0; a < 12; a += 1) {
            const x = (a * 137 + li * 80) % worldW;
            const y = viewH * 0.3 + ((a * 47) % 80);
            const r = (3 + (a % 4)) * scale;
            g.fillCircle(x, y, r);
          }
        }
        break;
      }
      case "ocean": {
        // sceneDecorWords 精细化：coral/seaweed/bubbles/fish-silhouettes
        const decorWords = (spec.samplePlayProfile?.themeWords ?? []).join(" ").toLowerCase();
        const hasCoral = decorWords.includes("coral");
        const hasSeaweed = decorWords.includes("seaweed");
        const hasBubbles = decorWords.includes("bubble");
        const hasFish = decorWords.includes("fish");
        if (li < 2) {
          if (hasSeaweed || !decorWords) {
            g.fillStyle(shiftHex(tint, -30), 0.3);
            for (let x = li * 80; x < worldW; x += 140) {
              const h = (40 + (x % 60)) * scale;
              g.fillEllipse(x + 30, ground - h * 0.5, (18 + (x % 20)) * scale, h);
              g.fillEllipse(x + 55, ground - h * 0.35, (12 + (x % 16)) * scale, h * 0.7);
            }
          }
          if (hasCoral) {
            // 珊瑚：分叉枝状
            g.fillStyle(0xf97316, 0.35);
            for (let x = li * 100; x < worldW; x += 160) {
              const h = (30 + (x % 40)) * scale;
              g.fillRect(x, ground - h, 3 * scale, h);
              g.fillRect(x - 8 * scale, ground - h * 0.7, 3 * scale, h * 0.4);
              g.fillRect(x + 5 * scale, ground - h * 0.85, 3 * scale, h * 0.5);
            }
          }
          g.fillStyle(0x7dd3fc, 0.06);
          g.fillRect(0, ground - 24, worldW, viewH);
        } else {
          if (hasBubbles) {
            for (let x = 0; x < worldW; x += 90 + (x % 50)) {
              const r = (3 + (x % 5)) * scale;
              g.lineStyle(1, 0xbae6fd, 0.22 + li * 0.06);
              g.strokeCircle(x, ground - (x % 80) - 20, r);
            }
          }
          if (hasFish && li >= 2) {
            // 鱼影
            g.fillStyle(shiftHex(tint, -50), 0.2);
            for (let f = 0; f < 5; f += 1) {
              const x = (f * 287 + li * 100) % worldW;
              const y = viewH * 0.25 + ((f * 73) % 100);
              g.fillEllipse(x, y, 22 * scale, 10 * scale);
              g.fillTriangle(x - 11 * scale, y, x - 18 * scale, y - 5 * scale, x - 18 * scale, y + 5 * scale);
            }
          }
        }
        break;
      }
      case "forest": {
        // sceneDecorWords 精细化：bamboo/mushrooms/vines/ink-mist 等驱动不同装饰
        const decorWords = (spec.samplePlayProfile?.themeWords ?? []).join(" ").toLowerCase();
        const hasBamboo = decorWords.includes("bamboo");
        const hasMushrooms = decorWords.includes("mushroom");
        const hasVines = decorWords.includes("vine");
        const hasInkMist = decorWords.includes("ink-mist");
        const trunk = shiftHex(bg, -40);
        const foliage = shiftHex(tint, -25);
        const spacing = 55 + li * 20;
        for (let x = li * 30; x < worldW; x += spacing + ((x * 7) % 45)) {
          const th = (45 + ((x * 3) % 80)) * scale;
          const tw = (20 + ((x * 5) % 28)) * scale;
          if (hasBamboo) {
            // 竹子：细长直杆 + 节
            g.fillStyle(shiftHex(tint, -35), 0.42);
            g.fillRect(x + tw / 2 - 2 * scale, ground - th, 4 * scale, th);
            for (let seg = 0; seg < 4; seg += 1) {
              g.fillStyle(shiftHex(tint, -50), 0.5);
              g.fillRect(x + tw / 2 - 3 * scale, ground - th * (0.25 + seg * 0.22), 6 * scale, 2 * scale);
            }
          } else {
            // 普通树：树干 + 树冠
            g.fillStyle(trunk, 0.45);
            g.fillRect(x + tw / 2 - 3 * scale, ground - th * 0.4, 6 * scale, th * 0.4);
            g.fillStyle(foliage, 0.38);
            g.fillCircle(x + tw / 2, ground - th * 0.55, tw * 0.55);
            g.fillStyle(shiftHex(foliage, 15), 0.18);
            g.fillCircle(x + tw / 2 - tw * 0.22, ground - th * 0.45, tw * 0.38);
            g.fillCircle(x + tw / 2 + tw * 0.22, ground - th * 0.45, tw * 0.38);
          }
        }
        // 精细化附加装饰
        if (hasMushrooms && li >= 1) {
          g.fillStyle(0xcb3a3a, 0.4);
          for (let x = li * 50; x < worldW; x += 90 + (x % 60)) {
            const mw = (8 + (x % 6)) * scale;
            g.fillRect(x, ground - mw * 1.2, 3 * scale, mw * 1.2);
            g.fillCircle(x + 1.5 * scale, ground - mw * 1.2, mw * 0.8);
          }
        }
        if (hasVines && li < 2) {
          g.lineStyle(2, shiftHex(tint, -20), 0.25);
          for (let x = li * 70; x < worldW; x += 120) {
            g.beginPath();
            g.moveTo(x, 0);
            g.lineTo(x + 8 * scale, 60 * scale);
            g.lineTo(x - 4 * scale, 120 * scale);
            g.strokePath();
          }
        }
        if (hasInkMist) {
          // 水墨雾气
          g.fillStyle(0xffffff, 0.06);
          for (let x = 0; x < worldW; x += 80) {
            g.fillEllipse(x, ground - 30 - (x % 40), 60 * scale, 14 * scale);
          }
        }
        // Ground fog strip on near layers
        if (li >= 2) {
          g.fillStyle(shiftHex(bg, 12), 0.12);
          g.fillRect(0, ground - 12, worldW, 28);
        }
        break;
      }
      case "cyber": {
        // sceneDecorWords 精细化：grid/neon-lines/data-streams/holograms/skyscrapers/neon-signs
        const decorWords = (spec.samplePlayProfile?.themeWords ?? []).join(" ").toLowerCase();
        const hasGrid = decorWords.includes("grid");
        const hasNeonLines = decorWords.includes("neon-line") || decorWords.includes("neon-sign");
        const hasDataStreams = decorWords.includes("data-stream");
        const hasHolograms = decorWords.includes("hologram");
        const hasSkyscrapers = decorWords.includes("skyscraper");
        if (hasGrid || !decorWords) {
          const gridStep = (80 - li * 12);
          g.lineStyle(1, tint, 0.06 + li * 0.04);
          for (let gx = 0; gx < worldW; gx += gridStep) g.lineBetween(gx, ground - 90, gx, viewH);
          for (let gy = ground - 90; gy < viewH; gy += gridStep * 0.75) g.lineBetween(0, gy, worldW, gy);
        }
        if (hasSkyscrapers && li < 3) {
          // 都市摩天楼剪影
          g.fillStyle(shiftHex(bg, -25 - li * 5), 0.5 + li * 0.1);
          for (let sx = li * 50; sx < worldW; sx += 70 + (sx % 50)) {
            const sw = (28 + (sx % 22)) * scale;
            const sh = (90 + (sx % 80)) * scale;
            g.fillRect(sx, ground - sh, sw, sh);
            // 窗户灯
            g.fillStyle(tint, 0.25);
            for (let wy = ground - sh + 8; wy < ground - 4; wy += 12 * scale) {
              for (let wx = sx + 4; wx < sx + sw - 4; wx += 8 * scale) {
                if ((wx + wy) % 3 === 0) g.fillRect(wx, wy, 2 * scale, 3 * scale);
              }
            }
            g.fillStyle(shiftHex(bg, -25 - li * 5), 0.5 + li * 0.1);
          }
        }
        if (hasNeonLines && li >= 1) {
          // 霓虹线条
          g.lineStyle(2, tint, 0.4);
          for (let nl = 0; nl < 4; nl += 1) {
            const y = viewH * 0.2 + nl * 40 * scale + li * 20;
            g.lineBetween(0, y, worldW, y);
          }
          g.lineStyle(1, shiftHex(tint, 60), 0.3);
          g.lineBetween(0, viewH * 0.5, worldW, viewH * 0.5);
        }
        if (hasDataStreams && li >= 1) {
          // 数据流：垂直短亮线
          g.fillStyle(tint, 0.3);
          for (let ds = 0; ds < 14; ds += 1) {
            const x = (ds * 197 + li * 90) % worldW;
            const y = (ds * 53) % Math.floor(viewH * 0.6);
            g.fillRect(x, y, 1.5 * scale, (10 + (ds % 8)) * scale);
          }
        }
        if (hasHolograms && li < 2) {
          // 全息投影环
          g.lineStyle(1.5, tint, 0.2);
          for (let h = 0; h < 3; h += 1) {
            const x = ((h * 631 + li * 200)) % worldW;
            const r = (30 + h * 15) * scale;
            g.strokeCircle(x, viewH * 0.35 + h * 30, r);
            g.strokeCircle(x, viewH * 0.35 + h * 30, r * 0.6);
          }
        }
        // Glowing data nodes
        const nodeCount = 8 + li * 4;
        for (let i = 0; i < nodeCount; i += 1) {
          const nx = (i * (241 + li * 53)) % worldW;
          const ny = ground - 40 - ((i * 29) % 80);
          const nr = (1.5 + (i % 3)) * scale;
          g.fillStyle(tint, 0.45);
          g.fillCircle(nx, ny, nr);
          if (li >= 2) {
            g.fillStyle(tint, 0.12);
            g.fillCircle(nx, ny, nr * 2.5);
          }
        }
        break;
      }
      default: {
        const hill = shiftHex(bg, -18 - li * 6);
        const hillW = (300 - li * 30) * (1 + li * 0.2);
        for (let hx = li * 60; hx < worldW; hx += hillW * 0.85) {
          g.fillStyle(hill, 0.5 + li * 0.06);
          g.fillEllipse(hx + hillW / 2, ground + 10, hillW, (80 + li * 10) * scale);
          g.fillStyle(shiftHex(hill, 8), 0.2);
          g.fillEllipse(hx + hillW * 0.75, ground + 18, hillW * 0.65, (55 + li * 8) * scale);
        }
        break;
      }
    }
  }

  // Ambient floating dust motes (nearest layer — scroll with world at 0.7x)
  const dustCount = mood === "space" ? 0 : 18;
  for (let i = 0; i < dustCount; i += 1) {
    const x = (i * 397) % worldW;
    const y = 60 + ((i * 131) % (viewH - 120));
    const r = 1.2 + (i % 3) * 0.8;
    const dot = scene.add.circle(x, y, r, tint, 0.18 + (i % 4) * 0.05).setDepth(-14).setScrollFactor(0.7);
    scene.tweens.add({
      targets: dot,
      y: y - 18 - (i % 12) * 3,
      alpha: { from: dot.alpha, to: 0 },
      duration: 3200 + (i % 7) * 800,
      delay: (i * 340) % 3000,
      repeat: -1,
      yoyo: false,
      onRepeat: () => { dot.setPosition(x, y); dot.setAlpha(0.18 + (i % 4) * 0.05); },
    });
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
