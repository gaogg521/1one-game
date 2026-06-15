import Phaser from "phaser";
import type { GameSpec } from "@/lib/game-spec";

function hexToNum(hex: string): number {
  const parsed = parseInt(hex.replace("#", ""), 16);
  return Number.isFinite(parsed) ? parsed : 0x334155;
}

function shiftHex(c: number, d: number): number {
  const r = Phaser.Math.Clamp(((c >> 16) & 0xff) + d, 0, 255);
  const g = Phaser.Math.Clamp(((c >> 8) & 0xff) + d, 0, 255);
  const b = Phaser.Math.Clamp((c & 0xff) + d, 0, 255);
  return (r << 16) | (g << 8) | b;
}

/** Smash the Dummy — 发泄场背景 + 打击区光晕 */
export function paintSmashDummyArena(
  scene: Phaser.Scene,
  spec: GameSpec,
  w: number,
  h: number,
  dummyX: number,
  dummyY: number,
): void {
  const bg = hexToNum(spec.theme.backgroundColor);
  const accent = hexToNum(spec.theme.particleTint ?? spec.theme.playerColor);

  const backdrop = scene.add.graphics().setDepth(-5);
  backdrop.fillGradientStyle(shiftHex(bg, 20), shiftHex(bg, 20), bg, shiftHex(bg, -18), 1);
  backdrop.fillRect(0, 0, w, h);

  const floor = scene.add.graphics().setDepth(-4);
  floor.fillStyle(0x1e293b, 0.85);
  floor.fillRect(0, h - 56, w, 56);
  floor.lineStyle(2, accent, 0.35);
  floor.lineBetween(0, h - 56, w, h - 56);

  for (let i = 0; i < 5; i += 1) {
    const lx = w * (0.1 + i * 0.18);
    floor.lineStyle(1, 0x475569, 0.4);
    floor.lineBetween(lx, h - 56, lx - 20, h);
  }

  const zone = scene.add.graphics().setDepth(-3);
  zone.fillStyle(accent, 0.08);
  zone.fillCircle(dummyX, dummyY, 100);
  zone.lineStyle(2, accent, 0.2);
  zone.strokeCircle(dummyX, dummyY, 100);

  scene.add
    .text(dummyX, dummyY - 88, "🎯", { fontSize: "28px" })
    .setOrigin(0.5)
    .setDepth(-2)
    .setAlpha(0.55);
}

/** 生成更立体的沙袋人偶纹理 */
export function generateRichDummyTexture(
  scene: Phaser.Scene,
  key: string,
  bodyColor: string,
  accentColor: string,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const body = hexToNum(bodyColor);
  const accent = hexToNum(accentColor);

  g.fillStyle(shiftHex(body, -30), 0.5);
  g.fillRoundedRect(6, 8, 80, 128, 14);
  g.fillStyle(body, 1);
  g.fillRoundedRect(4, 4, 80, 128, 14);
  g.lineStyle(2, accent, 0.45);
  g.strokeRoundedRect(4, 4, 80, 128, 14);

  g.fillStyle(0xffffff, 1);
  g.fillCircle(44, 32, 20);
  g.fillStyle(0x1e293b, 1);
  g.fillCircle(38, 30, 4);
  g.fillCircle(50, 30, 4);
  g.lineStyle(2, 0x1e293b, 1);
  g.beginPath();
  g.arc(44, 38, 8, 0.2, Math.PI - 0.2);
  g.strokePath();

  g.fillStyle(accent, 0.7);
  g.fillRect(30, 58, 28, 6);
  g.fillStyle(shiftHex(body, -15), 1);
  g.fillRoundedRect(18, 70, 52, 48, 8);

  g.lineStyle(3, 0x854d0e, 0.8);
  g.lineBetween(44, 4, 44, 18);

  g.generateTexture(key, 88, 136);
  g.destroy();
}

/** 策略地图 — 羊皮纸/战术底图 */
export function paintStrategyMapBackdrop(scene: Phaser.Scene, spec: GameSpec, w: number, h: number): void {
  const bg = hexToNum(spec.theme.backgroundColor);
  const accent = hexToNum(spec.theme.collectibleColor ?? spec.theme.playerColor);

  const map = scene.add.graphics().setDepth(-5);
  map.fillGradientStyle(shiftHex(bg, 12), shiftHex(bg, 12), shiftHex(bg, -8), shiftHex(bg, -16), 1);
  map.fillRect(0, 0, w, h);

  map.lineStyle(1, accent, 0.12);
  for (let gx = 0; gx < w; gx += 48) map.lineBetween(gx, 60, gx, h - 40);
  for (let gy = 60; gy < h - 40; gy += 48) map.lineBetween(0, gy, w, gy);

  map.fillStyle(accent, 0.06);
  map.fillRoundedRect(16, 64, w - 32, h - 108, 12);
  map.lineStyle(2, accent, 0.25);
  map.strokeRoundedRect(16, 64, w - 32, h - 108, 12);
}

