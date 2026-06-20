import Phaser from "phaser";
import type { AssetStyle } from "@/lib/cohesive-presentation";

/**
 * 高保真程序化 TowerDefense 资产渲染器。
 *
 * 给 TowerDefenseScene 用。覆盖：
 *   - 敌人：grunt / tank / runner / boss（4 套 assetStyle 风格）
 *   - 炮塔：archer / cannon / mage / slow（每塔多级升级图标）
 *   - 基地图标 + 金币图标
 *
 * 比原 TD scene 内的 38-46px 贴图大幅升级到 96-160px，描边 + 高光 + 阴影齐全。
 */

export type TdPalette = {
  player: string;
  hazard: string;
  collectible: string;
  particle: string;
  background: string;
};

export type TdAssetSet = {
  enemyGrunt: string;
  enemyTank: string;
  enemyRunner: string;
  enemyBoss: string;
  towerDefault: string;
  towerSpread: string;
  towerLaser: string;
  towerSlow: string;
  base: string;
  coin: string;
};

const ENEMY_SIZE = 96;
const BOSS_SIZE = 160;
const TOWER_SIZE = 96;
const BASE_SIZE = 128;
const COIN_SIZE = 48;

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

type Family = "cute" | "dark" | "blocky" | "arcade";

function chooseFamily(style: AssetStyle): Family {
  switch (style) {
    case "kawaii-mecha":
    case "cute-cartoon":
    case "nature-organic":
    case "paper-craft":
      return "cute";
    case "dark-fantasy":
    case "bullet-hell":
    case "neon-cyber":
      return "dark";
    case "blocky-pixel":
      return "blocky";
    default:
      return "arcade";
  }
}

// ─── 敌人 ─────────────────────────────────────────────────────────

function drawEnemyGrunt(g: Phaser.GameObjects.Graphics, pal: TdPalette, s: number, fam: Family) {
  const cx = s / 2;
  const cy = s / 2;
  const main = uint(pal.hazard);
  const dk = darken(pal.hazard, 0.45);
  const hi = lighten(pal.hazard, 0.32);

  // 阴影
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(cx + 3, s * 0.92, s * 0.55, s * 0.1);

  if (fam === "blocky") {
    // 像素正方形小怪
    g.fillStyle(dk, 1);
    g.fillRect(s * 0.22, s * 0.18, s * 0.56, s * 0.64);
    g.fillStyle(main, 1);
    g.fillRect(s * 0.26, s * 0.22, s * 0.48, s * 0.56);
    // 像素眼
    g.fillStyle(0xffffff, 1);
    g.fillRect(s * 0.32, s * 0.36, s * 0.1, s * 0.08);
    g.fillRect(s * 0.58, s * 0.36, s * 0.1, s * 0.08);
    g.fillStyle(0x000000, 1);
    g.fillRect(s * 0.36, s * 0.38, s * 0.05, s * 0.05);
    g.fillRect(s * 0.62, s * 0.38, s * 0.05, s * 0.05);
    // 牙
    g.fillStyle(0xffffff, 1);
    g.fillRect(s * 0.36, s * 0.62, s * 0.06, s * 0.06);
    g.fillRect(s * 0.58, s * 0.62, s * 0.06, s * 0.06);
    return;
  }

  // 耳朵 / 角
  if (fam === "cute") {
    g.fillStyle(dk, 1);
    g.fillCircle(cx - s * 0.2, s * 0.22, s * 0.1);
    g.fillCircle(cx + s * 0.2, s * 0.22, s * 0.1);
    g.fillStyle(main, 1);
    g.fillCircle(cx - s * 0.2, s * 0.22, s * 0.07);
    g.fillCircle(cx + s * 0.2, s * 0.22, s * 0.07);
  } else if (fam === "dark") {
    g.fillStyle(dk, 1);
    g.fillTriangle(cx - s * 0.16, s * 0.22, cx - s * 0.24, s * 0.04, cx - s * 0.06, s * 0.16);
    g.fillTriangle(cx + s * 0.16, s * 0.22, cx + s * 0.24, s * 0.04, cx + s * 0.06, s * 0.16);
  }

  // 身体
  g.lineStyle(3, dk, 1);
  g.strokeCircle(cx, s * 0.55, s * 0.32);
  g.fillStyle(main, 1);
  g.fillCircle(cx, s * 0.55, s * 0.32);

  // 高光
  g.fillStyle(hi, 0.4);
  g.fillEllipse(cx - s * 0.08, s * 0.42, s * 0.18, s * 0.1);

  // 眼睛
  const eyeY = s * 0.52;
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - s * 0.1, eyeY, s * 0.07);
  g.fillCircle(cx + s * 0.1, eyeY, s * 0.07);
  g.fillStyle(0x0f172a, 1);
  g.fillCircle(cx - s * 0.085, eyeY, s * 0.04);
  g.fillCircle(cx + s * 0.115, eyeY, s * 0.04);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx - s * 0.08, eyeY - 0.01, s * 0.015);
  g.fillCircle(cx + s * 0.12, eyeY - 0.01, s * 0.015);

  if (fam === "cute") {
    // 腮红
    g.fillStyle(0xffb4c5, 0.6);
    g.fillCircle(cx - s * 0.18, s * 0.62, s * 0.04);
    g.fillCircle(cx + s * 0.18, s * 0.62, s * 0.04);
  } else if (fam === "dark") {
    // 邪笑
    g.lineStyle(3, 0x0f172a, 1);
    g.strokeLineShape(new Phaser.Geom.Line(cx - s * 0.1, s * 0.7, cx + s * 0.1, s * 0.7));
  }

  // 脚
  g.fillStyle(dk, 1);
  g.fillRoundedRect(cx - s * 0.2, s * 0.82, s * 0.14, s * 0.08, 3);
  g.fillRoundedRect(cx + s * 0.06, s * 0.82, s * 0.14, s * 0.08, 3);
}

