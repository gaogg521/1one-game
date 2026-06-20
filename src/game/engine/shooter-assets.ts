import Phaser from "phaser";
import type { AssetStyle } from "@/lib/cohesive-presentation";

/**
 * 高保真程序化 Shooter 资产渲染器。
 *
 * 多套皮肤（assetStyle 驱动），每套都用 Phaser Graphics 多层绘制：
 * 描边 + 主体 + 高光 + 光晕 + 引擎焰，分辨率 96-128 px，远好于 48px 几何体。
 *
 * 设计：
 * - 每个 makeXxx 接受 textureKey + 主题色，写入 scene.textures
 * - 全部内联生成，不依赖远程贴图、不依赖 API key
 * - 资产编号在内：玩家 / 敌机 / 精英 / Boss / 玩家子弹 / 敌人子弹 / 道具
 * - shooter 是首发模板，后续扩展到 collector / survivor / avoider 仅需新增 builder
 */

export type ShooterPalette = {
  player: string;
  hazard: string;
  collectible: string;
  particle: string;
  background: string;
};

export type ShooterAssetSet = {
  player: string;
  enemyBasic: string;
  enemyElite: string;
  boss: string;
  playerBullet: string;
  enemyBullet: string;
  powerShield: string;
  powerSpread: string;
  powerLaser: string;
  powerBomb: string;
};

const PLAYER_SIZE = 96;
const ENEMY_SIZE = 96;
const BOSS_SIZE = 192;
const BULLET_W = 16;
const BULLET_H = 32;
const POWER_SIZE = 80;

function hexToColor(hex: string): Phaser.Display.Color {
  return Phaser.Display.Color.HexStringToColor(hex);
}

