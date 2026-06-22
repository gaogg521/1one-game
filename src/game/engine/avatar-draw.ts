/**
 * 通用人物头像绘制工具 —— 棋牌类 Scene 共用。
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
 * 小头像（棋类场景通用）：圆形身体 + 肤色脸 + 五官。
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

  g.fillStyle(style.bodyColor, 0.85);
  g.fillCircle(x, y + 4, r);
  g.fillStyle(skin, 1.0);
  g.fillCircle(x, y - r * 0.6, r * 0.6);
  g.fillStyle(eye, 1.0);
  const eyeR = Math.max(1.5, r * 0.1);
  g.fillCircle(x - r * 0.2, y - r * 0.65, eyeR);
  g.fillCircle(x + r * 0.2, y - r * 0.65, eyeR);
  g.lineStyle(Math.max(1, r * 0.08), mouth, 1.0);
  g.beginPath();
  g.moveTo(x - r * 0.2, y - r * 0.35);
  g.lineTo(x, y - r * 0.25);
  g.lineTo(x + r * 0.2, y - r * 0.35);
  g.strokePath();
  g.lineStyle(2, 0xffffff, 0.3);
  g.strokeCircle(x, y + 4, r);
  g.setDepth(style.depth ?? 11);
  return g;
}

// ─────────────────────────────────────────────────────────────
// QQ 斗地主风格全身卡通人物
// ─────────────────────────────────────────────────────────────

export type QqCharacterType = "girl" | "man" | "elder";

/**
 * 画 QQ 斗地主风格全身卡通角色。
 * cx/cy = 角色中心 x，底部脚 y。
 * scale = 整体缩放（默认 1，约 120px 高）。
 */
export function drawQqCharacter(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  type: QqCharacterType,
  opts: { scale?: number; depth?: number } = {},
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const sc = opts.scale ?? 1;
  const depth = opts.depth ?? 12;
  g.setDepth(depth);

  const s = (v: number) => v * sc;

  // 底部 y 为脚底，向上构建身体
  const footY = cy;
  const bodyH = s(60);   // 身体高度
  const bodyW = s(40);   // 身体宽度
  const headR = s(24);   // 头半径
  const bodyTop = footY - bodyH;
  const headCY = bodyTop - headR * 0.6; // 头中心 y

  if (type === "girl") {
    _drawGirl(g, cx, footY, headCY, headR, bodyW, bodyH, s);
  } else if (type === "man") {
    _drawMan(g, cx, footY, headCY, headR, bodyW, bodyH, s);
  } else {
    _drawElder(g, cx, footY, headCY, headR, bodyW, bodyH, s);
  }

  return g;
}

