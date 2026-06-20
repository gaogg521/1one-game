import Phaser from "phaser";
import type { AssetStyle } from "@/lib/cohesive-presentation";

/**
 * 高保真程序化 Play 资产渲染器。
 *
 * 给 PlayScene（collector / survivor / avoider）以及 PhysicsScene 共用。
 * 与 shooter-assets.ts 同等水准：96-160 px 多层 canvas，描边 / 主体 / 高光 / 光晕 / 阴影。
 *
 * 提供 5 套全模板皮肤（assetStyle 驱动）：
 *  - classic-arcade：经典圆胖角色 + 棱角危险物
 *  - cute-cartoon：萌系大眼角色 + 圆胖怪
 *  - nature-organic：自然有机风（树叶造型）
 *  - dark-fantasy：暗黑奇幻角色 + 邪眼怪
 *  - blocky-pixel：方块像素（Minecraft 风）
 * 其它 assetStyle 会自动 fallback 到最接近的。
 */

export type PlayPalette = {
  player: string;
  hazard: string;
  collectible: string;
  particle: string;
  background: string;
};

export type PlayAssetSet = {
  player: string;
  hazardBasic: string;
  hazardFast: string;
  hazardHeavy: string;
  boss: string;
  gem: string;
  power: string;
  /** Boss 子弹球（orb） */
  bossOrb: string;
};

const SIZE_PLAYER = 96;
const SIZE_HAZARD = 96;
const SIZE_BOSS = 192;
const SIZE_GEM = 64;
const SIZE_POWER = 72;
const SIZE_ORB = 32;

function hex(hex: string) {
  return Phaser.Display.Color.HexStringToColor(hex);
}
function uint(h: string): number {
  return hex(h).color;
}
function lighten(h: string, t: number): number {
  return hex(h).lighten(Math.floor(t * 100)).color;
}
function darken(h: string, t: number): number {
  return hex(h).darken(Math.floor(t * 100)).color;
}
function mix(a: string, b: string, t: number): number {
  const A = hex(a);
  const B = hex(b);
  return Phaser.Display.Color.GetColor(
    Math.round(A.red + (B.red - A.red) * t),
    Math.round(A.green + (B.green - A.green) * t),
    Math.round(A.blue + (B.blue - A.blue) * t),
  );
}
function mg(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.make.graphics({ x: 0, y: 0 });
}

// ─── 玩家：4 套 ─────────────────────────────────────────────────────

function drawPlayerArcade(g: Phaser.GameObjects.Graphics, pal: PlayPalette, s: number) {
  const cx = s / 2;
  const cy = s / 2;
  const main = uint(pal.player);
  const dk = darken(pal.player, 0.35);
  const hi = lighten(pal.player, 0.32);
  const eye = uint(pal.collectible);

  // 阴影
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, s * 0.92, s * 0.55, s * 0.1);

  // 主体：圆胖角色
  g.lineStyle(3, dk, 1);
  g.strokeRoundedRect(s * 0.18, s * 0.2, s * 0.64, s * 0.6, 18);
  g.fillStyle(main, 1);
  g.fillRoundedRect(s * 0.18, s * 0.2, s * 0.64, s * 0.6, 18);

  // 高光
  g.fillStyle(hi, 0.55);
  g.fillRoundedRect(s * 0.24, s * 0.26, s * 0.34, s * 0.16, 8);

  // 头部
  g.lineStyle(3, dk, 1);
  g.strokeCircle(cx, s * 0.28, s * 0.16);
  g.fillStyle(lighten(pal.player, 0.2), 1);
  g.fillCircle(cx, s * 0.28, s * 0.16);

  // 眼睛
  g.fillStyle(0x0f172a, 1);
  g.fillCircle(cx - s * 0.06, s * 0.28, s * 0.04);
  g.fillCircle(cx + s * 0.06, s * 0.28, s * 0.04);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx - s * 0.05, s * 0.27, s * 0.014);
  g.fillCircle(cx + s * 0.07, s * 0.27, s * 0.014);

  // 胸口徽章
  g.fillStyle(eye, 1);
  g.fillCircle(cx, s * 0.5, s * 0.07);
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(cx - 0.01, s * 0.49, s * 0.025);

  // 双脚
  g.fillStyle(dk, 1);
  g.fillRoundedRect(s * 0.24, s * 0.78, s * 0.18, s * 0.1, 4);
  g.fillRoundedRect(s * 0.58, s * 0.78, s * 0.18, s * 0.1, 4);
}