function drawEnemyTank(g: Phaser.GameObjects.Graphics, pal: TdPalette, s: number) {
  const cx = s / 2;
  const plate = uint("#475569");
  const plateD = uint("#1e293b");
  const plateL = uint("#94a3b8");
  const accent = uint(pal.collectible);
  const eyeRed = 0xff3344;

  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(cx + 3, s * 0.94, s * 0.62, s * 0.1);

  // 肩甲
  g.fillStyle(plateD, 1);
  g.fillRoundedRect(s * 0.04, s * 0.26, s * 0.16, s * 0.4, 6);
  g.fillRoundedRect(s * 0.8, s * 0.26, s * 0.16, s * 0.4, 6);
  g.fillStyle(plateL, 0.42);
  g.fillRoundedRect(s * 0.06, s * 0.28, s * 0.1, s * 0.18, 4);
  g.fillRoundedRect(s * 0.82, s * 0.28, s * 0.1, s * 0.18, 4);

  // 身体
  g.lineStyle(4, plateD, 1);
  g.strokeRoundedRect(s * 0.2, s * 0.18, s * 0.6, s * 0.5, 12);
  g.fillStyle(plate, 1);
  g.fillRoundedRect(s * 0.22, s * 0.2, s * 0.56, s * 0.46, 11);
  g.fillStyle(plateL, 0.38);
  g.fillRoundedRect(s * 0.28, s * 0.24, s * 0.44, s * 0.14, 6);

  // 头盔 visor
  g.fillStyle(plateD, 1);
  g.fillRoundedRect(s * 0.28, s * 0.14, s * 0.44, s * 0.2, 6);
  g.fillStyle(eyeRed, 0.3);
  g.fillRoundedRect(s * 0.3, s * 0.22, s * 0.4, s * 0.08, 3);
  g.fillStyle(eyeRed, 0.95);
  g.fillRoundedRect(s * 0.32, s * 0.24, s * 0.1, s * 0.04, 2);
  g.fillRoundedRect(s * 0.58, s * 0.24, s * 0.1, s * 0.04, 2);

  // 中央铆钉
  g.fillStyle(accent, 1);
  g.fillCircle(cx, s * 0.5, s * 0.06);
  g.fillStyle(plateD, 0.85);
  g.fillCircle(cx, s * 0.5, s * 0.03);

  // 履带 / 脚
  g.fillStyle(plateD, 1);
  g.fillRoundedRect(s * 0.18, s * 0.78, s * 0.64, s * 0.1, 5);
  for (let i = 0; i < 5; i += 1) {
    g.fillStyle(plate, 0.7);
    g.fillRect(s * 0.2 + i * s * 0.13, s * 0.8, s * 0.1, s * 0.06);
  }
}