function hexToUint(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

function lighten(hex: string, t: number): number {
  return hexToColor(hex).lighten(Math.floor(t * 100)).color;
}

function darken(hex: string, t: number): number {
  return hexToColor(hex).darken(Math.floor(t * 100)).color;
}

function mix(a: string, b: string, t: number): number {
  const A = hexToColor(a);
  const B = hexToColor(b);
  const r = Math.round(A.red + (B.red - A.red) * t);
  const g = Math.round(A.green + (B.green - A.green) * t);
  const bl = Math.round(A.blue + (B.blue - A.blue) * t);
  return Phaser.Display.Color.GetColor(r, g, bl);
}

function makeGraphics(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.make.graphics({ x: 0, y: 0 });
}

// ─── 玩家飞船：5 套风格 ─────────────────────────────────────────────────

function drawPlayerClassicArcade(
  g: Phaser.GameObjects.Graphics,
  pal: ShooterPalette,
  s: number,
): void {
  const cx = s / 2;
  const cy = s / 2;
  const main = hexToUint(pal.player);
  const hi = lighten(pal.player, 0.32);
  const dk = darken(pal.player, 0.32);
  const accent = hexToUint(pal.collectible);

  // 引擎焰
  const flameMain = mix(pal.collectible, "#ffffff", 0.5);
  const flameTip = mix(pal.player, "#ffffff", 0.55);
  g.fillStyle(flameMain, 0.85);
  g.fillTriangle(cx - 12, s * 0.78, cx + 12, s * 0.78, cx, s * 0.97);
  g.fillStyle(flameTip, 0.95);
  g.fillTriangle(cx - 6, s * 0.78, cx + 6, s * 0.78, cx, s * 0.92);

  // 主翼（梯形）
  g.fillStyle(dk, 1);
  g.fillTriangle(cx - s * 0.36, cy + s * 0.16, cx - s * 0.1, cy + s * 0.02, cx - s * 0.1, cy + s * 0.32);
  g.fillTriangle(cx + s * 0.36, cy + s * 0.16, cx + s * 0.1, cy + s * 0.02, cx + s * 0.1, cy + s * 0.32);
  g.fillStyle(main, 1);
  g.fillTriangle(cx - s * 0.3, cy + s * 0.1, cx - s * 0.1, cy - s * 0.05, cx - s * 0.1, cy + s * 0.26);
  g.fillTriangle(cx + s * 0.3, cy + s * 0.1, cx + s * 0.1, cy - s * 0.05, cx + s * 0.1, cy + s * 0.26);

  // 机身
  g.fillStyle(main, 1);
  g.fillRoundedRect(cx - s * 0.12, cy - s * 0.34, s * 0.24, s * 0.6, 8);
  // 机身高光
  g.fillStyle(hi, 1);
  g.fillRoundedRect(cx - s * 0.04, cy - s * 0.3, s * 0.04, s * 0.5, 2);

  // 机头
  g.fillStyle(hi, 1);
  g.fillTriangle(cx, cy - s * 0.46, cx - s * 0.12, cy - s * 0.26, cx + s * 0.12, cy - s * 0.26);

  // 驾驶舱
  g.fillStyle(accent, 0.9);
  g.fillCircle(cx, cy - s * 0.16, s * 0.08);
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(cx - s * 0.025, cy - s * 0.19, s * 0.025);

  // 翼尖灯
  g.fillStyle(accent, 1);
  g.fillCircle(cx - s * 0.34, cy + s * 0.18, 3);
  g.fillCircle(cx + s * 0.34, cy + s * 0.18, 3);
}

function drawPlayerHardSciFi(
  g: Phaser.GameObjects.Graphics,
  pal: ShooterPalette,
  s: number,
): void {
  const cx = s / 2;
  const cy = s / 2;
  const main = hexToUint(pal.player);
  const hi = lighten(pal.player, 0.45);
  const dk = darken(pal.player, 0.45);
  const glow = mix(pal.collectible, "#7dd3fc", 0.4);

  // 引擎双焰
  g.fillStyle(glow, 0.6);
  g.fillEllipse(cx - 10, s * 0.88, 14, 22);
  g.fillEllipse(cx + 10, s * 0.88, 14, 22);
  g.fillStyle(0xffffff, 0.9);
  g.fillEllipse(cx - 10, s * 0.85, 5, 14);
  g.fillEllipse(cx + 10, s * 0.85, 5, 14);

  // 锋利主翼
  g.fillStyle(dk, 1);
  g.fillTriangle(cx - s * 0.46, cy + s * 0.32, cx - s * 0.08, cy + s * 0.04, cx - s * 0.06, cy + s * 0.4);
  g.fillTriangle(cx + s * 0.46, cy + s * 0.32, cx + s * 0.08, cy + s * 0.04, cx + s * 0.06, cy + s * 0.4);
  g.fillStyle(main, 1);
  g.fillTriangle(cx - s * 0.42, cy + s * 0.28, cx - s * 0.12, cy + s * 0.02, cx - s * 0.1, cy + s * 0.36);
  g.fillTriangle(cx + s * 0.42, cy + s * 0.28, cx + s * 0.12, cy + s * 0.02, cx + s * 0.1, cy + s * 0.36);

  // 机身（菱形）
  g.fillStyle(hi, 1);
  g.fillTriangle(cx, cy - s * 0.46, cx - s * 0.18, cy + s * 0.1, cx + s * 0.18, cy + s * 0.1);
  g.fillStyle(main, 1);
  g.fillTriangle(cx - s * 0.18, cy + s * 0.1, cx + s * 0.18, cy + s * 0.1, cx, cy + s * 0.4);

  // 装甲分线
  g.lineStyle(2, dk, 1);
  g.lineBetween(cx, cy - s * 0.4, cx, cy + s * 0.3);
  g.lineBetween(cx - s * 0.12, cy - s * 0.02, cx + s * 0.12, cy - s * 0.02);

  // 驾驶舱（窄长）
  g.fillStyle(glow, 0.95);
  g.fillRoundedRect(cx - s * 0.05, cy - s * 0.28, s * 0.1, s * 0.18, 4);
  g.fillStyle(0xffffff, 0.7);
  g.fillRect(cx - s * 0.03, cy - s * 0.26, s * 0.02, s * 0.06);

  // 翼尖能量灯
  g.fillStyle(glow, 1);
  g.fillCircle(cx - s * 0.44, cy + s * 0.32, 3);
  g.fillCircle(cx + s * 0.44, cy + s * 0.32, 3);
}

function drawPlayerKawaiiMecha(
  g: Phaser.GameObjects.Graphics,
  pal: ShooterPalette,
  s: number,
): void {
  const cx = s / 2;
  const cy = s / 2;
  const main = hexToUint(pal.player);
  const hi = lighten(pal.player, 0.45);
  const dk = darken(pal.player, 0.3);
  const eye = hexToUint(pal.collectible);

  // 引擎心形焰
  const flame = mix(pal.collectible, "#fde68a", 0.6);
  g.fillStyle(flame, 0.85);
  g.fillEllipse(cx, s * 0.84, 22, 16);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx, s * 0.82, 5);

  // 圆润主翼
  g.fillStyle(dk, 1);
  g.fillEllipse(cx - s * 0.3, cy + s * 0.18, s * 0.34, s * 0.22);
  g.fillEllipse(cx + s * 0.3, cy + s * 0.18, s * 0.34, s * 0.22);
  g.fillStyle(main, 1);
  g.fillEllipse(cx - s * 0.3, cy + s * 0.18, s * 0.26, s * 0.16);
  g.fillEllipse(cx + s * 0.3, cy + s * 0.18, s * 0.26, s * 0.16);

  // 圆胖机身
  g.fillStyle(dk, 1);
  g.fillRoundedRect(cx - s * 0.18, cy - s * 0.32, s * 0.36, s * 0.6, 16);
  g.fillStyle(main, 1);
  g.fillRoundedRect(cx - s * 0.14, cy - s * 0.28, s * 0.28, s * 0.52, 14);

  // 大眼睛驾驶舱
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx, cy - s * 0.06, s * 0.13);
  g.fillStyle(eye, 1);
  g.fillCircle(cx, cy - s * 0.04, s * 0.08);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx + s * 0.02, cy - s * 0.06, s * 0.025);

  // 腮红
  g.fillStyle(0xffb4c5, 0.6);
  g.fillCircle(cx - s * 0.11, cy + s * 0.02, s * 0.03);
  g.fillCircle(cx + s * 0.11, cy + s * 0.02, s * 0.03);

  // 顶部天线
  g.lineStyle(2, hi, 1);
  g.lineBetween(cx, cy - s * 0.32, cx, cy - s * 0.42);
  g.fillStyle(eye, 1);
  g.fillCircle(cx, cy - s * 0.44, 3);
}