function drawPlayerKawaii(g: Phaser.GameObjects.Graphics, pal: PlayPalette, s: number) {
  const cx = s / 2;
  const cy = s / 2;
  const main = uint(pal.player);
  const dk = darken(pal.player, 0.25);
  const hi = lighten(pal.player, 0.42);

  // 阴影
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx, s * 0.92, s * 0.6, s * 0.1);

  // 圆滚滚一团
  g.fillStyle(dk, 1);
  g.fillCircle(cx, cy + s * 0.05, s * 0.36);
  g.fillStyle(main, 1);
  g.fillCircle(cx, cy + s * 0.02, s * 0.32);

  // 高光
  g.fillStyle(hi, 0.6);
  g.fillEllipse(cx - s * 0.1, cy - s * 0.08, s * 0.16, s * 0.1);

  // 大眼睛
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - s * 0.1, cy - s * 0.02, s * 0.09);
  g.fillCircle(cx + s * 0.1, cy - s * 0.02, s * 0.09);
  g.fillStyle(0x0f172a, 1);
  g.fillCircle(cx - s * 0.09, cy, s * 0.05);
  g.fillCircle(cx + s * 0.11, cy, s * 0.05);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - s * 0.07, cy - 0.02, s * 0.022);
  g.fillCircle(cx + s * 0.13, cy - 0.02, s * 0.022);

  // 嘴
  g.lineStyle(3, 0x0f172a, 1);
  g.beginPath();
  g.arc(cx, cy + s * 0.12, s * 0.04, 0.2, Math.PI - 0.2, false);
  g.strokePath();

  // 腮红
  g.fillStyle(0xffb4c5, 0.65);
  g.fillCircle(cx - s * 0.16, cy + s * 0.06, s * 0.04);
  g.fillCircle(cx + s * 0.16, cy + s * 0.06, s * 0.04);
}

function drawPlayerNature(g: Phaser.GameObjects.Graphics, pal: PlayPalette, s: number) {
  const cx = s / 2;
  const cy = s / 2;
  const main = uint(pal.player);
  const dk = darken(pal.player, 0.4);
  const hi = lighten(pal.player, 0.35);

  // 阴影
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(cx, s * 0.92, s * 0.55, s * 0.08);

  // 叶状身体
  g.fillStyle(dk, 1);
  g.fillTriangle(cx, s * 0.08, cx - s * 0.36, s * 0.78, cx + s * 0.36, s * 0.78);
  g.fillStyle(main, 1);
  g.fillTriangle(cx, s * 0.15, cx - s * 0.3, s * 0.74, cx + s * 0.3, s * 0.74);

  // 叶脉
  g.lineStyle(2, dk, 0.8);
  g.lineBetween(cx, s * 0.18, cx, s * 0.74);
  g.lineBetween(cx, s * 0.36, cx - s * 0.16, s * 0.5);
  g.lineBetween(cx, s * 0.36, cx + s * 0.16, s * 0.5);
  g.lineBetween(cx, s * 0.55, cx - s * 0.2, s * 0.7);
  g.lineBetween(cx, s * 0.55, cx + s * 0.2, s * 0.7);

  // 高光
  g.fillStyle(hi, 0.4);
  g.fillTriangle(cx - s * 0.02, s * 0.2, cx - s * 0.18, s * 0.5, cx, s * 0.5);

  // 小眼睛在叶中
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - s * 0.06, cy, s * 0.04);
  g.fillCircle(cx + s * 0.06, cy, s * 0.04);
  g.fillStyle(0x0f172a, 1);
  g.fillCircle(cx - s * 0.05, cy + 0.01, s * 0.02);
  g.fillCircle(cx + s * 0.07, cy + 0.01, s * 0.02);
}

