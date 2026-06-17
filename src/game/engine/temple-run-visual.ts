import Phaser from "phaser";

export type TemplePathSample = {
  vanishX: number;
  y: number;
  laneWidth: number;
  scale: number;
  depth: number;
};

/** 伪 3D 跑道采样：depth 0=地平线，1=脚下 */
export function templePathSample(
  depth: number,
  w: number,
  h: number,
  curvePhase: number,
): TemplePathSample {
  const horizonY = h * 0.34;
  const groundY = h - 62;
  const eased = Math.pow(Phaser.Math.Clamp(depth, 0, 1), 0.86);
  const y = horizonY + (groundY - horizonY) * eased;
  const curve = Math.sin(curvePhase) * (28 + eased * 78) + Math.sin(curvePhase * 0.45 + 0.6) * 22;
  const vanishX = w * 0.5 + curve;
  const laneWidth = 22 + eased * 128;
  const scale = 0.18 + eased * 1.05;
  return { vanishX, y, laneWidth, scale, depth: eased };
}

export function templeLaneX(sample: TemplePathSample, lane: number, playerLane: number): number {
  const blend = lane + (playerLane - lane) * 0.06;
  return sample.vanishX + blend * sample.laneWidth * 0.68;
}

const RUNNER_TEXTURE_W = 76;
const RUNNER_TEXTURE_H = 96;
export const RUNNER_FRAME_COUNT = 12;
export const TEMPLE_RUNNER_ATLAS_KEY = "temple-runner-v7";
export const TEMPLE_RUNNER_ATLAS_URL = "/game-sprites/sample-temple-relic-runner/temple-runner-v7.png";
const RUNNER_VERSION = "v6";
const RUNNER_ATLAS_VERSION = "v7";

export type TempleRunnerPose = "run" | "jump" | "slide" | "leanL" | "leanR";

export function registerTempleRunnerAtlasLoader(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEMPLE_RUNNER_ATLAS_KEY)) return;
  scene.load.spritesheet(TEMPLE_RUNNER_ATLAS_KEY, TEMPLE_RUNNER_ATLAS_URL, {
    frameWidth: RUNNER_TEXTURE_W,
    frameHeight: RUNNER_TEXTURE_H,
  });
}

function ensureAtlasPoseTextures(scene: Phaser.Scene): void {
  const prefix = `temple-runner-${RUNNER_ATLAS_VERSION}`;
  ensurePoseTexture(scene, `${prefix}-jump`, (g) => drawRunnerJump(g), RUNNER_TEXTURE_W, RUNNER_TEXTURE_H);
  ensurePoseTexture(scene, `${prefix}-slide`, (g) => drawRunnerSlide(g), RUNNER_TEXTURE_W, RUNNER_TEXTURE_H);
  ensurePoseTexture(scene, `${prefix}-lean-l`, (g) => drawRunnerFrame(g, 1, 0, -0.28), RUNNER_TEXTURE_W, RUNNER_TEXTURE_H);
  ensurePoseTexture(scene, `${prefix}-lean-r`, (g) => drawRunnerFrame(g, 1, 0, 0.28), RUNNER_TEXTURE_W, RUNNER_TEXTURE_H);
}

export function ensureTempleRunnerFrames(scene: Phaser.Scene): readonly string[] {
  if (scene.textures.exists(TEMPLE_RUNNER_ATLAS_KEY)) {
    ensureAtlasPoseTextures(scene);
    const keys: string[] = [];
    for (let f = 0; f < RUNNER_FRAME_COUNT; f += 1) {
      keys.push(`${TEMPLE_RUNNER_ATLAS_KEY}_${f}`);
    }
    return keys;
  }

  const keys: string[] = [];
  for (let f = 0; f < RUNNER_FRAME_COUNT; f += 1) {
    const key = `temple-runner-${RUNNER_VERSION}-f${f}`;
    keys.push(key);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    drawRunnerFrame(g, f, 0);
    g.generateTexture(key, RUNNER_TEXTURE_W, RUNNER_TEXTURE_H);
    g.destroy();
  }
  const prefix = `temple-runner-${RUNNER_VERSION}`;
  ensurePoseTexture(scene, `${prefix}-jump`, (g) => drawRunnerJump(g), RUNNER_TEXTURE_W, RUNNER_TEXTURE_H);
  ensurePoseTexture(scene, `${prefix}-slide`, (g) => drawRunnerSlide(g), RUNNER_TEXTURE_W, RUNNER_TEXTURE_H);
  ensurePoseTexture(scene, `${prefix}-lean-l`, (g) => drawRunnerFrame(g, 1, 0, -0.28), RUNNER_TEXTURE_W, RUNNER_TEXTURE_H);
  ensurePoseTexture(scene, `${prefix}-lean-r`, (g) => drawRunnerFrame(g, 1, 0, 0.28), RUNNER_TEXTURE_W, RUNNER_TEXTURE_H);
  return keys;
}