function drawPlayerBulletHell(
  g: Phaser.GameObjects.Graphics,
  pal: ShooterPalette,
  s: number,
): void {
  const cx = s / 2;
  const cy = s / 2;
  const main = hexToUint(pal.player);
  const hi = lighten(pal.player, 0.55);
  const dk = darken(pal.player, 0.5);
  const glow = hexToUint(pal.collectible);

  // 多重光环
  for (let i = 4; i > 0; i -= 1) {
    g.fillStyle(glow, 0.06 * i);
    g.fillCircle(cx, cy + s * 0.05, s * 0.18 + i * 4);
  }

  // 引擎双焰
  g.fillStyle(glow, 0.9);
  g.fillTriangle(cx - 8, s * 0.78, cx - 4, s * 0.78, cx - 6, s * 0.96);
  g.fillTriangle(cx + 8, s * 0.78, cx + 4, s * 0.78, cx + 6, s * 0.96);
  g.fillStyle(0xffffff, 0.95);
  g.fillTriangle(cx - 7, s * 0.78, cx - 5, s * 0.78, cx - 6, s * 0.9);
  g.fillTriangle(cx + 7, s * 0.78, cx + 5, s * 0.78, cx + 6, s * 0.9);

  // 锋锐机体
  g.fillStyle(dk, 1);
  g.fillTriangle(cx, cy - s * 0.48, cx - s * 0.24, cy + s * 0.34, cx + s * 0.24, cy + s * 0.34);
  g.fillStyle(main, 1);
  g.fillTriangle(cx, cy - s * 0.42, cx - s * 0.18, cy + s * 0.28, cx + s * 0.18, cy + s * 0.28);
  g.fillStyle(hi, 1);
  g.fillTriangle(cx, cy - s * 0.36, cx - s * 0.06, cy - s * 0.04, cx + s * 0.06, cy - s * 0.04);

  // 翼侧能量条
  g.fillStyle(glow, 1);
  g.fillRect(cx - s * 0.22, cy + s * 0.05, 3, s * 0.22);
  g.fillRect(cx + s * 0.19, cy + s * 0.05, 3, s * 0.22);

  // 中心宝石
  g.fillStyle(glow, 1);
  g.fillCircle(cx, cy, s * 0.05);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx, cy - s * 0.015, s * 0.022);
}