function drawPlayerDarkFantasy(g: Phaser.GameObjects.Graphics, pal: PlayPalette, s: number) {
  const cx = s / 2;
  const cy = s / 2;
  const main = uint(pal.player);
  const dk = darken(pal.player, 0.5);
  const hi = lighten(pal.player, 0.3);
  const glow = uint(pal.collectible);

  // 红色光环
  for (let i = 4; i > 0; i -= 1) {
    g.fillStyle(glow, 0.06 * i);
    g.fillCircle(cx, cy + s * 0.05, s * 0.34 + i * 4);
  }

  // 暗黑披风
  g.fillStyle(dk, 1);
  g.fillTriangle(cx - s * 0.4, s * 0.82, cx - s * 0.08, s * 0.2, cx - s * 0.04, s * 0.8);
  g.fillTriangle(cx + s * 0.4, s * 0.82, cx + s * 0.08, s * 0.2, cx + s * 0.04, s * 0.8);

  // 主体
  g.lineStyle(3, dk, 1);
  g.strokeRoundedRect(s * 0.24, s * 0.22, s * 0.52, s * 0.56, 12);
  g.fillStyle(main, 1);
  g.fillRoundedRect(s * 0.24, s * 0.22, s * 0.52, s * 0.56, 12);
  g.fillStyle(hi, 0.4);
  g.fillRoundedRect(s * 0.3, s * 0.28, s * 0.3, s * 0.14, 6);

  // 兜帽阴影
  g.fillStyle(0x000000, 0.55);
  g.fillEllipse(cx, s * 0.32, s * 0.36, s * 0.22);

  // 邪眼（红）
  g.fillStyle(0xff2a44, 1);
  g.fillCircle(cx - s * 0.07, s * 0.32, s * 0.04);
  g.fillCircle(cx + s * 0.07, s * 0.32, s * 0.04);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(cx - s * 0.07, s * 0.32, s * 0.015);
  g.fillCircle(cx + s * 0.07, s * 0.32, s * 0.015);

  // 符文
  g.fillStyle(glow, 0.95);
  g.fillCircle(cx, s * 0.56, s * 0.05);
}

function drawPlayerBlocky(g: Phaser.GameObjects.Graphics, pal: PlayPalette, s: number) {
  const main = uint(pal.player);
  const dk = darken(pal.player, 0.4);
  const hi = lighten(pal.player, 0.3);

  // 阴影
  g.fillStyle(0x000000, 0.22);
  g.fillRect(s * 0.16, s * 0.88, s * 0.68, s * 0.06);

  // 头部
  g.fillStyle(dk, 1);
  g.fillRect(s * 0.22, s * 0.1, s * 0.56, s * 0.34);
  g.fillStyle(main, 1);
  g.fillRect(s * 0.26, s * 0.14, s * 0.48, s * 0.26);

  // 像素眼
  g.fillStyle(0xffffff, 1);
  g.fillRect(s * 0.32, s * 0.22, s * 0.1, s * 0.08);
  g.fillRect(s * 0.58, s * 0.22, s * 0.1, s * 0.08);
  g.fillStyle(0x0f172a, 1);
  g.fillRect(s * 0.36, s * 0.24, s * 0.05, s * 0.05);
  g.fillRect(s * 0.62, s * 0.24, s * 0.05, s * 0.05);

  // 身体
  g.fillStyle(dk, 1);
  g.fillRect(s * 0.26, s * 0.46, s * 0.48, s * 0.34);
  g.fillStyle(main, 1);
  g.fillRect(s * 0.3, s * 0.5, s * 0.4, s * 0.3);
  g.fillStyle(hi, 0.4);
  g.fillRect(s * 0.32, s * 0.52, s * 0.36, s * 0.06);

  // 腿
  g.fillStyle(dk, 1);
  g.fillRect(s * 0.3, s * 0.82, s * 0.16, s * 0.1);
  g.fillRect(s * 0.54, s * 0.82, s * 0.16, s * 0.1);
}

// ─── 危险物：3 类（normal / fast / heavy） ─────────────────────────

