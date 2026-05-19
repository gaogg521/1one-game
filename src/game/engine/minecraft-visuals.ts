import Phaser from "phaser";
import type { GameSpec } from "@/lib/game-spec";
import { isMinecraftLikeSpec } from "@/lib/minecraft-franchise";

export { isMinecraftLikeSpec };

export const MC_BLOCK = 16;
export const MC_GRASS = 0x5d9b47;
export const MC_GRASS_TOP = 0x6eb854;
export const MC_DIRT = 0x8b6914;
export const MC_SKY = 0x6eb5ff;
export const MC_EMERALD = 0x17c653;
export const MC_EMERALD_DARK = 0x0d7a32;
export const MC_CACTUS = 0x3d8f3d;

function shiftCol(c: number, d: number): number {
  const r = Phaser.Math.Clamp(((c >> 16) & 0xff) + d, 0, 255);
  const g = Phaser.Math.Clamp(((c >> 8) & 0xff) + d, 0, 255);
  const b = Phaser.Math.Clamp((c & 0xff) + d, 0, 255);
  return (r << 16) | (g << 8) | b;
}

function drawGrassDirtStrip(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  const rows = Math.ceil(h / MC_BLOCK);
  for (let row = 0; row < rows; row += 1) {
    const y = row * MC_BLOCK;
    const rh = Math.min(MC_BLOCK, h - y);
    for (let col = 0; col < Math.ceil(w / MC_BLOCK); col += 1) {
      const x = col * MC_BLOCK;
      const rw = Math.min(MC_BLOCK, w - x);
      const top = row === 0;
      g.fillStyle(top ? MC_GRASS_TOP : row === 1 ? MC_GRASS : MC_DIRT, 1);
      g.fillRect(x, y, rw, rh);
      g.lineStyle(1, 0x000000, 0.22);
      g.strokeRect(x + 0.5, y + 0.5, rw - 1, rh - 1);
    }
  }
}

/** 固定视口底（avoider 等）。 */
export function addMinecraftBackdrop(scene: Phaser.Scene): void {
  const { width, height } = scene.scale;
  const g = scene.add.graphics().setDepth(-20);
  g.fillStyle(MC_SKY, 1);
  g.fillRect(0, 0, width, height * 0.55);
  const groundY = Math.floor(height * 0.55);
  for (let y = groundY; y < height; y += MC_BLOCK) {
    for (let x = 0; x < width; x += MC_BLOCK) {
      const isGrassRow = y === groundY;
      g.fillStyle(isGrassRow ? MC_GRASS_TOP : MC_DIRT, 1);
      g.fillRect(x, y, MC_BLOCK, MC_BLOCK);
      if (isGrassRow) {
        g.fillStyle(MC_GRASS, 1);
        g.fillRect(x, y + MC_BLOCK, MC_BLOCK, MC_BLOCK);
      }
      g.lineStyle(1, 0x000000, 0.18);
      g.strokeRect(x + 0.5, y + 0.5, MC_BLOCK - 1, MC_BLOCK - 1);
    }
  }
  g.fillStyle(0x4a7a3a, 0.35);
  for (let i = 0; i < 8; i += 1) {
    const bx = 40 + i * (width / 9);
    const bh = Phaser.Math.Between(2, 5) * MC_BLOCK;
    g.fillRect(bx, groundY - bh, MC_BLOCK * 2, bh);
  }
}

/** 横版跑酷：天空 + 远景方块山（随镜头轻滚）。 */
export function addMinecraftPlatformerBackdrop(scene: Phaser.Scene, worldW: number): void {
  const H = scene.scale.height;
  const sky = scene.add.graphics().setDepth(-20).setScrollFactor(0.08);
  sky.fillStyle(MC_SKY, 1);
  sky.fillRect(0, 0, worldW + 800, H);

  const clouds = scene.add.graphics().setDepth(-19).setScrollFactor(0.15);
  for (let i = 0; i < Math.ceil(worldW / 280); i += 1) {
    const cx = i * 280 + Phaser.Math.Between(0, 80);
    const cy = Phaser.Math.Between(28, 90);
    clouds.fillStyle(0xffffff, 0.92);
    clouds.fillRect(cx, cy, MC_BLOCK * 4, MC_BLOCK);
    clouds.fillRect(cx + MC_BLOCK, cy - MC_BLOCK, MC_BLOCK * 2, MC_BLOCK);
    clouds.fillRect(cx + MC_BLOCK * 2, cy + MC_BLOCK, MC_BLOCK * 3, MC_BLOCK);
  }

  const hills = scene.add.graphics().setDepth(-18).setScrollFactor(0.28);
  for (let hx = 0; hx < worldW + 400; hx += Phaser.Math.Between(120, 200)) {
    const bh = Phaser.Math.Between(3, 7) * MC_BLOCK;
    for (let b = 0; b < bh / MC_BLOCK; b += 1) {
      hills.fillStyle(b === 0 ? MC_GRASS_TOP : MC_GRASS, 1);
      hills.fillRect(hx, H - 120 - b * MC_BLOCK, MC_BLOCK * 3, MC_BLOCK);
      hills.fillStyle(MC_DIRT, 1);
      hills.fillRect(hx + MC_BLOCK * 0.5, H - 120 + MC_BLOCK - b * MC_BLOCK, MC_BLOCK * 2, MC_BLOCK * 2);
    }
  }
}