function drawEnemyRunner(g: Phaser.GameObjects.Graphics, pal: TdPalette, s: number) {
  const cx = s / 2;
  const main = uint(pal.collectible);
  const dk = darken(pal.collectible, 0.42);
  const hi = lighten(pal.collectible, 0.32);

  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx + 3, s * 0.92, s * 0.5, s * 0.08);

  // 速度线
  g.lineStyle(2, dk, 0.55);
  for (let i = 0; i < 4; i += 1) {
    g.lineBetween(s * 0.02, s * (0.36 + i * 0.06), s * 0.18, s * (0.4 + i * 0.06));
  }

  // 尾巴
  g.fillStyle(dk, 0.85);
  g.fillTriangle(cx - s * 0.32, s * 0.5, cx - s * 0.05, s * 0.42, cx - s * 0.06, s * 0.58);

  // 身体（流线菱形）
  g.lineStyle(2.5, dk, 1);
  g.strokeRoundedRect(s * 0.16, s * 0.34, s * 0.6, s * 0.32, 16);
  g.fillStyle(main, 1);
  g.fillRoundedRect(s * 0.16, s * 0.34, s * 0.6, s * 0.32, 16);
  g.fillStyle(hi, 0.4);
  g.fillRoundedRect(s * 0.22, s * 0.36, s * 0.32, s * 0.1, 6);

  // 头部尖锥
  g.fillStyle(main, 1);
  g.fillTriangle(cx + s * 0.28, s * 0.4, cx + s * 0.5, s * 0.5, cx + s * 0.28, s * 0.6);

  // 眼
  g.fillStyle(0xfff7c4, 1);
  g.fillCircle(cx + s * 0.08, s * 0.46, s * 0.05);
  g.fillStyle(0x1a0000, 1);
  g.fillCircle(cx + s * 0.09, s * 0.46, s * 0.025);

  // 双脚
  g.fillStyle(dk, 1);
  g.fillRoundedRect(cx - s * 0.06, s * 0.8, s * 0.1, s * 0.08, 3);
  g.fillRoundedRect(cx + s * 0.08, s * 0.8, s * 0.1, s * 0.08, 3);
}