function drawHazardSpike(g: Phaser.GameObjects.Graphics, pal: PlayPalette, s: number, scale: "basic" | "fast" | "heavy") {
  const cx = s / 2;
  const cy = s / 2;
  const main = uint(pal.hazard);
  const dk = darken(pal.hazard, 0.42);
  const hi = lighten(pal.hazard, 0.32);
  const eyeRed = 0xff2a44;

  // 阴影
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, s * 0.92, s * 0.52, s * 0.08);

  // 顶部尖刺冠
  const spikes = scale === "heavy" ? 5 : scale === "fast" ? 3 : 4;
  g.fillStyle(dk, 1);
  for (let i = 0; i < spikes; i += 1) {
    const xc = s * 0.18 + (i / (spikes - 1)) * s * 0.64;
    g.fillTriangle(xc - s * 0.06, s * 0.18, xc, s * 0.04, xc + s * 0.06, s * 0.18);
  }

  // 主体
  g.lineStyle(3, dk, 1);
  g.strokeRoundedRect(s * 0.14, s * 0.18, s * 0.72, s * 0.6, scale === "heavy" ? 10 : 16);
  g.fillStyle(main, 1);
  g.fillRoundedRect(s * 0.14, s * 0.18, s * 0.72, s * 0.6, scale === "heavy" ? 10 : 16);
  g.fillStyle(hi, 0.4);
  g.fillRoundedRect(s * 0.2, s * 0.22, s * 0.4, s * 0.14, 6);

  // 怒目
  g.fillStyle(0xfff7c4, 1);
  g.fillEllipse(cx - s * 0.14, cy - s * 0.02, s * 0.16, s * 0.12);
  g.fillEllipse(cx + s * 0.14, cy - s * 0.02, s * 0.16, s * 0.12);
  g.fillStyle(0x1a0000, 1);
  g.fillCircle(cx - s * 0.13, cy - s * 0.01, s * 0.05);
  g.fillCircle(cx + s * 0.15, cy - s * 0.01, s * 0.05);
  g.fillStyle(eyeRed, 0.8);
  g.fillCircle(cx - s * 0.13, cy - s * 0.01, s * 0.025);
  g.fillCircle(cx + s * 0.15, cy - s * 0.01, s * 0.025);

  // 锯齿牙
  g.fillStyle(0xffffff, 1);
  const teethY = s * 0.62;
  for (let i = 0; i < 5; i += 1) {
    const tx = s * 0.32 + i * s * 0.08;
    g.fillTriangle(tx, teethY, tx + s * 0.04, teethY + s * 0.08, tx + s * 0.08, teethY);
  }

  // fast 加速度线
  if (scale === "fast") {
    g.lineStyle(2, hi, 0.7);
    g.lineBetween(s * 0.04, s * 0.4, s * 0.18, s * 0.4);
    g.lineBetween(s * 0.06, s * 0.55, s * 0.18, s * 0.55);
  }
  // heavy 装甲
  if (scale === "heavy") {
    g.lineStyle(4, lighten(pal.collectible, 0.1), 1);
    g.strokeRect(s * 0.18, s * 0.32, s * 0.64, s * 0.1);
    g.fillStyle(uint(pal.collectible), 1);
    g.fillCircle(cx - s * 0.22, s * 0.38, 4);
    g.fillCircle(cx + s * 0.22, s * 0.38, 4);
  }
}

function drawHazardOrb(g: Phaser.GameObjects.Graphics, pal: PlayPalette, s: number) {
  // 通用 ORB（暗黑/萌系/弹幕共用的圆形危险物）
  const cx = s / 2;
  const cy = s / 2;
  const main = uint(pal.hazard);
  const dk = darken(pal.hazard, 0.45);
  const hi = lighten(pal.hazard, 0.38);

  for (let i = 4; i > 0; i -= 1) {
    g.fillStyle(main, 0.07 * i);
    g.fillCircle(cx, cy, s * 0.32 + i * 4);
  }
  g.fillStyle(dk, 1);
  g.fillCircle(cx, cy, s * 0.36);
  g.fillStyle(main, 1);
  g.fillCircle(cx, cy, s * 0.3);
  g.fillStyle(hi, 0.4);
  g.fillEllipse(cx - s * 0.08, cy - s * 0.08, s * 0.16, s * 0.1);

  // 邪眼
  g.fillStyle(0xfff7c4, 1);
  g.fillEllipse(cx, cy + s * 0.02, s * 0.3, s * 0.18);
  g.fillStyle(0x1a0000, 1);
  g.fillCircle(cx, cy + s * 0.04, s * 0.08);
  g.fillStyle(0xff2a44, 0.85);
  g.fillCircle(cx, cy + s * 0.04, s * 0.04);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx + 0.012, cy + s * 0.03, s * 0.018);
}