/** 策略节点 — 堡垒圆 + 旗帜色 */
export function drawStrategyNode(
  g: Phaser.GameObjects.Graphics,
  nx: number,
  ny: number,
  radius: number,
  ownerColor: string,
  selected: boolean,
  owner: string,
): void {
  const col = hexToNum(ownerColor);
  if (selected) {
    g.lineStyle(4, 0x38bdf8, 0.65);
    g.strokeCircle(nx, ny, radius + 8);
  }
  if (owner === "player") {
    g.fillStyle(0x000000, 0.2);
    g.fillCircle(nx + 3, ny + 3, radius);
  }
  g.fillStyle(col, 1);
  g.fillCircle(nx, ny, radius);
  g.lineStyle(2, shiftHex(col, -35), 0.9);
  g.strokeCircle(nx, ny, radius);
  if (owner === "player") {
    g.fillStyle(0xfef08a, 1);
    g.fillTriangle(nx - 6, ny - radius - 4, nx + 6, ny - radius - 4, nx, ny - radius - 14);
  } else if (owner === "ai") {
    g.fillStyle(0xef4444, 0.85);
    g.fillRect(nx - 5, ny - radius - 12, 10, 8);
  }
}

/** 国际象棋 3D 演播室背景 */
export function paintChessStudioBackdrop(scene: Phaser.Scene, spec: GameSpec, w: number, h: number): void {
  const bg = hexToNum(spec.theme.backgroundColor);
  const accent = hexToNum(spec.theme.collectibleColor ?? "#fbbf24");

  const backdrop = scene.add.graphics().setDepth(-5);
  backdrop.fillGradientStyle(shiftHex(bg, 16), shiftHex(bg, 16), shiftHex(bg, -20), shiftHex(bg, -30), 1);
  backdrop.fillRect(0, 0, w, h);

  const spot = scene.add.graphics().setDepth(-4);
  spot.fillStyle(accent, 0.1);
  spot.fillTriangle(w / 2 - 120, 0, w / 2 + 120, 0, w / 2, h * 0.55);

  scene.add
    .text(w / 2, h - 36, "♚ ♛", { fontSize: "18px", color: "#a8a29e" })
    .setOrigin(0.5)
    .setAlpha(0.35)
    .setDepth(-3);
}

/** 定制 — 立体小汽车 */
export function drawStyledCar(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  bodyColor: string,
  wheelColor: string,
): void {
  const body = hexToNum(bodyColor);
  const wheel = hexToNum(wheelColor);

  g.clear();
  g.fillStyle(shiftHex(body, -35), 0.45);
  g.fillRoundedRect(cx - 88, cy - 24, 184, 54, 12);
  g.fillStyle(body, 1);
  g.fillRoundedRect(cx - 92, cy - 30, 184, 54, 12);
  g.lineStyle(2, shiftHex(body, 25), 0.5);
  g.strokeRoundedRect(cx - 92, cy - 30, 184, 54, 12);

  g.fillStyle(0xbae6fd, 0.85);
  g.fillRoundedRect(cx - 18, cy - 24, 56, 24, 5);
  g.fillStyle(0xffffff, 0.25);
  g.fillRoundedRect(cx - 14, cy - 20, 22, 10, 3);

  g.fillStyle(wheel, 1);
  g.fillCircle(cx - 58, cy + 30, 20);
  g.fillCircle(cx + 58, cy + 30, 20);
  g.fillStyle(0x1e293b, 0.9);
  g.fillCircle(cx - 58, cy + 30, 10);
  g.fillCircle(cx + 58, cy + 30, 10);

  g.fillStyle(0xfbbf24, 0.9);
  g.fillCircle(cx + 82, cy - 8, 6);
  g.fillStyle(0xef4444, 0.85);
  g.fillCircle(cx - 82, cy - 4, 5);
}

