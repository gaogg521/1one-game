/**
 * 通用人物头像绘制工具 —— 棋牌类 Scene 共用。
 * 用 Phaser Graphics 画带五官的人脸（肤色脸+身体+眼睛+嘴巴+描边），比纯几何形/emoji 更有人味。
 */
import Phaser from "phaser";

export type AvatarStyle = {
  bodyColor: number;
  skinColor?: number;
  eyeColor?: number;
  mouthColor?: number;
  radius?: number;
  depth?: number;
};

const DEFAULT_SKIN = 0xf5d9a4;
const DEFAULT_EYE = 0x1e293b;
const DEFAULT_MOUTH = 0x7c2d12;

/**
 * 在指定 scene 的 (x, y) 画一个带五官的人物头像，返回 Graphics 对象（调用方负责生命周期）。
 * 身体圆 + 肤色脸 + 两眼 + 嘴巴 + 身体描边。
 */
export function drawAvatar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  style: AvatarStyle,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const r = style.radius ?? 20;
  const skin = style.skinColor ?? DEFAULT_SKIN;
  const eye = style.eyeColor ?? DEFAULT_EYE;
  const mouth = style.mouthColor ?? DEFAULT_MOUTH;

  // 身体（圆）
  g.fillStyle(style.bodyColor, 0.85);
  g.fillCircle(x, y + 4, r);
  // 头（肤色）
  g.fillStyle(skin, 1.0);
  g.fillCircle(x, y - r * 0.6, r * 0.6);
  // 眼睛
  g.fillStyle(eye, 1.0);
  const eyeR = Math.max(1.5, r * 0.1);
  g.fillCircle(x - r * 0.2, y - r * 0.65, eyeR);
  g.fillCircle(x + r * 0.2, y - r * 0.65, eyeR);
  // 嘴巴
  g.lineStyle(Math.max(1, r * 0.08), mouth, 1.0);
  g.beginPath();
  g.moveTo(x - r * 0.2, y - r * 0.35);
  g.lineTo(x, y - r * 0.25);
  g.lineTo(x + r * 0.2, y - r * 0.35);
  g.strokePath();
  // 身体描边
  g.lineStyle(2, 0xffffff, 0.3);
  g.strokeCircle(x, y + 4, r);
  g.setDepth(style.depth ?? 11);
  return g;
}

/** 棋牌常用配色：玩家蓝 / AI 紫 / AI 粉 / AI 青 */
export const AVATAR_COLORS = {
  player: 0x0ea5e9,
  ai1: 0x7c3aed,
  ai2: 0xbe185d,
  ai3: 0x14b8a6,
} as const;