function ensurePoseTexture(
  scene: Phaser.Scene,
  key: string,
  draw: (g: Phaser.GameObjects.Graphics) => void,
  w: number,
  h: number,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function templeRunnerTextureKey(
  runFrame: number,
  pose: TempleRunnerPose,
  runKeys: readonly string[],
): string {
  const atlasPrefix = `temple-runner-${RUNNER_ATLAS_VERSION}`;
  const procPrefix = `temple-runner-${RUNNER_VERSION}`;
  const prefix = runKeys[0]?.startsWith(TEMPLE_RUNNER_ATLAS_KEY) ? atlasPrefix : procPrefix;
  if (pose === "jump") return `${prefix}-jump`;
  if (pose === "slide") return `${prefix}-slide`;
  if (pose === "leanL") return `${prefix}-lean-l`;
  if (pose === "leanR") return `${prefix}-lean-r`;
  return runKeys[runFrame % runKeys.length] ?? runKeys[0] ?? `${procPrefix}-f0`;
}

function drawRunnerFrame(
  g: Phaser.GameObjects.Graphics,
  frame: number,
  jumpLift = 0,
  lean = 0,
) {
  const cx = 38;
  const phase = (frame / RUNNER_FRAME_COUNT) * Math.PI * 2;
  const legL = Math.sin(phase) * 14;
  const legR = Math.sin(phase + Math.PI) * 14;
  const arm = Math.sin(phase) * 8;
  const ox = lean * 22;
  const oy = -jumpLift * 17;

  g.fillStyle(0x000000, 0.32);
  g.fillEllipse(cx + ox, 88 + oy, 30, 11);

  g.fillStyle(0x1c1917, 1);
  g.fillRoundedRect(17 + legL * 0.42 + ox, 66 + oy, 13, 9, 3);
  g.fillRoundedRect(43 + legR * 0.42 + ox, 66 + oy, 13, 9, 3);
  g.fillStyle(0x57534e, 0.85);
  g.fillRect(18 + legL * 0.42 + ox, 72 + oy, 11, 2);
  g.fillRect(44 + legR * 0.42 + ox, 72 + oy, 11, 2);

  g.fillStyle(0x92400e, 1);
  g.fillRoundedRect(19 + legL * 0.36 + ox, 50 + oy, 12, 22, 4);
  g.fillRoundedRect(43 + legR * 0.36 + ox, 50 + oy, 12, 22, 4);
  g.fillStyle(0xa16207, 0.55);
  g.fillRoundedRect(20 + legL * 0.36 + ox, 58 + oy, 10, 8, 2);
  g.fillRoundedRect(44 + legR * 0.36 + ox, 58 + oy, 10, 8, 2);

  g.fillStyle(0x14532d, 1);
  g.fillRoundedRect(21 + ox, 33 + oy, 24, 26, 6);
  g.fillStyle(0x166534, 0.95);
  g.fillRect(25 + ox, 38 + oy, 3, 17);
  g.fillRect(38 + ox, 38 + oy, 3, 17);
  g.fillStyle(0xfbbf24, 0.9);
  g.fillCircle(34 + ox, 46 + oy, 3.5);
  g.fillStyle(0x78350f, 0.9);
  g.fillRoundedRect(27 + ox, 52 + oy, 14, 8, 3);

  g.fillStyle(0xf5f5f4, 1);
  g.fillRoundedRect(18 + ox, 31 + oy, 32, 24, 7);
  g.fillStyle(0xe7e5e4, 0.65);
  g.fillRoundedRect(21 + ox, 35 + oy, 11, 15, 3);
  g.fillStyle(0x78350f, 1);
  g.fillRect(20 + ox, 52 + oy, 28, 4);
  g.fillStyle(0xfbbf24, 1);
  g.fillCircle(34 + ox, 54 + oy, 2.2);

  g.fillStyle(0xdc2626, 0.95);
  g.beginPath();
  g.moveTo(44 + ox, 28 + oy);
  g.lineTo(58 + ox + Math.sin(phase) * 5, 40 + oy + arm * 0.35);
  g.lineTo(48 + ox, 36 + oy);
  g.closePath();
  g.fillPath();

  g.fillStyle(0xffedd5, 1);
  g.fillCircle(38 + ox, 19 + oy, 14);
  g.fillStyle(0xc2410c, 1);
  g.fillEllipse(38 + ox, 11 + oy, 17, 11);
  g.fillStyle(0x78350f, 1);
  g.fillEllipse(38 + ox, 14 + oy, 20, 5);
  g.fillStyle(0x1c1917, 1);
  g.fillCircle(33 + ox, 18 + oy, 2.2);
  g.fillCircle(43 + ox, 18 + oy, 2.2);
  g.fillStyle(0xffffff, 0.35);
  g.fillCircle(34 + ox, 17 + oy, 0.8);

  g.fillStyle(0xffedd5, 1);
  g.fillRoundedRect(4 + arm + ox, 33 + oy, 11, 21, 4);
  g.fillRoundedRect(55 - arm + ox, 33 + oy, 11, 21, 4);
  g.fillStyle(0xf5f5f4, 1);
  g.fillRoundedRect(6 + arm + ox, 35 + oy, 8, 11, 2);
  g.fillRoundedRect(57 - arm + ox, 35 + oy, 8, 11, 2);

  const torchX = 62 - arm * 0.4 + ox;
  const torchY = 42 + oy;
  g.fillStyle(0x57534e, 1);
  g.fillRect(torchX - 2, torchY, 4, 14);
  g.fillStyle(0xfbbf24, 0.95);
  g.fillCircle(torchX, torchY - 4, 5);
  g.fillStyle(0xf97316, 0.85);
  g.fillCircle(torchX + 1, torchY - 6, 3.5);
  g.fillStyle(0xfef08a, 0.7);
  g.fillCircle(torchX - 1, torchY - 5, 2);
}

function drawRunnerJump(g: Phaser.GameObjects.Graphics) {
  drawRunnerFrame(g, 4, 1, 0);
  g.lineStyle(3, 0xfbbf24, 0.45);
  g.lineBetween(12, 82, 66, 82);
}

function drawRunnerSlide(g: Phaser.GameObjects.Graphics) {
  g.fillStyle(0x000000, 0.32);
  g.fillEllipse(38, 82, 36, 10);
  g.fillStyle(0x92400e, 1);
  g.fillRoundedRect(10, 68, 44, 12, 4);
  g.fillStyle(0x14532d, 1);
  g.fillRoundedRect(16, 52, 26, 20, 5);
  g.fillStyle(0xf5f5f4, 1);
  g.fillRoundedRect(18, 54, 22, 13, 4);
  g.fillStyle(0xffedd5, 1);
  g.fillCircle(58, 50, 12);
  g.fillStyle(0x78350e, 1);
  g.fillEllipse(58, 43, 14, 8);
  g.fillStyle(0xdc2626, 0.9);
  g.fillTriangle(62, 54, 70, 58, 62, 62);
  g.fillStyle(0xfbbf24, 0.9);
  g.fillCircle(8, 58, 4);
  g.fillStyle(0xf97316, 0.75);
  g.fillCircle(9, 55, 2.5);
}

export function drawTempleSkyAndArch(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  sample: TemplePathSample,
): void {
  gfx.fillGradientStyle(0x1e3a5f, 0x1e3a5f, 0x14532d, 0x422006, 1);
  gfx.fillRect(0, 0, w, h);

  const horizonY = h * 0.34;
  gfx.fillGradientStyle(0x166534, 0x166534, 0x052e16, 0x052e16, 0.35, 0.35, 0.55, 0.55);
  gfx.fillRect(0, horizonY - 8, w, h * 0.1);

  for (let i = 0; i < 5; i += 1) {
    const x = w * (0.08 + i * 0.21);
    const treeH = h * (0.08 + (i % 3) * 0.02);
    gfx.fillStyle(0x052e16, 0.28);
    gfx.fillTriangle(x - 40, horizonY, x + 20, horizonY - treeH, x + 80, horizonY);
  }

  const archW = 150 + sample.depth * 30;
  const archH = 96;
  const ax = sample.vanishX;
  const ay = horizonY - archH * 0.5;
  gfx.fillStyle(0x57534e, 0.88);
  gfx.fillRoundedRect(ax - archW / 2, ay, archW, archH, 12);
  gfx.fillStyle(0x292524, 0.92);
  gfx.fillRoundedRect(ax - archW * 0.2, ay + archH * 0.2, archW * 0.4, archH * 0.65, 8);
}

/** 跑道两侧远景残柱，增强纵深感 */
export function drawTempleSideRuins(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  curvePhase: number,
  playerLane: number,
): void {
  for (const side of [-1, 1] as const) {
    for (let i = 6; i >= 1; i -= 1) {
      const d = i / 6;
      const s = templePathSample(d * 0.92, w, h, curvePhase);
      const edgeX = templeLaneX(s, side * 1.88, playerLane);
      const colW = 10 + s.scale * 16;
      const colH = 28 + s.scale * 72;
      gfx.fillStyle(0x44403c, 0.22 + d * 0.45);
      gfx.fillRoundedRect(edgeX - colW / 2, s.y - colH, colW, colH, 4);
      if (d > 0.35) {
        gfx.fillStyle(0x166534, 0.35 + d * 0.2);
        gfx.fillTriangle(edgeX - colW, s.y - colH * 0.7, edgeX, s.y - colH - 10 * s.scale, edgeX + colW, s.y - colH * 0.65);
      }
    }
  }
}

/** 两侧垂坠藤蔓，随 scrollPhase 轻微摆动 */
export function drawTempleVinesParallax(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  curvePhase: number,
  scrollPhase: number,
): void {
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 5; i += 1) {
      const t = i / 4;
      const x = side < 0 ? w * (0.04 + t * 0.14) : w * (0.96 - t * 0.14);
      const sway = Math.sin(scrollPhase * 2 + i + curvePhase * 0.4) * (8 + t * 10);
      const top = h * (0.12 + t * 0.08);
      const len = h * (0.18 + t * 0.12);
      gfx.lineStyle(3, 0x166534, 0.22 + t * 0.1);
      gfx.lineBetween(x + sway, top, x - sway * 0.6, top + len);
      gfx.fillStyle(0x22c55e, 0.35);
      gfx.fillCircle(x + sway * 0.8, top + len * 0.55, 5 + t * 4);
    }
  }
}

