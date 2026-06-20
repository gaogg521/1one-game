import Phaser from "phaser";
import type { AssetStyle } from "@/lib/cohesive-presentation";

/**
 * 高保真程序化 Platformer 资产渲染器。
 *
 * 给 PlatformerScene 用。玩家精灵复用 play-assets.ts 的 buildPlayAssetSet（保持气质一致），
 * 这里专注于平台 / 地面 / 尖刺 / 终点旗 / 弹簧等关卡构件，并按 assetStyle 出 4 套材质：
 *  - classic-arcade / 80s-cartoon：木板平台 + 草地
 *  - blocky-pixel：方块平台 + 像素地
 *  - dark-fantasy / neon-cyber / bullet-hell：石/金属平台 + 红光尖刺
 *  - nature-organic / paper-craft / kawaii-mecha / cute-cartoon：草地/苔藓
 */

export type PlatformerPalette = {
  player: string;
  hazard: string;
  collectible: string;
  particle: string;
  background: string;
  platformMid: string;
  platformHi: string;
  platformGround: string;
};

export type PlatformerAssetSet = {
  platformShort: string;
  platformLong: string;
  ground: string;
  spike: string;
  flag: string;
  spring: string;
};

const PLAT_W = 192;
const PLAT_H = 36;
const PLAT_LONG_W = 320;
const GROUND_W = 128;
const GROUND_H = 64;
const SPIKE_W = 72;
const SPIKE_H = 36;
const FLAG_W = 64;
const FLAG_H = 128;
const SPRING_W = 64;
const SPRING_H = 48;

function hexC(h: string) {
  return Phaser.Display.Color.HexStringToColor(h);
}
function uint(h: string): number {
  return hexC(h).color;
}
function lighten(h: string, t: number): number {
  return hexC(h).lighten(Math.floor(t * 100)).color;
}
function darken(h: string, t: number): number {
  return hexC(h).darken(Math.floor(t * 100)).color;
}
function mg(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.make.graphics({ x: 0, y: 0 });
}

type Family = "wood" | "stone" | "grass" | "pixel" | "metal";

function chooseFamily(style: AssetStyle): Family {
  switch (style) {
    case "blocky-pixel":
      return "pixel";
    case "dark-fantasy":
    case "bullet-hell":
    case "neon-cyber":
      return "metal";
    case "nature-organic":
    case "paper-craft":
    case "kawaii-mecha":
    case "cute-cartoon":
      return "grass";
    case "80s-cartoon":
    case "wuxia-flight":
      return "stone";
    default:
      return "wood";
  }
}

// ─── Platforms ───────────────────────────────────────────────────

function drawPlatformWood(g: Phaser.GameObjects.Graphics, pal: PlatformerPalette, w: number, h: number) {
  const mid = uint(pal.platformMid);
  const hi = uint(pal.platformHi);
  const dk = darken(pal.platformMid, 0.42);
  g.fillStyle(dk, 1);
  g.fillRoundedRect(0, 2, w, h - 2, 6);
  g.fillStyle(mid, 1);
  g.fillRoundedRect(0, 0, w, h - 4, 6);
  g.fillStyle(hi, 0.6);
  g.fillRoundedRect(4, 2, w - 8, 8, 4);
  // 木纹
  g.lineStyle(1.4, dk, 0.45);
  for (let x = 24; x < w; x += 26) g.lineBetween(x, 4, x, h - 6);
  // 钉子
  g.fillStyle(0x000000, 0.55);
  g.fillCircle(10, h / 2, 2);
  g.fillCircle(w - 10, h / 2, 2);
}

function drawPlatformStone(g: Phaser.GameObjects.Graphics, pal: PlatformerPalette, w: number, h: number) {
  const mid = uint(pal.platformMid);
  const hi = uint(pal.platformHi);
  const dk = darken(pal.platformMid, 0.55);
  // 主体
  g.fillStyle(dk, 1);
  g.fillRoundedRect(0, 2, w, h - 2, 4);
  g.fillStyle(mid, 1);
  g.fillRoundedRect(0, 0, w, h - 6, 4);
  g.fillStyle(hi, 0.55);
  g.fillRect(2, 2, w - 4, 4);
  // 砖缝
  g.lineStyle(1.5, dk, 0.55);
  const brick = 32;
  for (let x = brick; x < w; x += brick) g.lineBetween(x, 2, x, h - 6);
  g.lineBetween(0, h / 2, w, h / 2);
}

function drawPlatformGrass(g: Phaser.GameObjects.Graphics, pal: PlatformerPalette, w: number, h: number) {
  const mid = uint(pal.platformMid);
  const dk = darken(pal.platformMid, 0.42);
  const grass = uint("#4ade80");
  const grassDk = uint("#16a34a");
  // 泥土主体
  g.fillStyle(dk, 1);
  g.fillRoundedRect(0, 8, w, h - 8, 6);
  g.fillStyle(mid, 1);
  g.fillRoundedRect(0, 6, w, h - 12, 6);
  // 草顶
  g.fillStyle(grassDk, 1);
  g.fillRect(0, 0, w, 10);
  g.fillStyle(grass, 1);
  g.fillRect(0, 0, w, 6);
  // 草尖
  for (let x = 4; x < w; x += 8) {
    g.fillStyle(grass, 1);
    g.fillTriangle(x, 0, x - 3, 6, x + 3, 6);
  }
}