function drawPlayerWuxiaFlight(
  g: Phaser.GameObjects.Graphics,
  pal: ShooterPalette,
  s: number,
): void {
  const cx = s / 2;
  const cy = s / 2;
  const main = hexToUint(pal.player);
  const hi = lighten(pal.player, 0.5);
  const dk = darken(pal.player, 0.4);
  const accent = hexToUint(pal.collectible);

  // 飘带 / 灵气尾
  for (let i = 0; i < 3; i += 1) {
    g.fillStyle(accent, 0.18 - i * 0.04);
    g.fillEllipse(cx, s * (0.84 + i * 0.04), 26 - i * 4, 6);
  }

  // 长披风
  g.fillStyle(dk, 1);
  g.fillTriangle(cx - s * 0.28, cy + s * 0.4, cx - s * 0.04, cy - s * 0.12, cx + s * 0.04, cy + s * 0.34);
  g.fillTriangle(cx + s * 0.28, cy + s * 0.4, cx + s * 0.04, cy - s * 0.12, cx - s * 0.04, cy + s * 0.34);
  g.fillStyle(main, 1);
  g.fillTriangle(cx - s * 0.22, cy + s * 0.32, cx, cy - s * 0.08, cx + s * 0.22, cy + s * 0.32);

  // 头
  g.fillStyle(hi, 1);
  g.fillCircle(cx, cy - s * 0.26, s * 0.13);
  // 头发
  g.fillStyle(dk, 1);
  g.fillEllipse(cx, cy - s * 0.32, s * 0.28, s * 0.12);

  // 剑（背在身后）
  g.lineStyle(3, hi, 1);
  g.lineBetween(cx - s * 0.18, cy - s * 0.1, cx + s * 0.18, cy + s * 0.32);
  g.fillStyle(accent, 1);
  g.fillCircle(cx - s * 0.18, cy - s * 0.1, 4);
}

// ─── 敌机：basic & elite ─────────────────────────────────────────────