/** 远景萤火虫/火花粒子 */
export function drawTempleFireflies(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  elapsed: number,
): void {
  for (let i = 0; i < 6; i += 1) {
    const seed = i * 1.618;
    const x = ((Math.sin(elapsed * 0.35 + seed) + 1) * 0.5 * 0.6 + 0.2) * w;
    const y = h * (0.16 + ((Math.cos(elapsed * 0.28 + seed * 2) + 1) * 0.5 * 0.16));
    const pulse = 0.25 + Math.sin(elapsed * 3 + seed) * 0.15;
    gfx.fillStyle(0xfbbf24, pulse * 0.35);
    gfx.fillCircle(x, y, 1.2 + pulse * 1.2);
  }
}

/** 当前车道柔光，提示玩家所在轨道 */
export function drawTempleLaneGlow(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  curvePhase: number,
  playerLane: number,
): void {
  for (let i = 10; i >= 3; i -= 1) {
    const d0 = i / 12;
    const d1 = (i + 1) / 12;
    const s0 = templePathSample(d0, w, h, curvePhase);
    const s1 = templePathSample(d1, w, h, curvePhase);
    const x0 = templeLaneX(s0, playerLane, playerLane);
    const x1 = templeLaneX(s1, playerLane, playerLane);
    const hw0 = s0.laneWidth * 0.22;
    const hw1 = s1.laneWidth * 0.22;
    gfx.fillStyle(0xfbbf24, 0.04 + d1 * 0.1);
    gfx.fillTriangle(x0 - hw0, s0.y, x0 + hw0, s0.y, x1 + hw1, s1.y);
    gfx.fillTriangle(x0 - hw0, s0.y, x1 + hw1, s1.y, x1 - hw1, s1.y);
  }
}