function drawPlatformPixel(g: Phaser.GameObjects.Graphics, pal: PlatformerPalette, w: number, h: number) {
  const mid = uint(pal.platformMid);
  const dk = darken(pal.platformMid, 0.4);
  const hi = lighten(pal.platformMid, 0.3);
  const tile = 16;
  for (let x = 0; x < w; x += tile) {
    g.fillStyle(dk, 1);
    g.fillRect(x, 0, tile, h);
    g.fillStyle(mid, 1);
    g.fillRect(x + 2, 2, tile - 4, h - 4);
    g.fillStyle(hi, 0.6);
    g.fillRect(x + 2, 2, tile - 4, 4);
  }
}

function drawPlatformMetal(g: Phaser.GameObjects.Graphics, pal: PlatformerPalette, w: number, h: number) {
  const mid = uint(pal.platformMid);
  const hi = lighten(pal.platformMid, 0.45);
  const dk = darken(pal.platformMid, 0.55);
  const glow = uint(pal.collectible);
  // 金属底
  g.fillStyle(dk, 1);
  g.fillRoundedRect(0, 2, w, h - 2, 4);
  g.fillStyle(mid, 1);
  g.fillRoundedRect(0, 0, w, h - 6, 4);
  // 顶部高光条
  g.fillStyle(hi, 0.7);
  g.fillRect(4, 2, w - 8, 2);
  // 能量条
  g.fillStyle(glow, 0.85);
  g.fillRect(8, h - 14, w - 16, 3);
  for (let x = 14; x < w - 12; x += 24) {
    g.fillStyle(glow, 1);
    g.fillCircle(x, h - 12, 2);
  }
}

function drawPlatform(g: Phaser.GameObjects.Graphics, pal: PlatformerPalette, w: number, h: number, family: Family) {
  switch (family) {
    case "stone":
      return drawPlatformStone(g, pal, w, h);
    case "grass":
      return drawPlatformGrass(g, pal, w, h);
    case "pixel":
      return drawPlatformPixel(g, pal, w, h);
    case "metal":
      return drawPlatformMetal(g, pal, w, h);
    default:
      return drawPlatformWood(g, pal, w, h);
  }
}

// ─── Ground tile ─────────────────────────────────────────────────

function drawGround(g: Phaser.GameObjects.Graphics, pal: PlatformerPalette, w: number, h: number, family: Family) {
  const main = uint(pal.platformGround);
  const dk = darken(pal.platformGround, 0.42);
  const hi = lighten(pal.platformGround, 0.18);
  g.fillStyle(main, 1);
  g.fillRect(0, 0, w, h);
  // 顶部 highlight
  g.fillStyle(hi, 0.35);
  g.fillRect(0, 0, w, 4);
  // 纹理
  if (family === "pixel") {
    const tile = 16;
    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        g.lineStyle(1, dk, 0.4);
        g.strokeRect(x, y, tile, tile);
      }
    }
  } else if (family === "stone" || family === "metal") {
    g.lineStyle(1.5, dk, 0.5);
    const brick = 32;
    for (let y = 12; y < h; y += 14) {
      g.lineBetween(0, y, w, y);
      const off = y % 28 === 12 ? brick / 2 : 0;
      for (let x = off; x < w; x += brick) g.lineBetween(x, y - 14, x, y);
    }
  } else if (family === "grass") {
    g.fillStyle(uint("#15803d"), 1);
    g.fillRect(0, 0, w, 6);
    g.fillStyle(uint("#22c55e"), 1);
    for (let x = 0; x < w; x += 6) {
      g.fillTriangle(x + 1, 6, x + 3, 0, x + 5, 6);
    }
  } else {
    // wood / 默认：纹理斑点
    g.fillStyle(dk, 0.18);
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 2; c += 1) {
        const off = r % 2 === 0 ? 0 : 16;
        g.fillRect(c * 32 + off, r * 16 + 4, 30, 12);
      }
    }
  }
  // 底部阴影
  g.fillStyle(0x000000, 0.18);
  g.fillRect(0, h - 4, w, 4);
}

// ─── Spike ───────────────────────────────────────────────────────