function drawEnemyBasic(
  g: Phaser.GameObjects.Graphics,
  pal: ShooterPalette,
  s: number,
  style: AssetStyle,
): void {
  const cx = s / 2;
  const cy = s / 2;
  const main = hexToUint(pal.hazard);
  const dk = darken(pal.hazard, 0.4);
  const hi = lighten(pal.hazard, 0.3);
  const eye = mix(pal.hazard, "#ffffff", 0.85);

  if (style === "bullet-hell" || style === "neon-cyber") {
    // 几何菱形 + 光晕
    for (let i = 3; i > 0; i -= 1) {
      g.fillStyle(main, 0.08 * i);
      g.fillCircle(cx, cy, s * 0.22 + i * 4);
    }
    g.fillStyle(dk, 1);
    g.fillTriangle(cx, cy - s * 0.32, cx - s * 0.3, cy + s * 0.1, cx + s * 0.3, cy + s * 0.1);
    g.fillTriangle(cx, cy + s * 0.32, cx - s * 0.3, cy + s * 0.1, cx + s * 0.3, cy + s * 0.1);
    g.fillStyle(main, 1);
    g.fillTriangle(cx, cy - s * 0.24, cx - s * 0.22, cy + s * 0.08, cx + s * 0.22, cy + s * 0.08);
    g.fillTriangle(cx, cy + s * 0.24, cx - s * 0.22, cy + s * 0.08, cx + s * 0.22, cy + s * 0.08);
    g.fillStyle(eye, 1);
    g.fillCircle(cx, cy, s * 0.06);
    return;
  }

  if (style === "kawaii-mecha" || style === "cute-cartoon") {
    // 圆胖小怪
    g.fillStyle(dk, 1);
    g.fillCircle(cx, cy + s * 0.05, s * 0.28);
    g.fillStyle(main, 1);
    g.fillCircle(cx, cy + s * 0.02, s * 0.24);
    // 大眼
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx - s * 0.08, cy - s * 0.02, s * 0.08);
    g.fillCircle(cx + s * 0.08, cy - s * 0.02, s * 0.08);
    g.fillStyle(0x222222, 1);
    g.fillCircle(cx - s * 0.07, cy - s * 0.01, s * 0.04);
    g.fillCircle(cx + s * 0.09, cy - s * 0.01, s * 0.04);
    // 牙
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(cx - s * 0.03, cy + s * 0.12, cx, cy + s * 0.2, cx + s * 0.03, cy + s * 0.12);
    return;
  }

  // 默认：classic 倒梯形战机
  g.fillStyle(dk, 1);
  g.fillTriangle(cx - s * 0.32, cy - s * 0.15, cx + s * 0.32, cy - s * 0.15, cx, cy + s * 0.32);
  g.fillStyle(main, 1);
  g.fillTriangle(cx - s * 0.26, cy - s * 0.1, cx + s * 0.26, cy - s * 0.1, cx, cy + s * 0.26);

  // 机身中线
  g.fillStyle(hi, 1);
  g.fillRoundedRect(cx - s * 0.06, cy - s * 0.18, s * 0.12, s * 0.36, 4);

  // 红色机眼
  g.fillStyle(0xff3344, 1);
  g.fillCircle(cx - s * 0.12, cy, s * 0.04);
  g.fillCircle(cx + s * 0.12, cy, s * 0.04);
}

function drawEnemyElite(
  g: Phaser.GameObjects.Graphics,
  pal: ShooterPalette,
  s: number,
  style: AssetStyle,
): void {
  drawEnemyBasic(g, pal, s, style);
  const cx = s / 2;
  const cy = s / 2;
  const accent = hexToUint(pal.collectible);
  const glow = hexToUint(pal.particle);

  // 装甲外环
  g.lineStyle(3, accent, 1);
  g.strokeCircle(cx, cy, s * 0.36);
  // 4 个金色装饰角
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const px = cx + Math.cos(a) * s * 0.34;
    const py = cy + Math.sin(a) * s * 0.34;
    g.fillStyle(accent, 1);
    g.fillCircle(px, py, 5);
    g.fillStyle(glow, 0.5);
    g.fillCircle(px, py, 9);
  }
}

// ─── Boss ─────────────────────────────────────────────────────────────