/** 金色夕阳 vignette，叠在 sky 最上层；danger 高时加红色压迫感 */
export function drawTempleSunVignette(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  danger = 0,
): void {
  const d = Phaser.Math.Clamp(danger, 0, 1);
  gfx.fillGradientStyle(0xf59e0b, 0xf59e0b, 0x000000, 0x000000, 0.08, 0.04, 0, 0.28 + d * 0.1);
  gfx.fillRect(0, 0, w, h);
  gfx.fillStyle(0xfbbf24, 0.06);
  gfx.fillCircle(w * 0.78, h * 0.1, w * 0.08);
  if (d > 0.15) {
    gfx.fillStyle(0x7f1d1d, d * 0.1);
    gfx.fillRect(0, h * 0.78, w, h * 0.22);
  }
}

/** 追兵逼近条（0–1） */
export function drawTempleRunnerShadow(
  gfx: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  scale: number,
  jumpT: number,
): void {
  const squash = 1 - jumpT * 0.45;
  const alpha = 0.22 + squash * 0.18;
  gfx.fillStyle(0x0c0a09, alpha);
  gfx.fillEllipse(cx, cy + 6 * scale, 34 * scale * squash, 9 * scale * squash);
}

/** 远处障碍预警：车道色带 + 动作提示 */
export function drawTempleObstacleTelegraph(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  curvePhase: number,
  playerLane: number,
  lane: number,
  kind: "rock" | "pillar" | "beam",
  depth: number,
): void {
  if (depth < 0.38 || depth > 0.55) return;
  const sample = templePathSample(depth, w, h, curvePhase);
  const cx = templeLaneX(sample, lane, playerLane);
  const pulse = 0.45 + Math.sin(depth * 18) * 0.2;
  const color = kind === "rock" ? 0xef4444 : kind === "pillar" ? 0xf59e0b : 0x38bdf8;
  gfx.fillStyle(color, 0.08 * pulse);
  gfx.fillTriangle(
    cx - sample.laneWidth * 0.22,
    sample.y,
    cx + sample.laneWidth * 0.22,
    sample.y,
    cx,
    sample.y - 18 * sample.scale,
  );
  gfx.lineStyle(2, color, 0.35 * pulse);
  const iconY = sample.y - 10 * sample.scale;
  if (kind === "rock") {
    gfx.lineBetween(cx, iconY - 8 * sample.scale, cx, iconY + 2 * sample.scale);
    gfx.lineBetween(cx - 5 * sample.scale, iconY - 2 * sample.scale, cx, iconY - 8 * sample.scale);
    gfx.lineBetween(cx + 5 * sample.scale, iconY - 2 * sample.scale, cx, iconY - 8 * sample.scale);
  } else if (kind === "pillar") {
    gfx.lineBetween(cx - 6 * sample.scale, iconY, cx + 6 * sample.scale, iconY);
    gfx.lineBetween(cx, iconY, cx, iconY - 10 * sample.scale);
  } else {
    gfx.lineBetween(cx - 7 * sample.scale, iconY - 4 * sample.scale, cx + 7 * sample.scale, iconY - 4 * sample.scale);
    gfx.lineBetween(cx, iconY + 2 * sample.scale, cx, iconY - 6 * sample.scale);
  }
}