/** 方块人（史蒂夫风）。 */
export function ensureMinecraftPlayerTexture(scene: Phaser.Scene, spec: GameSpec): void {
  if (scene.textures.exists("texPlayer")) return;
  const pc = parseInt(spec.theme.playerColor.replace("#", ""), 16);
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x000000, 0.15);
  g.fillRect(2, 34, 28, 4);
  g.fillStyle(pc, 1);
  g.fillRect(10, 6, 12, 12);
  g.fillStyle(0x3b2e88, 1);
  g.fillRect(6, 18, 8, 14);
  g.fillRect(18, 18, 8, 14);
  g.fillStyle(0x4a3728, 1);
  g.fillRect(8, 32, 6, 6);
  g.fillRect(18, 32, 6, 6);
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(12, 9, 2, 2);
  g.fillRect(17, 9, 2, 2);
  g.generateTexture("texPlayer", 32, 38);
  g.destroy();
}

/** avoider / collector 等通用威胁与收集物。 */
export function ensureMinecraftEntityTextures(scene: Phaser.Scene, spec: GameSpec): void {
  ensureMinecraftPlayerTexture(scene, spec);

  if (!scene.textures.exists("texHazard")) {
    const hc = parseInt(spec.theme.hazardColor.replace("#", ""), 16);
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(shiftCol(hc, -40), 1);
    g.fillRect(4, 4, 32, 32);
    g.fillStyle(hc, 1);
    g.fillRect(6, 6, 28, 28);
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(10, 12, 4, 6);
    g.fillRect(22, 12, 4, 6);
    g.fillStyle(0x2d2d2d, 1);
    g.fillRect(12, 22, 16, 4);
    g.generateTexture("texHazard", 40, 40);
    g.destroy();
  }

  if (!scene.textures.exists("texCollectible")) {
    drawEmeraldBlockTexture(scene, "texCollectible");
  }
}

function drawEmeraldBlockTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(MC_EMERALD_DARK, 1);
  g.fillRect(0, 0, 20, 20);
  g.fillStyle(MC_EMERALD, 1);
  g.fillRect(2, 2, 16, 16);
  g.fillStyle(shiftCol(MC_EMERALD, 50), 0.7);
  g.fillRect(4, 4, 6, 6);
  g.fillStyle(shiftCol(MC_EMERALD, -35), 1);
  g.fillRect(2, 14, 16, 4);
  g.fillRect(14, 2, 4, 16);
  g.lineStyle(1, 0x000000, 0.35);
  g.strokeRect(1, 1, 18, 18);
  g.generateTexture(key, 20, 20);
  g.destroy();
}

function drawCactusTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const drawBlock = (x: number, y: number, c: number) => {
    g.fillStyle(c, 1);
    g.fillRect(x, y, MC_BLOCK, MC_BLOCK);
    g.lineStyle(1, 0x000000, 0.3);
    g.strokeRect(x + 0.5, y + 0.5, MC_BLOCK - 1, MC_BLOCK - 1);
  };
  drawBlock(10, 2, MC_CACTUS);
  drawBlock(10, 18, shiftCol(MC_CACTUS, -15));
  drawBlock(10, 34, shiftCol(MC_CACTUS, -25));
  drawBlock(26, 18, MC_CACTUS);
  drawBlock(42, 18, MC_CACTUS);
  g.generateTexture(key, 58, 50);
  g.destroy();
}

/** platformer：草方块平台、泥土、绿宝石块、仙人掌障碍。 */
export function ensureMinecraftPlatformerTextures(scene: Phaser.Scene, _spec: GameSpec): void {
  ensureMinecraftPlayerTexture(scene, _spec);

  const makeStrip = (key: string, w: number, h: number) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawGrassDirtStrip(g, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  makeStrip("texPlat", 128, 24);
  makeStrip("texPlatHi", 128, 24);
  makeStrip("texGround", 64, 40);
  drawCactusTexture(scene, "texSpike");
  drawEmeraldBlockTexture(scene, "texGem");
  drawEmeraldBlockTexture(scene, "texPower");
}