function drawBlockyHazard(g: Phaser.GameObjects.Graphics, pal: PlayPalette, s: number) {
  const main = uint(pal.hazard);
  const dk = darken(pal.hazard, 0.4);
  const hi = lighten(pal.hazard, 0.3);

  g.fillStyle(0x000000, 0.22);
  g.fillRect(s * 0.16, s * 0.88, s * 0.68, s * 0.06);
  g.fillStyle(dk, 1);
  g.fillRect(s * 0.18, s * 0.08, s * 0.64, s * 0.36);
  g.fillStyle(main, 1);
  g.fillRect(s * 0.22, s * 0.12, s * 0.56, s * 0.28);

  // 像素红眼
  g.fillStyle(0xff2a44, 1);
  g.fillRect(s * 0.3, s * 0.22, s * 0.1, s * 0.08);
  g.fillRect(s * 0.6, s * 0.22, s * 0.1, s * 0.08);

  // 身体
  g.fillStyle(dk, 1);
  g.fillRect(s * 0.24, s * 0.46, s * 0.52, s * 0.36);
  g.fillStyle(main, 1);
  g.fillRect(s * 0.28, s * 0.5, s * 0.44, s * 0.3);
  g.fillStyle(hi, 0.3);
  g.fillRect(s * 0.3, s * 0.52, s * 0.4, s * 0.06);
}

// ─── Boss ────────────────────────────────────────────────────────

function drawBoss(g: Phaser.GameObjects.Graphics, pal: PlayPalette, s: number, style: AssetStyle) {
  const cx = s / 2;
  const cy = s / 2;
  const main = uint(pal.hazard);
  const dk = darken(pal.hazard, 0.5);
  const hi = lighten(pal.hazard, 0.32);
  const accent = uint(pal.collectible);
  const glow = uint(pal.particle);

  // 大光晕
  for (let i = 6; i > 0; i -= 1) {
    g.fillStyle(glow, 0.05 * i);
    g.fillCircle(cx, cy, s * 0.4 + i * 6);
  }

  if (style === "dark-fantasy" || style === "bullet-hell" || style === "neon-cyber") {
    // 多边形 boss
    const sides = 10;
    const r = s * 0.4;
    const inner = s * 0.34;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < sides * 2; i += 1) {
      const a = (i / (sides * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : inner;
      pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
    }
    g.fillStyle(dk, 1);
    g.fillPoints(pts, true);
    g.fillStyle(main, 1);
    const pts2 = pts.map((p) => new Phaser.Math.Vector2(cx + (p.x - cx) * 0.86, cy + (p.y - cy) * 0.86));
    g.fillPoints(pts2, true);
    // 核心
    g.fillStyle(accent, 1);
    g.fillCircle(cx, cy, s * 0.14);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx, cy, s * 0.07);
    return;
  }

  // 默认：圆胖大 boss
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(cx, s * 0.92, s * 0.6, s * 0.08);
  g.fillStyle(dk, 1);
  g.fillCircle(cx, cy + s * 0.04, s * 0.42);
  g.fillStyle(main, 1);
  g.fillCircle(cx, cy, s * 0.38);
  g.fillStyle(hi, 0.45);
  g.fillEllipse(cx - s * 0.08, cy - s * 0.12, s * 0.22, s * 0.14);

  // 大眼睛
  g.fillStyle(0xfef3c7, 1);
  g.fillEllipse(cx - s * 0.14, cy - s * 0.04, s * 0.18, s * 0.14);
  g.fillEllipse(cx + s * 0.14, cy - s * 0.04, s * 0.18, s * 0.14);
  g.fillStyle(0x0f172a, 1);
  g.fillCircle(cx - s * 0.13, cy - s * 0.04, s * 0.06);
  g.fillCircle(cx + s * 0.15, cy - s * 0.04, s * 0.06);
  g.fillStyle(0xff3344, 0.9);
  g.fillCircle(cx - s * 0.13, cy - s * 0.04, s * 0.025);
  g.fillCircle(cx + s * 0.15, cy - s * 0.04, s * 0.025);

  // 大口
  g.fillStyle(0x1a0000, 1);
  g.fillEllipse(cx, cy + s * 0.16, s * 0.24, s * 0.08);
  // 牙
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < 6; i += 1) {
    const tx = cx - s * 0.1 + i * s * 0.04;
    g.fillTriangle(tx, cy + s * 0.13, tx + s * 0.02, cy + s * 0.18, tx + s * 0.04, cy + s * 0.13);
  }
}