/** 金币连击徽章（streak≥2 显示） */
export function drawTempleComboBadge(
  gfx: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  streak: number,
  pulse: number,
  zh: boolean,
): void {
  if (streak < 2) return;
  const tier = streak >= 8 ? 3 : streak >= 5 ? 2 : 1;
  const s = 1 + pulse * 0.1;
  const pw = (zh ? 78 : 86) * s;
  const ph = 26 * s;
  const colors = [0xfcd34d, 0xf97316, 0xef4444];
  const color = colors[tier - 1]!;
  gfx.fillStyle(0x292524, 0.9);
  gfx.fillRoundedRect(cx - pw / 2, y, pw, ph, 7);
  gfx.lineStyle(2, color, 0.8);
  gfx.strokeRoundedRect(cx - pw / 2, y, pw, ph, 7);
  gfx.fillStyle(color, 0.2);
  gfx.fillRoundedRect(cx - pw / 2 + 3, y + 3, pw - 6, ph * 0.42, 4);
}

/** 死亡遮罩：压低远景，保留下方跑者区域 */
export function drawTempleDeathDim(gfx: Phaser.GameObjects.Graphics, w: number, h: number): void {
  gfx.fillStyle(0x0f172a, 0.42);
  gfx.fillRect(0, 0, w, h * 0.48);
  gfx.fillStyle(0x0f172a, 0.12);
  gfx.fillRect(0, h * 0.48, w, h * 0.22);
}

export function drawTempleChaserMeter(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  barW: number,
  pressure: number,
): void {
  const p = Phaser.Math.Clamp(pressure, 0, 1);
  gfx.fillStyle(0x292524, 0.78);
  gfx.fillRoundedRect(x, y, barW, 9, 4);
  const color = p > 0.72 ? 0xef4444 : p > 0.42 ? 0xf59e0b : 0x22c55e;
  gfx.fillStyle(color, 0.92);
  if (p > 0.02) gfx.fillRoundedRect(x, y, barW * p, 9, 4);
  gfx.lineStyle(1, 0xffffff, 0.18);
  gfx.strokeRoundedRect(x, y, barW, 9, 4);
  gfx.fillStyle(0xfbbf24, 0.85);
  gfx.fillCircle(x - 8, y + 4.5, 4);
}