// ── 可爱女孩（玩家左侧 AI）──────────────────────────────────
function _drawGirl(
  g: Phaser.GameObjects.Graphics,
  cx: number, footY: number, headCY: number,
  headR: number, bodyW: number, bodyH: number,
  s: (v: number) => number,
) {
  const skin = 0xfde8c8;
  const hairColor = 0x5c2d0e;
  const dressColor = 0xe91e8c;   // 亮粉红
  const dressLight = 0xf472b6;   // 粉红高光
  const collarColor = 0xffffff;
  const shoeColor = 0xb91c1c;
  const blushColor = 0xfca5a5;
  const eyeWhite = 0xffffff;
  const eyeDark = 0x1a1a2e;
  const eyeShine = 0xffffff;
  const mouthColor = 0xdc2626;
  const bodyTop = footY - bodyH;

  // 阴影（软）
  g.fillStyle(0x000000, 0.12);
  g.fillEllipse(cx, footY + s(4), bodyW * 1.1, s(12));

  // 裙子身体（梯形效果用矩形+扇形）
  g.fillStyle(dressColor, 1);
  g.fillRoundedRect(cx - bodyW * 0.5, bodyTop, bodyW, bodyH * 0.55, s(6));
  // 裙摆（扇形扩展）
  g.fillStyle(dressColor, 1);
  g.fillTriangle(
    cx - bodyW * 0.5, bodyTop + bodyH * 0.4,
    cx + bodyW * 0.5, bodyTop + bodyH * 0.4,
    cx + bodyW * 0.7, footY - s(8),
  );
  g.fillTriangle(
    cx - bodyW * 0.5, bodyTop + bodyH * 0.4,
    cx - bodyW * 0.7, footY - s(8),
    cx + bodyW * 0.5, bodyTop + bodyH * 0.4,
  );
  g.fillRoundedRect(cx - bodyW * 0.7, footY - s(20), bodyW * 1.4, s(14), s(4));

  // 裙子高光条
  g.fillStyle(dressLight, 0.5);
  g.fillRoundedRect(cx - bodyW * 0.3, bodyTop + s(4), bodyW * 0.15, bodyH * 0.3, s(3));

  // 领子白
  g.fillStyle(collarColor, 1);
  g.fillRoundedRect(cx - s(8), bodyTop - s(2), s(16), s(14), s(4));

  // 手臂（两侧）
  g.fillStyle(skin, 1);
  g.fillRoundedRect(cx - bodyW * 0.55 - s(8), bodyTop + s(4), s(10), bodyH * 0.38, s(5));
  g.fillRoundedRect(cx + bodyW * 0.55 - s(2), bodyTop + s(4), s(10), bodyH * 0.38, s(5));

  // 鞋子
  g.fillStyle(shoeColor, 1);
  g.fillEllipse(cx - s(10), footY, s(18), s(10));
  g.fillEllipse(cx + s(10), footY, s(18), s(10));

  // ── 头 ──
  // 头发（后层）
  g.fillStyle(hairColor, 1);
  g.fillCircle(cx, headCY, headR * 1.08);
  // 刘海
  g.fillStyle(hairColor, 1);
  g.fillRoundedRect(cx - headR * 0.9, headCY - headR * 0.9, headR * 1.8, headR * 0.6, s(4));

  // 双马尾
  g.fillStyle(hairColor, 1);
  g.fillCircle(cx - headR * 1.05, headCY - headR * 0.5, s(10));
  g.fillCircle(cx + headR * 1.05, headCY - headR * 0.5, s(10));
  // 发圈（红色）
  g.fillStyle(0xef4444, 1);
  g.fillCircle(cx - headR * 1.05, headCY - headR * 0.5, s(5));
  g.fillCircle(cx + headR * 1.05, headCY - headR * 0.5, s(5));

  // 脸（肤色）
  g.fillStyle(skin, 1);
  g.fillCircle(cx, headCY, headR);

  // 腮红
  g.fillStyle(blushColor, 0.7);
  g.fillCircle(cx - headR * 0.52, headCY + headR * 0.15, headR * 0.25);
  g.fillCircle(cx + headR * 0.52, headCY + headR * 0.15, headR * 0.25);

  // 眼睛（大眼）
  const eyeY = headCY - headR * 0.1;
  const eyeRx = headR * 0.22;
  const eyeRy = headR * 0.28;
  // 白眼
  g.fillStyle(eyeWhite, 1);
  g.fillEllipse(cx - headR * 0.35, eyeY, eyeRx * 2, eyeRy * 2);
  g.fillEllipse(cx + headR * 0.35, eyeY, eyeRx * 2, eyeRy * 2);
  // 黑瞳
  g.fillStyle(eyeDark, 1);
  g.fillEllipse(cx - headR * 0.35, eyeY + s(1), eyeRx * 1.2, eyeRy * 1.4);
  g.fillEllipse(cx + headR * 0.35, eyeY + s(1), eyeRx * 1.2, eyeRy * 1.4);
  // 眼神高光
  g.fillStyle(eyeShine, 1);
  g.fillCircle(cx - headR * 0.3, eyeY - s(2), s(3));
  g.fillCircle(cx + headR * 0.4, eyeY - s(2), s(3));

  // 眉毛
  g.lineStyle(s(1.8), hairColor, 1);
  g.beginPath();
  g.moveTo(cx - headR * 0.52, eyeY - eyeRy - s(3));
  g.lineTo(cx - headR * 0.18, eyeY - eyeRy - s(5));
  g.strokePath();
  g.beginPath();
  g.moveTo(cx + headR * 0.18, eyeY - eyeRy - s(5));
  g.lineTo(cx + headR * 0.52, eyeY - eyeRy - s(3));
  g.strokePath();

  // 嘴巴（W 形微笑）
  g.lineStyle(s(1.8), mouthColor, 1);
  g.beginPath();
  g.moveTo(cx - headR * 0.22, headCY + headR * 0.38);
  g.lineTo(cx, headCY + headR * 0.48);
  g.lineTo(cx + headR * 0.22, headCY + headR * 0.38);
  g.strokePath();
}