function drawTdBoss(g: Phaser.GameObjects.Graphics, pal: TdPalette, s: number, style: AssetStyle) {
  const cx = s / 2;
  const cy = s / 2;
  const main = uint(pal.hazard);
  const dk = darken(pal.hazard, 0.5);
  const accent = uint(pal.collectible);
  const glow = uint(pal.particle);

  // 光晕
  for (let i = 5; i > 0; i -= 1) {
    g.fillStyle(glow, 0.05 * i);
    g.fillCircle(cx, cy, s * 0.42 + i * 6);
  }

  if (style === "dark-fantasy" || style === "bullet-hell" || style === "neon-cyber") {
    // 王冠 + 多边形
    const sides = 10;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < sides * 2; i += 1) {
      const a = (i / (sides * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? s * 0.4 : s * 0.32;
      pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
    }
    g.fillStyle(dk, 1);
    g.fillPoints(pts, true);
    g.fillStyle(main, 1);
    g.fillPoints(
      pts.map((p) => new Phaser.Math.Vector2(cx + (p.x - cx) * 0.86, cy + (p.y - cy) * 0.86)),
      true,
    );
    // 中央眼
    g.fillStyle(0xfff7c4, 1);
    g.fillEllipse(cx, cy, s * 0.24, s * 0.16);
    g.fillStyle(0xff2a44, 1);
    g.fillCircle(cx, cy, s * 0.07);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(cx + 0.01, cy - 0.01, s * 0.025);
    // 王冠
    g.fillStyle(accent, 1);
    g.fillTriangle(cx - s * 0.24, cy - s * 0.32, cx - s * 0.16, cy - s * 0.42, cx - s * 0.08, cy - s * 0.32);
    g.fillTriangle(cx - s * 0.06, cy - s * 0.32, cx, cy - s * 0.44, cx + s * 0.06, cy - s * 0.32);
    g.fillTriangle(cx + s * 0.08, cy - s * 0.32, cx + s * 0.16, cy - s * 0.42, cx + s * 0.24, cy - s * 0.32);
    return;
  }

  // 默认：大圆胖 boss + 王冠
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx, s * 0.96, s * 0.7, s * 0.1);
  g.fillStyle(dk, 1);
  g.fillCircle(cx, cy + s * 0.04, s * 0.42);
  g.fillStyle(main, 1);
  g.fillCircle(cx, cy, s * 0.38);
  // 高光
  g.fillStyle(lighten(pal.hazard, 0.45), 0.5);
  g.fillEllipse(cx - s * 0.08, cy - s * 0.12, s * 0.22, s * 0.12);
  // 王冠
  g.fillStyle(accent, 1);
  g.fillTriangle(cx - s * 0.24, cy - s * 0.32, cx - s * 0.16, cy - s * 0.46, cx - s * 0.08, cy - s * 0.32);
  g.fillTriangle(cx - s * 0.06, cy - s * 0.32, cx, cy - s * 0.5, cx + s * 0.06, cy - s * 0.32);
  g.fillTriangle(cx + s * 0.08, cy - s * 0.32, cx + s * 0.16, cy - s * 0.46, cx + s * 0.24, cy - s * 0.32);
  // 大眼
  g.fillStyle(0xfff7c4, 1);
  g.fillEllipse(cx - s * 0.13, cy - s * 0.03, s * 0.16, s * 0.12);
  g.fillEllipse(cx + s * 0.13, cy - s * 0.03, s * 0.16, s * 0.12);
  g.fillStyle(0x0f172a, 1);
  g.fillCircle(cx - s * 0.12, cy - s * 0.03, s * 0.05);
  g.fillCircle(cx + s * 0.14, cy - s * 0.03, s * 0.05);
  g.fillStyle(0xff3344, 0.85);
  g.fillCircle(cx - s * 0.12, cy - s * 0.03, s * 0.022);
  g.fillCircle(cx + s * 0.14, cy - s * 0.03, s * 0.022);
  // 牙
  g.fillStyle(0x1a0000, 1);
  g.fillEllipse(cx, cy + s * 0.15, s * 0.22, s * 0.07);
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < 5; i += 1) {
    const tx = cx - s * 0.08 + i * s * 0.04;
    g.fillTriangle(tx, cy + s * 0.12, tx + s * 0.02, cy + s * 0.18, tx + s * 0.04, cy + s * 0.12);
  }
}

// ─── 炮塔 ───────────────────────────────────────────────────────

type TowerKind = "default" | "spread" | "laser" | "slow";

function drawTowerBase(g: Phaser.GameObjects.Graphics, pal: TdPalette, s: number) {
  const cx = s / 2;
  const stone = uint("#64748b");
  const stoneD = uint("#334155");
  // 阴影
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx, s * 0.92, s * 0.6, s * 0.1);
  // 基座
  g.fillStyle(stoneD, 1);
  g.fillRoundedRect(s * 0.14, s * 0.6, s * 0.72, s * 0.32, 8);
  g.fillStyle(stone, 1);
  g.fillRoundedRect(s * 0.16, s * 0.62, s * 0.68, s * 0.28, 8);
  // 砖纹
  g.lineStyle(1.5, stoneD, 0.6);
  for (let y = s * 0.7; y < s * 0.88; y += s * 0.08) g.lineBetween(s * 0.16, y, s * 0.84, y);
  for (let x = s * 0.3; x < s * 0.78; x += s * 0.16) g.lineBetween(x, s * 0.62, x, s * 0.9);
}