/** 弯道 QTE：车道侧箭头，避免与跑者/HUD 重叠 */
export function drawTempleTurnPrompt(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  dir: -1 | 1,
  ttl: number,
  maxTtl: number,
): void {
  const urgent = ttl < maxTtl * 0.35;
  const pulse = 0.55 + (1 - ttl / maxTtl) * 0.45;
  const cx = w / 2 + dir * w * 0.34;
  const cy = h * 0.27;
  gfx.fillStyle(urgent ? 0x450a0a : 0x0f172a, (urgent ? 0.78 : 0.62) * pulse);
  gfx.fillRoundedRect(cx - 34, cy - 22, 68, 44, 12);
  gfx.lineStyle(3, urgent ? 0xef4444 : 0x38bdf8, 0.9 * pulse);
  const tipX = cx + dir * 18;
  gfx.lineBetween(cx - dir * 8, cy, tipX, cy);
  gfx.lineBetween(tipX, cy, tipX - dir * 12, cy - 11);
  gfx.lineBetween(tipX, cy, tipX - dir * 12, cy + 11);
}

export type TempleDustPuff = { x: number; y: number; r: number; alpha: number; vy: number };

export function spawnTempleDustPuff(x: number, y: number, rng: () => number): TempleDustPuff {
  return {
    x: x + (rng() - 0.5) * 18,
    y: y + 8 + rng() * 6,
    r: 3 + rng() * 7,
    alpha: 0.35 + rng() * 0.25,
    vy: 18 + rng() * 32,
  };
}

export function updateTempleDustPuffs(puffs: TempleDustPuff[], dt: number): void {
  for (let i = puffs.length - 1; i >= 0; i -= 1) {
    const p = puffs[i]!;
    p.y += p.vy * dt;
    p.alpha -= dt * 1.6;
    p.r += dt * 6;
    if (p.alpha <= 0) puffs.splice(i, 1);
  }
}

export function drawTempleDustPuffs(gfx: Phaser.GameObjects.Graphics, puffs: TempleDustPuff[]): void {
  for (const p of puffs) {
    gfx.fillStyle(0xd6d3d1, p.alpha);
    gfx.fillCircle(p.x, p.y, p.r);
  }
}

export function drawTempleRoad(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  curvePhase: number,
  playerLane: number,
  scrollPhase: number,
): void {
  drawTempleWaterMoat(gfx, w, h, curvePhase, playerLane);
  const slices = 28;
  for (let i = slices - 1; i >= 0; i -= 1) {
    const d0 = i / slices;
    const d1 = (i + 1) / slices;
    const s0 = templePathSample(d0, w, h, curvePhase);
    const s1 = templePathSample(d1, w, h, curvePhase);

    for (let lane = -1; lane <= 1; lane += 1) {
      const x0 = templeLaneX(s0, lane, playerLane);
      const x1 = templeLaneX(s1, lane, playerLane);
      const hw0 = s0.laneWidth * 0.26;
      const hw1 = s1.laneWidth * 0.26;

      const stone = (Math.floor(i + scrollPhase * 4 + lane + 3) % 2) === 0 ? 0xb45309 : 0x92400e;
      gfx.fillStyle(stone, 0.9 + d1 * 0.08);
      gfx.fillTriangle(x0 - hw0, s0.y, x0 + hw0, s0.y, x1 + hw1, s1.y);
      gfx.fillTriangle(x0 - hw0, s0.y, x1 + hw1, s1.y, x1 - hw1, s1.y);

      gfx.lineStyle(1, 0xfcd34d, 0.12 + d1 * 0.2);
      gfx.strokeTriangle(x0 - hw0, s0.y, x0 + hw0, s0.y, x1 + hw1, s1.y);
      gfx.strokeTriangle(x0 - hw0, s0.y, x1 + hw1, s1.y, x1 - hw1, s1.y);
    }

    gfx.lineStyle(2, 0xfcd34d, 0.28 + d1 * 0.25);
    const lx0 = templeLaneX(s0, -1, playerLane) - s0.laneWidth * 0.26;
    const lx1 = templeLaneX(s1, -1, playerLane) - s1.laneWidth * 0.26;
    const rx0 = templeLaneX(s0, 1, playerLane) + s0.laneWidth * 0.26;
    const rx1 = templeLaneX(s1, 1, playerLane) + s1.laneWidth * 0.26;
    gfx.lineBetween(lx0, s0.y, lx1, s1.y);
    gfx.lineBetween(rx0, s0.y, rx1, s1.y);
  }
}