function drawSpike(g: Phaser.GameObjects.Graphics, pal: PlatformerPalette, w: number, h: number, family: Family) {
  const main = uint(pal.hazard);
  const dk = darken(pal.hazard, 0.55);
  const hi = lighten(pal.hazard, 0.35);
  // 阴影 base
  g.fillStyle(dk, 0.7);
  g.fillRect(0, h - 6, w, 4);
  // 6 个三角尖刺
  const spikes = 4;
  const step = w / spikes;
  for (let i = 0; i < spikes; i += 1) {
    const cx = step / 2 + i * step;
    g.fillStyle(dk, 1);
    g.fillTriangle(cx - step / 2 + 2, h - 4, cx, 4, cx + step / 2 - 2, h - 4);
    g.fillStyle(main, 1);
    g.fillTriangle(cx - step / 2 + 4, h - 6, cx, 8, cx + step / 2 - 4, h - 6);
    g.fillStyle(hi, 0.75);
    g.fillTriangle(cx - 2, h - 8, cx, 10, cx + 2, h - 8);
    if (family === "metal" || family === "stone") {
      g.fillStyle(0xfff7c4, 1);
      g.fillCircle(cx, h - 8, 1);
    }
  }
}

// ─── Flag (终点) ───────────────────────────────────────────────────

function drawFlag(g: Phaser.GameObjects.Graphics, pal: PlatformerPalette, w: number, h: number) {
  const pole = uint("#cbd5e1");
  const poleDk = darken("#cbd5e1", 0.4);
  const flagMain = uint(pal.collectible);
  const flagDk = darken(pal.collectible, 0.35);
  const flagHi = lighten(pal.collectible, 0.3);
  const baseY = h - 6;
  // 阴影
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(w / 2, baseY + 2, 32, 6);
  // 旗杆
  g.fillStyle(poleDk, 1);
  g.fillRect(w / 2 - 3, 6, 4, baseY);
  g.fillStyle(pole, 1);
  g.fillRect(w / 2 - 2, 6, 2, baseY);
  // 顶部球
  g.fillStyle(pole, 1);
  g.fillCircle(w / 2 - 1, 6, 4);
  g.fillStyle(0xffffff, 0.65);
  g.fillCircle(w / 2 - 2, 5, 1.5);
  // 旗
  const fy = 12;
  const fh = 28;
  g.fillStyle(flagDk, 1);
  g.fillTriangle(w / 2, fy, w / 2 + 38, fy + fh / 2, w / 2, fy + fh);
  g.fillStyle(flagMain, 1);
  g.fillTriangle(w / 2 + 2, fy + 2, w / 2 + 32, fy + fh / 2, w / 2 + 2, fy + fh - 2);
  g.fillStyle(flagHi, 0.55);
  g.fillTriangle(w / 2 + 2, fy + 4, w / 2 + 16, fy + fh / 2, w / 2 + 2, fy + fh - 4);
  // 星标
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(w / 2 + 10, fy + fh / 2, 3);
}

// ─── Spring ──────────────────────────────────────────────────────

function drawSpring(g: Phaser.GameObjects.Graphics, pal: PlatformerPalette, w: number, h: number) {
  const main = uint(pal.collectible);
  const dk = darken(pal.collectible, 0.45);
  const hi = lighten(pal.collectible, 0.4);
  // 底座
  g.fillStyle(dk, 1);
  g.fillRoundedRect(4, h - 10, w - 8, 8, 3);
  // 弹簧线圈
  g.lineStyle(3, main, 1);
  for (let i = 0; i < 4; i += 1) {
    const yy = h - 14 - i * 5;
    g.strokeRoundedRect(10, yy, w - 20, 5, 2);
  }
  // 顶板
  g.fillStyle(hi, 1);
  g.fillRoundedRect(2, 0, w - 4, 8, 3);
  g.fillStyle(main, 1);
  g.fillRoundedRect(4, 1, w - 8, 5, 2);
}

// ─── Builder ─────────────────────────────────────────────────────

export function buildPlatformerAssetSet(
  scene: Phaser.Scene,
  pal: PlatformerPalette,
  style: AssetStyle,
  keyPrefix = "platAsset",
): PlatformerAssetSet {
  const set: PlatformerAssetSet = {
    platformShort: `${keyPrefix}_plat`,
    platformLong: `${keyPrefix}_platLong`,
    ground: `${keyPrefix}_ground`,
    spike: `${keyPrefix}_spike`,
    flag: `${keyPrefix}_flag`,
    spring: `${keyPrefix}_spring`,
  };

  const fam = chooseFamily(style);
  const mk = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const g = mg(scene);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  mk(set.platformShort, PLAT_W, PLAT_H, (g) => drawPlatform(g, pal, PLAT_W, PLAT_H, fam));
  mk(set.platformLong, PLAT_LONG_W, PLAT_H, (g) => drawPlatform(g, pal, PLAT_LONG_W, PLAT_H, fam));
  mk(set.ground, GROUND_W, GROUND_H, (g) => drawGround(g, pal, GROUND_W, GROUND_H, fam));
  mk(set.spike, SPIKE_W, SPIKE_H, (g) => drawSpike(g, pal, SPIKE_W, SPIKE_H, fam));
  mk(set.flag, FLAG_W, FLAG_H, (g) => drawFlag(g, pal, FLAG_W, FLAG_H));
  mk(set.spring, SPRING_W, SPRING_H, (g) => drawSpring(g, pal, SPRING_W, SPRING_H));

  return set;
}