function drawTower(g: Phaser.GameObjects.Graphics, pal: TdPalette, s: number, kind: TowerKind) {
  drawTowerBase(g, pal, s);
  const cx = s / 2;
  const main = uint(pal.player);
  const dk = darken(pal.player, 0.42);
  const hi = lighten(pal.player, 0.32);
  const accent = uint(pal.collectible);
  const glow = uint(pal.particle);

  if (kind === "default") {
    // 弓箭手平台 + 弓
    g.fillStyle(dk, 1);
    g.fillRoundedRect(s * 0.24, s * 0.32, s * 0.52, s * 0.3, 6);
    g.fillStyle(main, 1);
    g.fillRoundedRect(s * 0.26, s * 0.34, s * 0.48, s * 0.26, 5);
    g.fillStyle(hi, 0.45);
    g.fillRoundedRect(s * 0.28, s * 0.36, s * 0.3, s * 0.08, 3);
    // 弓
    g.lineStyle(4, accent, 1);
    g.beginPath();
    g.arc(cx, s * 0.46, s * 0.16, Phaser.Math.DegToRad(-30), Phaser.Math.DegToRad(30), false);
    g.strokePath();
    // 箭
    g.lineStyle(3, 0xfff7c4, 1);
    g.lineBetween(cx - s * 0.04, s * 0.46, cx + s * 0.22, s * 0.46);
    g.fillStyle(0xfff7c4, 1);
    g.fillTriangle(cx + s * 0.22, s * 0.42, cx + s * 0.3, s * 0.46, cx + s * 0.22, s * 0.5);
    return;
  }

  if (kind === "spread") {
    // 散弹炮：3 个枪管扇形
    g.fillStyle(dk, 1);
    g.fillCircle(cx, s * 0.5, s * 0.16);
    g.fillStyle(main, 1);
    g.fillCircle(cx, s * 0.5, s * 0.13);
    g.fillStyle(hi, 0.45);
    g.fillCircle(cx - s * 0.04, s * 0.46, s * 0.04);
    // 三炮管
    for (let i = -1; i <= 1; i += 1) {
      const a = i * 0.5 - Math.PI / 2;
      const ex = cx + Math.cos(a) * s * 0.22;
      const ey = s * 0.5 + Math.sin(a) * s * 0.22;
      g.lineStyle(6, dk, 1);
      g.lineBetween(cx, s * 0.5, ex, ey);
      g.lineStyle(4, main, 1);
      g.lineBetween(cx, s * 0.5, ex, ey);
      g.fillStyle(accent, 1);
      g.fillCircle(ex, ey, 3);
    }
    return;
  }

  if (kind === "laser") {
    // 法师塔：水晶
    g.fillStyle(dk, 1);
    g.fillRoundedRect(s * 0.32, s * 0.4, s * 0.36, s * 0.2, 8);
    g.fillStyle(main, 1);
    g.fillRoundedRect(s * 0.34, s * 0.42, s * 0.32, s * 0.16, 6);
    // 水晶
    const w = s * 0.16;
    const h = s * 0.22;
    g.fillStyle(darken(pal.collectible, 0.3), 1);
    g.fillTriangle(cx, s * 0.18, cx + w, s * 0.32, cx, s * 0.46);
    g.fillTriangle(cx, s * 0.18, cx - w, s * 0.32, cx, s * 0.46);
    g.fillStyle(uint("#7dd3fc"), 1);
    g.fillTriangle(cx, s * 0.22, cx + w * 0.85, s * 0.32, cx, s * 0.42);
    g.fillTriangle(cx, s * 0.22, cx - w * 0.85, s * 0.32, cx, s * 0.42);
    g.fillStyle(0xffffff, 0.7);
    g.fillTriangle(cx - 2, s * 0.24, cx + 4, s * 0.32, cx - 2, s * 0.36);
    // 光晕
    for (let i = 3; i > 0; i -= 1) {
      g.fillStyle(uint("#7dd3fc"), 0.08 * i);
      g.fillCircle(cx, s * 0.32, s * 0.16 + i * 3);
    }
    return;
  }

  if (kind === "slow") {
    // 冰塔：六角晶体
    g.fillStyle(dk, 1);
    g.fillRoundedRect(s * 0.3, s * 0.42, s * 0.4, s * 0.2, 8);
    g.fillStyle(main, 1);
    g.fillRoundedRect(s * 0.32, s * 0.44, s * 0.36, s * 0.16, 6);
    // 雪花核心
    const r = s * 0.16;
    g.lineStyle(3, uint("#bae6fd"), 1);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      g.lineBetween(cx, s * 0.3, cx + Math.cos(a) * r, s * 0.3 + Math.sin(a) * r);
    }
    g.fillStyle(uint("#e0f2fe"), 1);
    g.fillCircle(cx, s * 0.3, s * 0.06);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(cx - 1, s * 0.29, s * 0.025);
    // 光晕
    for (let i = 3; i > 0; i -= 1) {
      g.fillStyle(uint("#bae6fd"), 0.08 * i);
      g.fillCircle(cx, s * 0.3, r + i * 4);
    }
  }
}