/** 车道虚线：随 scrollPhase 滚动，增强透视速度感 */
export function drawTempleLaneDashes(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  curvePhase: number,
  playerLane: number,
  scrollPhase: number,
): void {
  for (const boundary of [-0.5, 0.5] as const) {
    for (let i = 14; i >= 2; i -= 1) {
      const d = i / 14;
      const phase = (i + Math.floor(scrollPhase * 6)) % 3;
      if (phase === 0) continue;
      const s = templePathSample(d, w, h, curvePhase);
      const x = templeLaneX(s, boundary, playerLane);
      const dashH = 4 + s.scale * 10;
      const dashW = 2 + s.scale * 3;
      gfx.fillStyle(0xfef3c7, 0.22 + d * 0.18);
      gfx.fillRect(x - dashW / 2, s.y - dashH, dashW, dashH);
    }
  }
}

/** 跑道两侧暗水/深渊，增强 Temple Run 桥体感 */
export function drawTempleWaterMoat(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  curvePhase: number,
  playerLane: number,
): void {
  const slices = 20;
  for (let i = slices - 1; i >= 0; i -= 1) {
    const d0 = i / slices;
    const d1 = (i + 1) / slices;
    const s0 = templePathSample(d0, w, h, curvePhase);
    const s1 = templePathSample(d1, w, h, curvePhase);
    for (const side of [-1, 1] as const) {
      const edge0 = templeLaneX(s0, side * 1.32, playerLane) + side * s0.laneWidth * 0.34;
      const edge1 = templeLaneX(s1, side * 1.32, playerLane) + side * s1.laneWidth * 0.34;
      const outer0 = edge0 + side * (w * 0.22);
      const outer1 = edge1 + side * (w * 0.22);
      gfx.fillStyle(0x0f766e, 0.35 + d1 * 0.35);
      gfx.fillTriangle(edge0, s0.y, outer0, s0.y, outer1, s1.y);
      gfx.fillTriangle(edge0, s0.y, outer1, s1.y, edge1, s1.y);
    }
  }
}

export function drawTempleScorePanel(
  gfx: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  _score: number,
  pulse: number,
): void {
  const s = 1 + pulse * 0.05;
  const pw = 96 * s;
  const ph = 34 * s;
  gfx.fillStyle(0x292524, 0.9);
  gfx.fillRoundedRect(cx - pw / 2, y, pw, ph, 9);
  gfx.lineStyle(2, 0xfbbf24, 0.55);
  gfx.strokeRoundedRect(cx - pw / 2, y, pw, ph, 9);
}

export function drawTempleRailings(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  curvePhase: number,
  playerLane: number,
): void {
  for (const side of [-1, 1] as const) {
    for (let i = 8; i >= 1; i -= 1) {
      const d = i / 8;
      const s = templePathSample(d, w, h, curvePhase);
      const edgeX = templeLaneX(s, side * 1.18, playerLane);
      const postH = 8 + s.scale * 22;
      gfx.fillStyle(0x44403c, 0.55 + d * 0.35);
      gfx.fillRect(edgeX - 3 * s.scale, s.y - postH, 6 * s.scale, postH);
    }
  }
}

export function drawTempleObstacleGfx(
  gfx: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  ow: number,
  oh: number,
  depth: number,
  kind: "rock" | "pillar" | "beam",
): void {
  if (kind === "rock") {
    gfx.lineStyle(3, 0xef4444, 0.75 + depth * 0.2);
    gfx.strokeCircle(cx, y + oh * 0.5, Math.max(14, ow * 0.5));
    gfx.fillStyle(0x78716c, 0.88 + depth * 0.1);
    gfx.fillCircle(cx, y + oh * 0.5, Math.max(13, ow * 0.46));
    gfx.fillStyle(0xe7e5e4, 0.55);
    gfx.fillCircle(cx - ow * 0.14, y + oh * 0.28, Math.max(5, ow * 0.14));
    return;
  }
  if (kind === "pillar") {
    gfx.fillStyle(0x78350f, 0.92);
    gfx.fillRoundedRect(cx - ow / 2, y + oh * 0.42, ow, oh * 0.65, 5);
    gfx.fillStyle(0xf59e0b, 0.65);
    gfx.fillRect(cx - ow * 0.4, y + oh * 0.5, ow * 0.8, 5);
    return;
  }
  const postW = Math.max(7, ow * 0.13);
  const barY = y + oh * 0.1;
  gfx.fillStyle(0x78350f, 0.92);
  gfx.fillRect(cx - ow * 0.44, barY, postW, oh * 1.25);
  gfx.fillRect(cx + ow * 0.44 - postW, barY, postW, oh * 1.25);
  gfx.fillStyle(0xf59e0b, 0.8);
  gfx.fillRect(cx - ow * 0.46, barY, ow * 0.92, oh * 0.38);
}