/** 定制 — 陶艺拉坯（带高光条纹） */
export function drawStyledPottery(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  vaseHeight: number,
  glazeColor: string,
  rimColor: string,
  baseColor: string,
  spinAngle: number,
): void {
  const glaze = hexToNum(glazeColor);
  const rim = hexToNum(rimColor);
  const base = hexToNum(baseColor);
  const vh = 40 + vaseHeight * 120;
  const gw = 28 + vaseHeight * 18;
  const topW = gw * 0.72;

  g.clear();
  g.lineStyle(3, 0x78716c, 0.5);
  g.strokeCircle(cx, cy + 70, 72);
  g.fillStyle(0x57534e, 0.35);
  g.fillCircle(cx, cy + 70, 72);

  g.fillStyle(glaze, 1);
  g.fillEllipse(cx, cy - vh * 0.35, topW, 18);
  g.fillRoundedRect(cx - gw / 2, cy - vh * 0.25, gw, vh * 0.55, 12);
  g.fillStyle(rim, 1);
  g.fillEllipse(cx, cy - vh * 0.28, topW + 8, 10);
  g.fillStyle(base, 1);
  g.fillRoundedRect(cx - gw * 0.55, cy + vh * 0.22, gw * 1.1, 16, 4);

  g.lineStyle(2, 0xffffff, 0.22);
  for (let i = 0; i < 6; i += 1) {
    const a = spinAngle + (i / 6) * Math.PI * 2;
    g.lineBetween(cx, cy - vh * 0.1, cx + Math.cos(a) * gw * 0.45, cy - vh * 0.1 + Math.sin(a) * 8);
  }
  g.fillStyle(0xffffff, 0.18);
  g.fillEllipse(cx - gw * 0.15, cy - vh * 0.05, gw * 0.12, vh * 0.25);
}

/** 环绕星球 — 大气层 + 地表细节 */
export function paintOrbitPlanetRich(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rng: () => number,
): void {
  g.clear();
  g.fillStyle(0x38bdf8, 0.15);
  g.fillEllipse(cx, cy, rx * 2.15, ry * 2.15);
  g.fillStyle(0x22c55e, 1);
  g.fillEllipse(cx, cy, rx * 2, ry * 2);
  g.fillStyle(0x15803d, 0.92);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    g.fillCircle(
      cx + Math.cos(a) * rx * (0.2 + rng() * 0.55),
      cy + Math.sin(a) * ry * (0.2 + rng() * 0.55),
      4 + Math.floor(rng() * 8),
    );
  }
  g.fillStyle(0x0ea5e9, 0.35);
  g.fillEllipse(cx - rx * 0.3, cy + ry * 0.1, rx * 0.5, ry * 0.35);
  g.lineStyle(2, 0x14532d, 0.55);
  g.strokeEllipse(cx, cy, rx * 2, ry * 2);
  g.fillStyle(0xffffff, 0.12);
  g.fillEllipse(cx - rx * 0.35, cy - ry * 0.35, rx * 0.55, ry * 0.3);
}

/** 狙击镜 overlay */
export function paintSniperScopeOverlay(scene: Phaser.Scene, w: number, h: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(3).setScrollFactor(0);
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.34;

  g.fillStyle(0x000000, 0.55);
  g.fillRect(0, 0, w, h);
  g.fillStyle(0x000000, 0);
  g.fillCircle(cx, cy, r);

  g.lineStyle(3, 0x4ade80, 0.65);
  g.strokeCircle(cx, cy, r);
  g.lineStyle(1, 0x4ade80, 0.4);
  g.lineBetween(cx - r, cy, cx + r, cy);
  g.lineBetween(cx, cy - r, cx, cy + r);
  for (let t = -2; t <= 2; t += 1) {
    if (t === 0) continue;
    g.lineBetween(cx + t * 24, cy - 8, cx + t * 24, cy + 8);
    g.lineBetween(cx - 8, cy + t * 24, cx + 8, cy + t * 24);
  }

  scene.add.circle(cx, cy, 3, 0xef4444, 0.95).setDepth(4).setScrollFactor(0);
  return g;
}

/** Elastic Thief — 博物馆/金库潜行背景 */
export function paintStealthVaultBackdrop(
  scene: Phaser.Scene,
  spec: GameSpec,
  worldW: number,
  viewH: number,
): void {
  const bg = hexToNum(spec.theme.backgroundColor);
  const accent = hexToNum(spec.theme.collectibleColor ?? "#fbbf24");

  const vault = scene.add.graphics().setDepth(-14);
  vault.fillGradientStyle(shiftHex(bg, 8), shiftHex(bg, 8), shiftHex(bg, -12), shiftHex(bg, -22), 1);
  vault.fillRect(0, 0, worldW, viewH);

  for (let i = 0; i < 8; i += 1) {
    const px = (i * 280 + 60) % worldW;
    vault.fillStyle(shiftHex(bg, 18), 0.35);
    vault.fillRect(px, viewH - 180, 8, 140);
    vault.lineStyle(1, accent, 0.2);
    vault.strokeRect(px - 40, viewH - 200, 88, 160);
  }

  const floor = scene.add.graphics().setDepth(-13);
  floor.fillStyle(0x0f172a, 0.55);
  floor.fillRect(0, viewH - 48, worldW, 48);
  floor.lineStyle(2, accent, 0.35);
  floor.lineBetween(0, viewH - 48, worldW, viewH - 48);

  for (let i = 0; i < 6; i += 1) {
    const lx = 80 + i * 220;
    if (lx > worldW - 100) continue;
    scene.add
      .text(lx, viewH - 220, "💎", { fontSize: "16px" })
      .setAlpha(0.15)
      .setDepth(-12);
  }
}