// ── 大叔（右侧 AI）──────────────────────────────────────────
function _drawMan(
  g: Phaser.GameObjects.Graphics,
  cx: number, footY: number, headCY: number,
  headR: number, bodyW: number, bodyH: number,
  s: (v: number) => number,
) {
  const skin = 0xf5d5a0;
  const shirtColor = 0xf0f4f8;   // 白色中式上衣
  const shirtShadow = 0xd1d5db;
  const beltColor = 0x1e293b;
  const hatColor = 0xf8fafc;
  const hatBrim = 0xe2e8f0;
  const shoeColor = 0x374151;
  const eyeDark = 0x1a1a2e;
  const mouthColor = 0x7c3f00;
  const beardColor = 0x4b3728;
  const blushColor = 0xfca5a5;
  const bodyTop = footY - bodyH;

  // 阴影
  g.fillStyle(0x000000, 0.12);
  g.fillEllipse(cx, footY + s(4), bodyW * 1.1, s(12));

  // 裤子/腿
  g.fillStyle(0x374151, 1);
  g.fillRoundedRect(cx - bodyW * 0.35, bodyTop + bodyH * 0.55, bodyW * 0.3, bodyH * 0.45, s(4));
  g.fillRoundedRect(cx + bodyW * 0.05, bodyTop + bodyH * 0.55, bodyW * 0.3, bodyH * 0.45, s(4));

  // 上衣身体
  g.fillStyle(shirtColor, 1);
  g.fillRoundedRect(cx - bodyW * 0.5, bodyTop, bodyW, bodyH * 0.6, s(6));
  // 上衣阴影细节（左领）
  g.fillStyle(shirtShadow, 0.6);
  g.fillRoundedRect(cx - bodyW * 0.1, bodyTop + s(4), bodyW * 0.2, bodyH * 0.35, s(3));

  // 腰带
  g.fillStyle(beltColor, 1);
  g.fillRoundedRect(cx - bodyW * 0.5, bodyTop + bodyH * 0.52, bodyW, s(7), s(2));

  // 手臂
  g.fillStyle(shirtColor, 1);
  g.fillRoundedRect(cx - bodyW * 0.58 - s(8), bodyTop + s(4), s(11), bodyH * 0.38, s(5));
  g.fillRoundedRect(cx + bodyW * 0.58 - s(3), bodyTop + s(4), s(11), bodyH * 0.38, s(5));
  // 手
  g.fillStyle(skin, 1);
  g.fillCircle(cx - bodyW * 0.6 - s(2), bodyTop + bodyH * 0.42, s(7));
  g.fillCircle(cx + bodyW * 0.6 + s(2), bodyTop + bodyH * 0.42, s(7));

  // 鞋子
  g.fillStyle(shoeColor, 1);
  g.fillEllipse(cx - s(10), footY, s(20), s(11));
  g.fillEllipse(cx + s(10), footY, s(20), s(11));

  // ── 头 ──
  // 白帽（高帽风格）
  g.fillStyle(hatColor, 1);
  g.fillRoundedRect(cx - headR * 0.7, headCY - headR * 1.2, headR * 1.4, headR * 0.9, s(4));
  // 帽檐
  g.fillStyle(hatBrim, 1);
  g.fillRoundedRect(cx - headR * 0.85, headCY - headR * 0.35, headR * 1.7, s(7), s(3));

  // 脸
  g.fillStyle(skin, 1);
  g.fillCircle(cx, headCY, headR);

  // 腮红（淡）
  g.fillStyle(blushColor, 0.4);
  g.fillCircle(cx - headR * 0.55, headCY + headR * 0.2, headR * 0.2);
  g.fillCircle(cx + headR * 0.55, headCY + headR * 0.2, headR * 0.2);

  // 眼睛（较小，眯眼）
  g.fillStyle(eyeDark, 1);
  g.fillEllipse(cx - headR * 0.32, headCY - headR * 0.08, headR * 0.28, headR * 0.2);
  g.fillEllipse(cx + headR * 0.32, headCY - headR * 0.08, headR * 0.28, headR * 0.2);
  // 眼神高光
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - headR * 0.27, headCY - headR * 0.12, s(2.5));
  g.fillCircle(cx + headR * 0.38, headCY - headR * 0.12, s(2.5));

  // 眉毛（浓粗）
  g.lineStyle(s(2.5), beardColor, 1);
  g.beginPath();
  g.moveTo(cx - headR * 0.5, headCY - headR * 0.3);
  g.lineTo(cx - headR * 0.14, headCY - headR * 0.35);
  g.strokePath();
  g.beginPath();
  g.moveTo(cx + headR * 0.14, headCY - headR * 0.35);
  g.lineTo(cx + headR * 0.5, headCY - headR * 0.3);
  g.strokePath();

  // 胡须（两撮）
  g.fillStyle(beardColor, 0.85);
  g.fillEllipse(cx - headR * 0.25, headCY + headR * 0.52, headR * 0.4, headR * 0.22);
  g.fillEllipse(cx + headR * 0.25, headCY + headR * 0.52, headR * 0.4, headR * 0.22);
  // 嘴下胡须
  g.fillEllipse(cx, headCY + headR * 0.62, headR * 0.5, headR * 0.18);

  // 嘴巴
  g.lineStyle(s(1.8), mouthColor, 1);
  g.beginPath();
  g.moveTo(cx - headR * 0.18, headCY + headR * 0.38);
  g.lineTo(cx, headCY + headR * 0.46);
  g.lineTo(cx + headR * 0.18, headCY + headR * 0.38);
  g.strokePath();
}

// ── 老者/财神（备用第三角色）────────────────────────────────
function _drawElder(
  g: Phaser.GameObjects.Graphics,
  cx: number, footY: number, headCY: number,
  headR: number, bodyW: number, bodyH: number,
  s: (v: number) => number,
) {
  // 暂用 man 实现（可后续扩展）
  _drawMan(g, cx, footY, headCY, headR, bodyW, bodyH, s);
}

/** 棋牌常用配色：玩家蓝 / AI 紫 / AI 粉 / AI 青 */
export const AVATAR_COLORS = {
  player: 0x0ea5e9,
  ai1: 0x7c3aed,
  ai2: 0xbe185d,
  ai3: 0x14b8a6,
} as const;