// ─── 基地 ─────────────────────────────────────────────────────────

function drawBase(g: Phaser.GameObjects.Graphics, pal: TdPalette, s: number) {
  const cx = s / 2;
  const cy = s / 2;
  const stone = uint("#a8a29e");
  const stoneD = uint("#57534e");
  const accent = uint(pal.collectible);
  const flag = uint(pal.player);

  // 阴影
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx, s * 0.92, s * 0.65, s * 0.08);

  // 城堡墙
  g.fillStyle(stoneD, 1);
  g.fillRect(s * 0.15, s * 0.42, s * 0.7, s * 0.5);
  g.fillStyle(stone, 1);
  g.fillRect(s * 0.18, s * 0.45, s * 0.64, s * 0.45);

  // 砖缝
  g.lineStyle(1.5, stoneD, 0.6);
  for (let y = s * 0.55; y < s * 0.88; y += s * 0.1) g.lineBetween(s * 0.18, y, s * 0.82, y);
  for (let x = s * 0.28; x < s * 0.78; x += s * 0.16) g.lineBetween(x, s * 0.45, x, s * 0.9);

  // 城垛
  g.fillStyle(stoneD, 1);
  for (let i = 0; i < 5; i += 1) {
    g.fillRect(s * 0.16 + i * s * 0.14, s * 0.36, s * 0.08, s * 0.08);
  }

  // 大门
  g.fillStyle(uint("#451a03"), 1);
  g.fillRoundedRect(s * 0.36, s * 0.62, s * 0.28, s * 0.28, 6);
  g.fillStyle(0xffffff, 0.18);
  g.fillRect(s * 0.42, s * 0.66, s * 0.06, s * 0.18);
  g.fillStyle(accent, 1);
  g.fillCircle(s * 0.5, s * 0.78, s * 0.02);

  // 旗杆 + 旗
  g.fillStyle(stoneD, 1);
  g.fillRect(cx - 2, s * 0.16, 3, s * 0.24);
  g.fillStyle(flag, 1);
  g.fillTriangle(cx + 1, s * 0.18, cx + s * 0.16, s * 0.24, cx + 1, s * 0.3);
  g.fillStyle(lighten(pal.player, 0.4), 0.6);
  g.fillTriangle(cx + 1, s * 0.2, cx + s * 0.08, s * 0.24, cx + 1, s * 0.28);

  // 心形（守护意义）
  g.fillStyle(0xff5e7a, 1);
  const hx = s * 0.7;
  const hy = s * 0.52;
  g.fillCircle(hx - 4, hy, 5);
  g.fillCircle(hx + 4, hy, 5);
  g.fillTriangle(hx - 8, hy + 2, hx + 8, hy + 2, hx, hy + 12);
}