function drawBoss(
  g: Phaser.GameObjects.Graphics,
  pal: ShooterPalette,
  s: number,
  style: AssetStyle,
): void {
  const cx = s / 2;
  const cy = s / 2;
  const main = hexToUint(pal.hazard);
  const dk = darken(pal.hazard, 0.45);
  const hi = lighten(pal.hazard, 0.32);
  const accent = hexToUint(pal.collectible);
  const glow = hexToUint(pal.particle);

  // 大光晕
  for (let i = 5; i > 0; i -= 1) {
    g.fillStyle(glow, 0.05 * i);
    g.fillCircle(cx, cy, s * 0.38 + i * 6);
  }

  if (style === "bullet-hell" || style === "neon-cyber") {
    // 多边形 boss
    const radii = [s * 0.42, s * 0.32];
    const sides = 8;
    for (let layer = 0; layer < 2; layer += 1) {
      const r = radii[layer]!;
      const fill = layer === 0 ? dk : main;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < sides; i += 1) {
        const a = (i / sides) * Math.PI * 2;
        pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
      }
      g.fillStyle(fill, 1);
      g.fillPoints(pts, true);
    }
    // 中央核心
    g.fillStyle(accent, 1);
    g.fillCircle(cx, cy, s * 0.14);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(cx, cy, s * 0.07);
    // 弱点环
    g.lineStyle(3, accent, 1);
    g.strokeCircle(cx, cy, s * 0.22);
    return;
  }

  // 默认：母舰
  g.fillStyle(dk, 1);
  g.fillEllipse(cx, cy, s * 0.86, s * 0.5);
  g.fillStyle(main, 1);
  g.fillEllipse(cx, cy - 4, s * 0.78, s * 0.42);
  g.fillStyle(hi, 1);
  g.fillEllipse(cx, cy - s * 0.08, s * 0.5, s * 0.18);

  // 主炮台
  g.fillStyle(dk, 1);
  g.fillRoundedRect(cx - s * 0.12, cy + s * 0.05, s * 0.24, s * 0.22, 6);
  g.fillStyle(accent, 1);
  g.fillCircle(cx, cy + s * 0.16, s * 0.05);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(cx, cy + s * 0.16, s * 0.025);

  // 两侧副炮
  g.fillStyle(dk, 1);
  g.fillRoundedRect(cx - s * 0.36, cy + s * 0.04, s * 0.12, s * 0.18, 4);
  g.fillRoundedRect(cx + s * 0.24, cy + s * 0.04, s * 0.12, s * 0.18, 4);

  // 顶部多个红眼
  for (let i = -1; i <= 1; i += 1) {
    g.fillStyle(0xff3344, 1);
    g.fillCircle(cx + i * s * 0.18, cy - s * 0.16, s * 0.035);
    g.fillStyle(0xffaaaa, 0.7);
    g.fillCircle(cx + i * s * 0.18, cy - s * 0.16, s * 0.05);
  }
}

// ─── 子弹 ─────────────────────────────────────────────────────────────

function drawPlayerBullet(g: Phaser.GameObjects.Graphics, pal: ShooterPalette): void {
  const w = BULLET_W;
  const h = BULLET_H;
  const core = hexToUint(pal.collectible);
  const glow = hexToUint(pal.particle);

  // 光晕
  g.fillStyle(glow, 0.35);
  g.fillRoundedRect(0, h * 0.1, w, h * 0.8, w / 2);
  // 主弹
  g.fillStyle(core, 1);
  g.fillRoundedRect(w * 0.2, h * 0.05, w * 0.6, h * 0.9, w / 4);
  // 高光
  g.fillStyle(0xffffff, 0.95);
  g.fillRoundedRect(w * 0.4, h * 0.1, w * 0.18, h * 0.7, w / 8);
}

function drawEnemyBullet(g: Phaser.GameObjects.Graphics, pal: ShooterPalette): void {
  const w = BULLET_W;
  const h = BULLET_H * 0.7;
  const core = hexToUint(pal.hazard);
  const hi = lighten(pal.hazard, 0.4);

  g.fillStyle(core, 0.4);
  g.fillCircle(w / 2, h / 2, w * 0.6);
  g.fillStyle(core, 1);
  g.fillCircle(w / 2, h / 2, w * 0.42);
  g.fillStyle(hi, 1);
  g.fillCircle(w / 2 - 1, h / 2 - 1, w * 0.18);
}