// ─── Gem / Power-up / Orb ─────────────────────────────────────────

function drawGem(g: Phaser.GameObjects.Graphics, pal: PlayPalette, s: number) {
  const cx = s / 2;
  const cy = s / 2;
  const main = uint(pal.collectible);
  const dk = darken(pal.collectible, 0.35);
  const hi = lighten(pal.collectible, 0.5);
  const glow = uint(pal.particle);

  // 光晕
  for (let i = 3; i > 0; i -= 1) {
    g.fillStyle(glow, 0.1 * i);
    g.fillCircle(cx, cy, s * 0.34 + i * 3);
  }

  // 钻石
  const w = s * 0.22;
  const h = s * 0.3;
  g.fillStyle(dk, 1);
  g.fillTriangle(cx, cy - h, cx + w + 2, cy, cx, cy + h);
  g.fillTriangle(cx, cy - h, cx - w - 2, cy, cx, cy + h);
  g.fillStyle(main, 1);
  g.fillTriangle(cx, cy - h * 0.92, cx + w, cy, cx, cy + h * 0.92);
  g.fillTriangle(cx, cy - h * 0.92, cx - w, cy, cx, cy + h * 0.92);

  // 高光
  g.fillStyle(hi, 0.85);
  g.fillTriangle(cx, cy - h * 0.6, cx + w * 0.55, cy, cx, cy + h * 0.2);
  // 中心闪
  g.fillStyle(0xffffff, 0.95);
  g.fillTriangle(cx - 2, cy - 4, cx + 2, cy - 4, cx, cy + 4);
}

function drawPower(g: Phaser.GameObjects.Graphics, pal: PlayPalette, s: number) {
  const cx = s / 2;
  const cy = s / 2;
  const main = uint(pal.collectible);
  const glow = uint(pal.particle);

  for (let i = 3; i > 0; i -= 1) {
    g.fillStyle(glow, 0.1 * i);
    g.fillCircle(cx, cy, s * 0.34 + i * 4);
  }

  // 五角星
  const r1 = s * 0.32;
  const r2 = s * 0.14;
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i += 1) {
    const ang = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r1 : r2;
    pts.push(new Phaser.Math.Vector2(cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)));
  }
  g.fillStyle(darken(pal.collectible, 0.35), 1);
  g.fillPoints(pts, true);
  const pts2 = pts.map((p) => new Phaser.Math.Vector2(cx + (p.x - cx) * 0.86, cy + (p.y - cy) * 0.86));
  g.fillStyle(main, 1);
  g.fillPoints(pts2, true);

  // 中央反光
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx - s * 0.04, cy - s * 0.04, s * 0.04);
}

function drawBossOrb(g: Phaser.GameObjects.Graphics, pal: PlayPalette, s: number) {
  const cx = s / 2;
  const cy = s / 2;
  const main = uint(pal.hazard);
  const hi = lighten(pal.hazard, 0.42);
  g.fillStyle(main, 0.55);
  g.fillCircle(cx, cy, s * 0.5);
  g.fillStyle(main, 1);
  g.fillCircle(cx, cy, s * 0.36);
  g.fillStyle(hi, 0.85);
  g.fillCircle(cx - 2, cy - 2, s * 0.16);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx - 3, cy - 3, s * 0.06);
}