// ─── 金币 ─────────────────────────────────────────────────────────

function drawCoin(g: Phaser.GameObjects.Graphics, pal: TdPalette, s: number) {
  const cx = s / 2;
  const cy = s / 2;
  const gold = uint("#fbbf24");
  const goldD = uint("#a16207");
  const goldL = uint("#fde68a");
  // 光晕
  for (let i = 3; i > 0; i -= 1) {
    g.fillStyle(gold, 0.1 * i);
    g.fillCircle(cx, cy, s * 0.38 + i * 2);
  }
  // 主体
  g.fillStyle(goldD, 1);
  g.fillCircle(cx, cy, s * 0.4);
  g.fillStyle(gold, 1);
  g.fillCircle(cx, cy, s * 0.36);
  g.fillStyle(goldL, 0.55);
  g.fillCircle(cx - 2, cy - 2, s * 0.16);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(cx - 4, cy - 4, s * 0.06);

  // ¥ / $ 字符
  g.lineStyle(3, goldD, 1);
  g.lineBetween(cx - s * 0.1, cy - s * 0.12, cx + s * 0.1, cy - s * 0.12);
  g.lineBetween(cx - s * 0.1, cy, cx + s * 0.1, cy);
  g.lineBetween(cx, cy - s * 0.18, cx, cy + s * 0.16);
}

// ─── Builder ─────────────────────────────────────────────────────

export function buildTdAssetSet(
  scene: Phaser.Scene,
  pal: TdPalette,
  style: AssetStyle,
  keyPrefix = "tdAsset",
): TdAssetSet {
  const set: TdAssetSet = {
    enemyGrunt: `${keyPrefix}_grunt`,
    enemyTank: `${keyPrefix}_tank`,
    enemyRunner: `${keyPrefix}_runner`,
    enemyBoss: `${keyPrefix}_boss`,
    towerDefault: `${keyPrefix}_t0`,
    towerSpread: `${keyPrefix}_t1`,
    towerLaser: `${keyPrefix}_t2`,
    towerSlow: `${keyPrefix}_t3`,
    base: `${keyPrefix}_base`,
    coin: `${keyPrefix}_coin`,
  };

  const fam = chooseFamily(style);
  const mk = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const g = mg(scene);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  mk(set.enemyGrunt, ENEMY_SIZE, ENEMY_SIZE, (g) => drawEnemyGrunt(g, pal, ENEMY_SIZE, fam));
  mk(set.enemyTank, ENEMY_SIZE, ENEMY_SIZE, (g) => drawEnemyTank(g, pal, ENEMY_SIZE));
  mk(set.enemyRunner, ENEMY_SIZE, ENEMY_SIZE, (g) => drawEnemyRunner(g, pal, ENEMY_SIZE));
  mk(set.enemyBoss, BOSS_SIZE, BOSS_SIZE, (g) => drawTdBoss(g, pal, BOSS_SIZE, style));
  mk(set.towerDefault, TOWER_SIZE, TOWER_SIZE, (g) => drawTower(g, pal, TOWER_SIZE, "default"));
  mk(set.towerSpread, TOWER_SIZE, TOWER_SIZE, (g) => drawTower(g, pal, TOWER_SIZE, "spread"));
  mk(set.towerLaser, TOWER_SIZE, TOWER_SIZE, (g) => drawTower(g, pal, TOWER_SIZE, "laser"));
  mk(set.towerSlow, TOWER_SIZE, TOWER_SIZE, (g) => drawTower(g, pal, TOWER_SIZE, "slow"));
  mk(set.base, BASE_SIZE, BASE_SIZE, (g) => drawBase(g, pal, BASE_SIZE));
  mk(set.coin, COIN_SIZE, COIN_SIZE, (g) => drawCoin(g, pal, COIN_SIZE));

  return set;
}