/** 潜行激光束（带光晕） */
export function drawStealthLaserBeam(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  oy: number,
  ex: number,
  ey: number,
  pulse: number,
): void {
  const alpha = 0.35 + pulse * 0.35;
  g.lineStyle(6, 0xef4444, alpha * 0.25);
  g.lineBetween(ox, oy, ex, ey);
  g.lineStyle(2, 0xef4444, alpha);
  g.lineBetween(ox, oy, ex, ey);
  g.fillStyle(0xfca5a5, alpha * 0.5);
  g.fillCircle(ex, ey, 5 + pulse * 3);
  g.fillStyle(0xef4444, alpha);
  g.fillCircle(ox, oy, 4);
}

/** 过山车装饰天空（主题色） */
export function paintCoasterSkyGradient(
  g: Phaser.GameObjects.Graphics,
  spec: GameSpec,
  w: number,
  h: number,
  warmRoad = false,
): void {
  const bg = hexToNum(spec.theme.backgroundColor);
  const accent = hexToNum(spec.theme.collectibleColor ?? spec.theme.playerColor);
  if (warmRoad) {
    g.fillGradientStyle(shiftHex(bg, 24), shiftHex(bg, 24), shiftHex(accent, -20), shiftHex(bg, -8), 1);
  } else {
    g.fillGradientStyle(shiftHex(accent, 20), shiftHex(accent, 20), shiftHex(bg, 10), bg, 1);
  }
  g.fillRect(0, 0, w, h);
}

/** 过山车车厢（立体） */
export function drawCoasterCartRich(
  g: Phaser.GameObjects.Graphics,
  cartX: number,
  cartY: number,
  cartW: number,
  cartH: number,
  bodyColor: number,
  thirdPerson: boolean,
): void {
  g.fillStyle(shiftHex(bodyColor, -30), 0.45);
  g.fillRoundedRect(cartX - cartW / 2 + 3, cartY - cartH + 3, cartW, cartH, 6);
  g.fillStyle(bodyColor, 1);
  g.fillRoundedRect(cartX - cartW / 2, cartY - cartH, cartW, cartH, 6);
  g.lineStyle(2, 0xffffff, 0.22);
  g.strokeRoundedRect(cartX - cartW / 2, cartY - cartH, cartW, cartH, 6);
  g.fillStyle(0x1f2937, 1);
  g.fillCircle(cartX - cartW * 0.32, cartY + 4, 7);
  g.fillCircle(cartX + cartW * 0.32, cartY + 4, 7);
  g.fillStyle(0xffffff, 0.2);
  g.fillRoundedRect(cartX - cartW * 0.35, cartY - cartH + 4, cartW * 0.7, cartH * 0.35, 4);
  if (thirdPerson) {
    g.fillStyle(0xfbbf24, 1);
    g.fillRoundedRect(cartX - 10, cartY - cartH - 16, 20, 14, 3);
    g.fillStyle(0xfde047, 0.8);
    g.fillCircle(cartX, cartY - cartH - 8, 5);
  }
}

/** 无尽公路障碍 — 车辆造型 */
export function drawEndlessRoadObstacle(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  w: number,
  h: number,
): void {
  g.fillStyle(0x7f1d1d, 0.5);
  g.fillRoundedRect(cx - w / 2 + 2, y + 2, w, h, 6);
  g.fillStyle(0xef4444, 0.75);
  g.fillRoundedRect(cx - w / 2, y, w, h, 6);
  g.fillStyle(0x1e293b, 1);
  g.fillCircle(cx - w * 0.28, y + h * 0.85, h * 0.18);
  g.fillCircle(cx + w * 0.28, y + h * 0.85, h * 0.18);
  g.fillStyle(0xbae6fd, 0.7);
  g.fillRoundedRect(cx - w * 0.15, y + h * 0.15, w * 0.35, h * 0.35, 3);
}