// ─── Builder ─────────────────────────────────────────────────────

/**
 * 风格归并：把 12 套 assetStyle 收敛到 5 套绘制函数。
 */
function chooseStyle(style: AssetStyle): "arcade" | "kawaii" | "nature" | "darkFantasy" | "blocky" {
  switch (style) {
    case "kawaii-mecha":
    case "cute-cartoon":
      return "kawaii";
    case "nature-organic":
    case "paper-craft":
      return "nature";
    case "dark-fantasy":
    case "bullet-hell":
    case "neon-cyber":
      return "darkFantasy";
    case "blocky-pixel":
      return "blocky";
    default:
      return "arcade";
  }
}

export function buildPlayAssetSet(
  scene: Phaser.Scene,
  palette: PlayPalette,
  style: AssetStyle,
  keyPrefix = "playAsset",
): PlayAssetSet {
  const set: PlayAssetSet = {
    player: `${keyPrefix}_player`,
    hazardBasic: `${keyPrefix}_haz`,
    hazardFast: `${keyPrefix}_hazFast`,
    hazardHeavy: `${keyPrefix}_hazHeavy`,
    boss: `${keyPrefix}_boss`,
    gem: `${keyPrefix}_gem`,
    power: `${keyPrefix}_pwr`,
    bossOrb: `${keyPrefix}_orb`,
  };

  const fam = chooseStyle(style);
  const mk = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const g = mg(scene);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  // 玩家
  mk(set.player, SIZE_PLAYER, SIZE_PLAYER, (g) => {
    switch (fam) {
      case "kawaii":
        return drawPlayerKawaii(g, palette, SIZE_PLAYER);
      case "nature":
        return drawPlayerNature(g, palette, SIZE_PLAYER);
      case "darkFantasy":
        return drawPlayerDarkFantasy(g, palette, SIZE_PLAYER);
      case "blocky":
        return drawPlayerBlocky(g, palette, SIZE_PLAYER);
      default:
        return drawPlayerArcade(g, palette, SIZE_PLAYER);
    }
  });

  // 危险物（normal / fast / heavy）
  const useOrbHaz = fam === "darkFantasy" || fam === "kawaii";
  const useBlockyHaz = fam === "blocky";
  mk(set.hazardBasic, SIZE_HAZARD, SIZE_HAZARD, (g) => {
    if (useOrbHaz) return drawHazardOrb(g, palette, SIZE_HAZARD);
    if (useBlockyHaz) return drawBlockyHazard(g, palette, SIZE_HAZARD);
    return drawHazardSpike(g, palette, SIZE_HAZARD, "basic");
  });
  mk(set.hazardFast, SIZE_HAZARD, SIZE_HAZARD, (g) => {
    if (useOrbHaz) return drawHazardOrb(g, palette, SIZE_HAZARD);
    if (useBlockyHaz) return drawBlockyHazard(g, palette, SIZE_HAZARD);
    return drawHazardSpike(g, palette, SIZE_HAZARD, "fast");
  });
  mk(set.hazardHeavy, SIZE_HAZARD, SIZE_HAZARD, (g) => {
    if (useOrbHaz) return drawHazardOrb(g, palette, SIZE_HAZARD);
    if (useBlockyHaz) return drawBlockyHazard(g, palette, SIZE_HAZARD);
    return drawHazardSpike(g, palette, SIZE_HAZARD, "heavy");
  });

  mk(set.boss, SIZE_BOSS, SIZE_BOSS, (g) => drawBoss(g, palette, SIZE_BOSS, style));
  mk(set.gem, SIZE_GEM, SIZE_GEM, (g) => drawGem(g, palette, SIZE_GEM));
  mk(set.power, SIZE_POWER, SIZE_POWER, (g) => drawPower(g, palette, SIZE_POWER));
  mk(set.bossOrb, SIZE_ORB, SIZE_ORB, (g) => drawBossOrb(g, palette, SIZE_ORB));

  return set;
}