export function drawTempleCoinGfx(
  gfx: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  scale: number,
  spinPhase = 0,
): void {
  const r = 11 * scale;
  const wobble = Math.sin(spinPhase * 6) * r * 0.12;
  gfx.fillStyle(0xfbbf24, 0.35);
  gfx.fillCircle(cx, y + r * 0.55, r * 1.08);
  gfx.fillStyle(0xfcd34d, 1);
  gfx.beginPath();
  gfx.moveTo(cx + wobble, y - r);
  gfx.lineTo(cx + r * 0.78 + wobble * 0.5, y);
  gfx.lineTo(cx + wobble, y + r);
  gfx.lineTo(cx - r * 0.78 + wobble * 0.5, y);
  gfx.closePath();
  gfx.fillPath();
  gfx.fillStyle(0xf59e0b, 0.85);
  gfx.fillCircle(cx - r * 0.2 + wobble, y - r * 0.15, r * 0.22);
}

export function drawTempleChasers(
  gfx: Phaser.GameObjects.Graphics,
  cx: number,
  baseY: number,
  animPhase: number,
  pressure = 0,
): void {
  const creep = Phaser.Math.Clamp(pressure, 0, 1) * 38;
  const chaseY = baseY + 8 - creep;
  for (let i = 2; i >= 0; i -= 1) {
    const ox = (i - 1) * (30 - pressure * 5) + Math.sin(animPhase * (3.2 + pressure) + i) * (4 + pressure * 3);
    const by = chaseY + i * (4 - pressure);
    const scale = 0.88 - i * 0.07;
    const bodyR = (15 - i * 2) * scale;
    const reach = Math.sin(animPhase * 4 + i) * 5;

    gfx.fillStyle(0x1c1917, 0.78 - i * 0.1);
    gfx.fillEllipse(cx + ox, by + 5, bodyR * 1.1, bodyR * 0.75);
    gfx.fillCircle(cx + ox, by - bodyR * 0.52, bodyR * 0.66);

    gfx.fillStyle(0x292524, 0.88);
    gfx.fillRoundedRect(cx + ox - bodyR * 0.9 + reach, by - 2, bodyR * 0.5, bodyR * 0.26, 4);
    gfx.fillRoundedRect(cx + ox + bodyR * 0.32 - reach, by - 2, bodyR * 0.5, bodyR * 0.26, 4);

    gfx.fillStyle(0xfbbf24, 0.9);
    gfx.fillCircle(cx + ox - 6, by - bodyR * 0.58, 3);
    gfx.fillCircle(cx + ox + 2, by - bodyR * 0.58, 3);
    gfx.fillStyle(0x0f172a, 1);
    gfx.fillCircle(cx + ox - 6, by - bodyR * 0.6, 1.4);
    gfx.fillCircle(cx + ox + 2, by - bodyR * 0.6, 1.4);
  }
}

export function drawTempleCoinHud(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
): void {
  const s = scale;
  gfx.fillStyle(0x292524, 0.88);
  gfx.fillRoundedRect(x - 78 * s, y, 74 * s, 30 * s, 8 * s);
  gfx.lineStyle(2, 0xfbbf24, 0.5);
  gfx.strokeRoundedRect(x - 78 * s, y, 74 * s, 30 * s, 8 * s);
  drawTempleCoinGfx(gfx, x - 58 * s, y + 14 * s, 0.72 * s);
}

export type TempleSpeedLine = { x: number; y: number; len: number; speed: number; alpha: number };

export function spawnTempleSpeedLine(w: number, h: number, rng: () => number): TempleSpeedLine {
  const depth = 0.15 + rng() * 0.75;
  const x = w * (0.2 + rng() * 0.6);
  const y = h * 0.36 + (h * 0.58) * depth;
  return { x, y, len: 12 + depth * 38, speed: 120 + depth * 280, alpha: 0.08 + depth * 0.22 };
}

export function updateTempleSpeedLines(lines: TempleSpeedLine[], dt: number, h: number): void {
  for (const line of lines) {
    line.y += line.speed * dt;
    if (line.y > h - 40) {
      line.y = h * 0.34;
    }
  }
}

export function drawTempleSpeedLines(
  gfx: Phaser.GameObjects.Graphics,
  lines: TempleSpeedLine[],
  vanishX: number,
): void {
  for (const line of lines) {
    gfx.lineStyle(1.5, 0xfef3c7, line.alpha * 0.45);
    const dx = (line.x - vanishX) * 0.08;
    gfx.lineBetween(line.x, line.y, line.x + dx, line.y + line.len);
  }
}