// ─── 道具 ─────────────────────────────────────────────────────────────

function drawPowerup(
  g: Phaser.GameObjects.Graphics,
  pal: ShooterPalette,
  kind: "shield" | "spread" | "laser" | "bomb",
): void {
  const s = POWER_SIZE;
  const cx = s / 2;
  const cy = s / 2;
  const glow = hexToUint(pal.particle);

  // 通用光晕背板
  for (let i = 3; i > 0; i -= 1) {
    g.fillStyle(glow, 0.08 * i);
    g.fillCircle(cx, cy, s * 0.34 + i * 3);
  }
  g.fillStyle(0xffffff, 0.18);
  g.fillCircle(cx, cy, s * 0.32);

  if (kind === "shield") {
    const c = hexToUint("#5dd9ff");
    g.lineStyle(4, c, 1);
    g.beginPath();
    g.arc(cx, cy + 4, s * 0.24, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
    g.strokePath();
    g.fillStyle(c, 0.3);
    g.fillCircle(cx, cy + 2, s * 0.22);
    g.fillStyle(0xffffff, 0.95);
    g.fillRoundedRect(cx - 2, cy - 12, 4, 18, 1);
  } else if (kind === "spread") {
    const c = hexToUint("#fbbf24");
    for (let i = -2; i <= 2; i += 1) {
      const a = i * 0.32 - Math.PI / 2;
      g.fillStyle(c, 1);
      g.fillCircle(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18, 5);
    }
    g.fillStyle(c, 1);
    g.fillCircle(cx, cy, 6);
  } else if (kind === "laser") {
    const c = hexToUint("#f87171");
    g.fillStyle(c, 1);
    g.fillRect(cx - 3, cy - s * 0.3, 6, s * 0.6);
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(cx - 1, cy - s * 0.3, 2, s * 0.6);
    g.fillStyle(c, 0.7);
    g.fillCircle(cx, cy - s * 0.3, 5);
    g.fillCircle(cx, cy + s * 0.3, 5);
  } else {
    // bomb
    const c = hexToUint("#fb923c");
    g.fillStyle(c, 1);
    g.fillCircle(cx, cy + 4, s * 0.22);
    g.fillStyle(darken("#fb923c", 0.3), 1);
    g.fillCircle(cx, cy + 4, s * 0.18);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(cx - 4, cy, s * 0.05);
    g.lineStyle(2, 0x222222, 1);
    g.lineBetween(cx + 4, cy - 8, cx + 10, cy - 16);
    g.fillStyle(0xffd166, 1);
    g.fillCircle(cx + 10, cy - 16, 3);
  }
}

// ─── Public builder ───────────────────────────────────────────────────

/**
 * 为 ShooterScene 一次性生成所有纹理。
 * 返回每个纹理的 key，scene 可以直接拿去 add.image / physics.add.image。
 */
export function buildShooterAssetSet(
  scene: Phaser.Scene,
  palette: ShooterPalette,
  style: AssetStyle,
  keyPrefix = "shAsset",
): ShooterAssetSet {
  const set: ShooterAssetSet = {
    player: `${keyPrefix}_player`,
    enemyBasic: `${keyPrefix}_enemy`,
    enemyElite: `${keyPrefix}_elite`,
    boss: `${keyPrefix}_boss`,
    playerBullet: `${keyPrefix}_pbullet`,
    enemyBullet: `${keyPrefix}_ebullet`,
    powerShield: `${keyPrefix}_pwr_shield`,
    powerSpread: `${keyPrefix}_pwr_spread`,
    powerLaser: `${keyPrefix}_pwr_laser`,
    powerBomb: `${keyPrefix}_pwr_bomb`,
  };

  const mk = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const g = makeGraphics(scene);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  // 玩家：按 style 挑绘制
  mk(set.player, PLAYER_SIZE, PLAYER_SIZE, (g) => {
    switch (style) {
      case "hard-sci-fi":
      case "neon-cyber":
        return drawPlayerHardSciFi(g, palette, PLAYER_SIZE);
      case "kawaii-mecha":
      case "cute-cartoon":
        return drawPlayerKawaiiMecha(g, palette, PLAYER_SIZE);
      case "bullet-hell":
      case "dark-fantasy":
        return drawPlayerBulletHell(g, palette, PLAYER_SIZE);
      case "wuxia-flight":
        return drawPlayerWuxiaFlight(g, palette, PLAYER_SIZE);
      default:
        return drawPlayerClassicArcade(g, palette, PLAYER_SIZE);
    }
  });

  mk(set.enemyBasic, ENEMY_SIZE, ENEMY_SIZE, (g) => drawEnemyBasic(g, palette, ENEMY_SIZE, style));
  mk(set.enemyElite, ENEMY_SIZE, ENEMY_SIZE, (g) => drawEnemyElite(g, palette, ENEMY_SIZE, style));
  mk(set.boss, BOSS_SIZE, BOSS_SIZE, (g) => drawBoss(g, palette, BOSS_SIZE, style));
  mk(set.playerBullet, BULLET_W, BULLET_H, (g) => drawPlayerBullet(g, palette));
  mk(set.enemyBullet, BULLET_W, Math.floor(BULLET_H * 0.7), (g) => drawEnemyBullet(g, palette));
  mk(set.powerShield, POWER_SIZE, POWER_SIZE, (g) => drawPowerup(g, palette, "shield"));
  mk(set.powerSpread, POWER_SIZE, POWER_SIZE, (g) => drawPowerup(g, palette, "spread"));
  mk(set.powerLaser, POWER_SIZE, POWER_SIZE, (g) => drawPowerup(g, palette, "laser"));
  mk(set.powerBomb, POWER_SIZE, POWER_SIZE, (g) => drawPowerup(g, palette, "bomb"));

  return set;
}

/** 给 ShooterScene 的星空背景做一层细节升级（多层视差点 + 偶发流星） */
export function buildShooterStarfieldTexture(
  scene: Phaser.Scene,
  palette: ShooterPalette,
  w: number,
  h: number,
  key = "shStarfield",
): string {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = makeGraphics(scene);

  // 渐变底
  const bg = hexToColor(palette.background);
  const bgUint = bg.color;
  const bgUp = lighten(palette.background, 0.18);
  g.fillStyle(bgUint, 1);
  g.fillRect(0, 0, w, h);
  // 顶部高光梯度（模拟视差远方）
  for (let i = 0; i < 18; i += 1) {
    g.fillStyle(bgUp, (0.04 - (i / 18) * 0.04));
    g.fillRect(0, i * (h / 18), w, h / 18);
  }

  // 大星
  const starColor = mix(palette.particle, "#ffffff", 0.5);
  for (let i = 0; i < 32; i += 1) {
    const x = (i * 137.5) % w;
    const y = ((i * 257.3) + 13) % h;
    const r = 1.5 + ((i * 17) % 3);
    g.fillStyle(starColor, 0.85);
    g.fillCircle(x, y, r);
  }
  // 小星（更密）
  const dimStar = mix(palette.particle, palette.background, 0.4);
  for (let i = 0; i < 140; i += 1) {
    const x = (i * 61.7 + 23) % w;
    const y = (i * 91.3 + 41) % h;
    g.fillStyle(dimStar, 0.6);
    g.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  }
  // 偶发流星
  const meteor = mix(palette.collectible, "#ffffff", 0.5);
  for (let i = 0; i < 3; i += 1) {
    const x = ((i + 1) * 211) % w;
    const y = ((i + 1) * 137) % h;
    g.lineStyle(2, meteor, 0.7);
    g.lineBetween(x, y, x + 24, y + 8);
  }

  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}
