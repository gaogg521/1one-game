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
// QQ 斗地主风格全身卡通人物（inline SVG 矢量版）
// ─────────────────────────────────────────────────────────────

export type QqCharacterType = "girl" | "man" | "elder";

// SVG viewBox: 0 0 100 150，脚底在 y≈147。
// width/height 设为 200×300（2x 渲染），setScale 时乘 0.5 以还原 1x 尺寸。

const GIRL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150" width="200" height="300">
  <ellipse cx="50" cy="147" rx="25" ry="5" fill="rgba(0,0,0,0.15)"/>
  <ellipse cx="40" cy="144" rx="13" ry="6" fill="#b91c1c"/>
  <ellipse cx="60" cy="144" rx="13" ry="6" fill="#b91c1c"/>
  <ellipse cx="38" cy="141" rx="5" ry="2.5" fill="#ef4444" opacity="0.5"/>
  <ellipse cx="58" cy="141" rx="5" ry="2.5" fill="#ef4444" opacity="0.5"/>
  <polygon points="29,100 71,100 78,142 22,142" fill="#e91e8c"/>
  <rect x="22" y="134" width="56" height="10" rx="4" fill="#c2185b"/>
  <polygon points="36,100 50,100 54,142 32,142" fill="#f06292" opacity="0.25"/>
  <rect x="33" y="76" width="34" height="30" rx="6" fill="#e91e8c"/>
  <rect x="37" y="79" width="8" height="20" rx="3" fill="#f48fb1" opacity="0.45"/>
  <polygon points="44,74 56,74 53,86 47,86" fill="white"/>
  <line x1="50" y1="74" x2="50" y2="86" stroke="#e0e0e0" stroke-width="0.8"/>
  <rect x="21" y="79" width="11" height="22" rx="5" fill="#fde8c8"/>
  <rect x="68" y="79" width="11" height="22" rx="5" fill="#fde8c8"/>
  <rect x="21" y="97" width="11" height="5" rx="2" fill="#c2185b"/>
  <rect x="68" y="97" width="11" height="5" rx="2" fill="#c2185b"/>
  <circle cx="26" cy="105" r="6" fill="#fde8c8"/>
  <circle cx="74" cy="105" r="6" fill="#fde8c8"/>
  <circle cx="50" cy="46" r="25" fill="#3d1a0a"/>
  <circle cx="24" cy="36" r="13" fill="#3d1a0a"/>
  <circle cx="76" cy="36" r="13" fill="#3d1a0a"/>
  <circle cx="24" cy="36" r="7" fill="#ef4444"/>
  <circle cx="76" cy="36" r="7" fill="#ef4444"/>
  <circle cx="22" cy="34" r="2" fill="#fca5a5" opacity="0.8"/>
  <circle cx="74" cy="34" r="2" fill="#fca5a5" opacity="0.8"/>
  <circle cx="50" cy="46" r="22" fill="#fde8c8"/>
  <rect x="30" y="26" width="40" height="14" rx="5" fill="#3d1a0a"/>
  <circle cx="30" cy="36" r="6" fill="#3d1a0a"/>
  <circle cx="70" cy="36" r="6" fill="#3d1a0a"/>
  <ellipse cx="37" cy="52" rx="8" ry="5" fill="#fca5a5" opacity="0.65"/>
  <ellipse cx="63" cy="52" rx="8" ry="5" fill="#fca5a5" opacity="0.65"/>
  <ellipse cx="41" cy="45" rx="7" ry="8.5" fill="white"/>
  <ellipse cx="41" cy="46" rx="5.5" ry="7" fill="#1565c0"/>
  <ellipse cx="41" cy="47" rx="3.5" ry="5" fill="#0d0d1a"/>
  <circle cx="43" cy="42.5" r="2.5" fill="white"/>
  <circle cx="39" cy="46" r="1.2" fill="white" opacity="0.6"/>
  <ellipse cx="59" cy="45" rx="7" ry="8.5" fill="white"/>
  <ellipse cx="59" cy="46" rx="5.5" ry="7" fill="#1565c0"/>
  <ellipse cx="59" cy="47" rx="3.5" ry="5" fill="#0d0d1a"/>
  <circle cx="61" cy="42.5" r="2.5" fill="white"/>
  <circle cx="57" cy="46" r="1.2" fill="white" opacity="0.6"/>
  <path d="M34,39 Q41,35 48,39" stroke="#0d0d1a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M52,39 Q59,35 66,39" stroke="#0d0d1a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M34,37 Q41,32 48,36" stroke="#3d1a0a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M52,36 Q59,32 66,37" stroke="#3d1a0a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="50" cy="54" rx="2" ry="1.5" fill="#e8b89a" opacity="0.7"/>
  <path d="M43,61 Q47,66 50,63 Q53,66 57,61" stroke="#c62828" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const MAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150" width="200" height="300">
  <ellipse cx="50" cy="147" rx="25" ry="5" fill="rgba(0,0,0,0.15)"/>
  <rect x="36" y="112" width="12" height="30" rx="4" fill="#1e293b"/>
  <rect x="52" y="112" width="12" height="30" rx="4" fill="#1e293b"/>
  <ellipse cx="42" cy="144" rx="14" ry="7" fill="#374151"/>
  <ellipse cx="58" cy="144" rx="14" ry="7" fill="#374151"/>
  <ellipse cx="39" cy="141" rx="5" ry="2.5" fill="#4b5563" opacity="0.6"/>
  <ellipse cx="55" cy="141" rx="5" ry="2.5" fill="#4b5563" opacity="0.6"/>
  <rect x="30" y="82" width="40" height="36" rx="6" fill="#f1f5f9"/>
  <line x1="50" y1="84" x2="50" y2="116" stroke="#cbd5e1" stroke-width="1.5"/>
  <polygon points="50,82 62,82 58,102 50,108" fill="#e2e8f0" opacity="0.7"/>
  <rect x="30" y="113" width="40" height="6" rx="2" fill="#0f172a"/>
  <rect x="45" y="114" width="10" height="4" rx="1" fill="#94a3b8"/>
  <rect x="18" y="85" width="11" height="26" rx="5" fill="#f1f5f9"/>
  <rect x="71" y="85" width="11" height="26" rx="5" fill="#f1f5f9"/>
  <circle cx="23" cy="113" r="7" fill="#f5d5a0"/>
  <circle cx="77" cy="113" r="7" fill="#f5d5a0"/>
  <rect x="36" y="32" width="28" height="22" rx="4" fill="#f8fafc"/>
  <rect x="36" y="50" width="28" height="4" rx="1" fill="#cbd5e1"/>
  <rect x="32" y="52" width="36" height="8" rx="3" fill="#e2e8f0"/>
  <circle cx="50" cy="66" r="21" fill="#f5d5a0"/>
  <circle cx="37" cy="70" r="6" fill="#fca5a5" opacity="0.3"/>
  <circle cx="63" cy="70" r="6" fill="#fca5a5" opacity="0.3"/>
  <ellipse cx="41" cy="63" rx="6.5" ry="5" fill="white"/>
  <ellipse cx="59" cy="63" rx="6.5" ry="5" fill="white"/>
  <ellipse cx="41" cy="64" rx="4.5" ry="3.5" fill="#0d0d1a"/>
  <ellipse cx="59" cy="64" rx="4.5" ry="3.5" fill="#0d0d1a"/>
  <circle cx="43" cy="62" r="2" fill="white"/>
  <circle cx="61" cy="62" r="2" fill="white"/>
  <path d="M34,55 L48,53" stroke="#3d2010" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M52,53 L66,55" stroke="#3d2010" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="50" cy="70" rx="2.5" ry="2" fill="#e8b89a" opacity="0.8"/>
  <ellipse cx="42" cy="77" rx="9" ry="5" fill="#4b3728" opacity="0.9"/>
  <ellipse cx="58" cy="77" rx="9" ry="5" fill="#4b3728" opacity="0.9"/>
  <ellipse cx="50" cy="83" rx="10" ry="4" fill="#4b3728" opacity="0.75"/>
  <path d="M44,74 Q50,78 56,74" stroke="#7c3f00" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg>`;

// 头像版（头部裁剪）：viewBox 只截取头部区域，加圆形 clip + 边框圈。
// 渲染尺寸 180×144（2x），setScale(0.5) 后逻辑尺寸 90×72。
const GIRL_HEAD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="5 16 90 72" width="180" height="144">
  <defs><clipPath id="ghc"><circle cx="50" cy="52" r="36"/></clipPath></defs>
  <circle cx="50" cy="52" r="36" fill="#fde8c8"/>
  <g clip-path="url(#ghc)">
    <g transform="translate(10 10.4) scale(0.80)">
      <circle cx="50" cy="46" r="25" fill="#3d1a0a"/>
      <circle cx="24" cy="36" r="13" fill="#3d1a0a"/>
      <circle cx="76" cy="36" r="13" fill="#3d1a0a"/>
      <circle cx="24" cy="36" r="7" fill="#ef4444"/>
      <circle cx="76" cy="36" r="7" fill="#ef4444"/>
      <circle cx="22" cy="34" r="2" fill="#fca5a5" opacity="0.8"/>
      <circle cx="74" cy="34" r="2" fill="#fca5a5" opacity="0.8"/>
      <circle cx="50" cy="46" r="22" fill="#fde8c8"/>
      <rect x="30" y="26" width="40" height="14" rx="5" fill="#3d1a0a"/>
      <circle cx="30" cy="36" r="6" fill="#3d1a0a"/>
      <circle cx="70" cy="36" r="6" fill="#3d1a0a"/>
      <ellipse cx="37" cy="52" rx="8" ry="5" fill="#fca5a5" opacity="0.65"/>
      <ellipse cx="63" cy="52" rx="8" ry="5" fill="#fca5a5" opacity="0.65"/>
      <ellipse cx="41" cy="45" rx="7" ry="8.5" fill="white"/>
      <ellipse cx="41" cy="46" rx="5.5" ry="7" fill="#1565c0"/>
      <ellipse cx="41" cy="47" rx="3.5" ry="5" fill="#0d0d1a"/>
      <circle cx="43" cy="42.5" r="2.5" fill="white"/>
      <circle cx="39" cy="46" r="1.2" fill="white" opacity="0.6"/>
      <ellipse cx="59" cy="45" rx="7" ry="8.5" fill="white"/>
      <ellipse cx="59" cy="46" rx="5.5" ry="7" fill="#1565c0"/>
      <ellipse cx="59" cy="47" rx="3.5" ry="5" fill="#0d0d1a"/>
      <circle cx="61" cy="42.5" r="2.5" fill="white"/>
      <circle cx="57" cy="46" r="1.2" fill="white" opacity="0.6"/>
      <path d="M34,39 Q41,35 48,39" stroke="#0d0d1a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M52,39 Q59,35 66,39" stroke="#0d0d1a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M34,37 Q41,32 48,36" stroke="#3d1a0a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M52,36 Q59,32 66,37" stroke="#3d1a0a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="50" cy="54" rx="2" ry="1.5" fill="#e8b89a" opacity="0.7"/>
      <path d="M43,61 Q47,66 50,63 Q53,66 57,61" stroke="#c62828" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <polygon points="44,74 56,74 53,88 47,88" fill="white"/>
      <polygon points="33,76 67,76 70,90 30,90" fill="#e91e8c"/>
    </g>
  </g>
  <circle cx="50" cy="52" r="36" fill="none" stroke="#e91e8c" stroke-width="3"/>
</svg>`;

const MAN_HEAD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="5 24 90 72" width="180" height="144">
  <defs><clipPath id="mhc"><circle cx="50" cy="60" r="36"/></clipPath></defs>
  <circle cx="50" cy="60" r="36" fill="#f5d5a0"/>
  <g clip-path="url(#mhc)">
    <g transform="translate(10 12) scale(0.80)">
      <rect x="36" y="32" width="28" height="22" rx="4" fill="#f8fafc"/>
      <rect x="36" y="50" width="28" height="4" rx="1" fill="#cbd5e1"/>
      <rect x="32" y="52" width="36" height="8" rx="3" fill="#e2e8f0"/>
      <circle cx="50" cy="66" r="21" fill="#f5d5a0"/>
      <circle cx="37" cy="70" r="6" fill="#fca5a5" opacity="0.3"/>
      <circle cx="63" cy="70" r="6" fill="#fca5a5" opacity="0.3"/>
      <ellipse cx="41" cy="63" rx="6.5" ry="5" fill="white"/>
      <ellipse cx="59" cy="63" rx="6.5" ry="5" fill="white"/>
      <ellipse cx="41" cy="64" rx="4.5" ry="3.5" fill="#0d0d1a"/>
      <ellipse cx="59" cy="64" rx="4.5" ry="3.5" fill="#0d0d1a"/>
      <circle cx="43" cy="62" r="2" fill="white"/>
      <circle cx="61" cy="62" r="2" fill="white"/>
      <path d="M34,55 L48,53" stroke="#3d2010" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M52,53 L66,55" stroke="#3d2010" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="50" cy="70" rx="2.5" ry="2" fill="#e8b89a" opacity="0.8"/>
      <ellipse cx="42" cy="77" rx="9" ry="5" fill="#4b3728" opacity="0.9"/>
      <ellipse cx="58" cy="77" rx="9" ry="5" fill="#4b3728" opacity="0.9"/>
      <ellipse cx="50" cy="83" rx="10" ry="4" fill="#4b3728" opacity="0.75"/>
      <path d="M44,74 Q50,78 56,74" stroke="#7c3f00" stroke-width="2" fill="none" stroke-linecap="round"/>
      <rect x="30" y="82" width="40" height="20" rx="4" fill="#f1f5f9"/>
      <line x1="50" y1="84" x2="50" y2="102" stroke="#cbd5e1" stroke-width="1.5"/>
    </g>
  </g>
  <circle cx="50" cy="60" r="36" fill="none" stroke="#0f172a" stroke-width="3"/>
</svg>`;

const SVG_MAP: Record<QqCharacterType, string> = {
  girl: GIRL_SVG,
  man: MAN_SVG,
  elder: MAN_SVG,
};

const HEAD_SVG_MAP: Record<QqCharacterType, string> = {
  girl: GIRL_HEAD_SVG,
  man: MAN_HEAD_SVG,
  elder: MAN_HEAD_SVG,
};

const TEX_KEY: Record<QqCharacterType, string> = {
  girl: "__qq_girl__",
  man: "__qq_man__",
  elder: "__qq_man__",
};

const HEAD_TEX_KEY: Record<QqCharacterType, string> = {
  girl: "__qq_girl_head__",
  man: "__qq_man_head__",
  elder: "__qq_man_head__",
};

/**
 * 在 Scene.preload() 里调用，把 SVG 注册为 Phaser 纹理。
 * 多次调用幂等（已存在则跳过）。
 */
export function preloadQqCharacterTextures(scene: Phaser.Scene): void {
  for (const type of ["girl", "man"] as QqCharacterType[]) {
    const key = TEX_KEY[type];
    if (!scene.textures.exists(key)) {
      scene.load.image(key, "data:image/svg+xml," + encodeURIComponent(SVG_MAP[type]!));
    }
    const hkey = HEAD_TEX_KEY[type];
    if (!scene.textures.exists(hkey)) {
      scene.load.image(hkey, "data:image/svg+xml," + encodeURIComponent(HEAD_SVG_MAP[type]!));
    }
  }
}

/**
 * 画 QQ 斗地主风格全身卡通角色（SVG 矢量版）。
 * cx/cy = 角色中心 x，底部脚 y。
 * 返回 Image（SVG 已预加载）或 Graphics（回退）。
 */
export function drawQqCharacter(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  type: QqCharacterType,
  opts: { scale?: number; depth?: number; headOnly?: boolean } = {},
): Phaser.GameObjects.Image | Phaser.GameObjects.Graphics {
  const sc = opts.scale ?? 1;
  const depth = opts.depth ?? 12;

  if (opts.headOnly) {
    // 头像版：180×144（2x），setScale(sc*0.5) → 逻辑 90×72，居中显示
    const hkey = HEAD_TEX_KEY[type];
    if (scene.textures.exists(hkey)) {
      const img = scene.add.image(cx, cy, hkey);
      img.setOrigin(0.5, 0.5);
      img.setScale(sc * 0.5);
      img.setDepth(depth);
      return img;
    }
  }

  const key = TEX_KEY[type];
  if (scene.textures.exists(key)) {
    // 全身版：200×300（2x），setScale(sc*0.5) → 逻辑 100×150，脚底对齐 cy
    const img = scene.add.image(cx, cy, key);
    img.setOrigin(0.5, 1);
    img.setScale(sc * 0.5);
    img.setDepth(depth);
    return img;
  }

  return _drawGraphicsFallback(scene, cx, cy, type, sc, depth);
}

function _drawGraphicsFallback(
  scene: Phaser.Scene,
  cx: number, cy: number,
  type: QqCharacterType,
  sc: number, depth: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.setDepth(depth);

  const s = (v: number) => v * sc;
  const footY = cy;
  const bodyH = s(60);
  const bodyW = s(40);
  const headR = s(24);
  const bodyTop = footY - bodyH;
  const headCY = bodyTop - headR * 0.6;

  if (type === "girl") {
    _drawGirl(g, cx, footY, headCY, headR, bodyW, bodyH, s);
  } else {
    _drawMan(g, cx, footY, headCY, headR, bodyW, bodyH, s);
  }
  return g;
}

// ── 可爱女孩（Graphics 回退）──────────────────────────────────
function _drawGirl(
  g: Phaser.GameObjects.Graphics,
  cx: number, footY: number, headCY: number,
  headR: number, bodyW: number, bodyH: number,
  s: (v: number) => number,
) {
  const skin = 0xfde8c8;
  const hairColor = 0x5c2d0e;
  const dressColor = 0xe91e8c;
  const dressLight = 0xf472b6;
  const collarColor = 0xffffff;
  const shoeColor = 0xb91c1c;
  const blushColor = 0xfca5a5;
  const eyeWhite = 0xffffff;
  const eyeDark = 0x1a1a2e;
  const mouthColor = 0xdc2626;
  const bodyTop = footY - bodyH;

  g.fillStyle(0x000000, 0.12);
  g.fillEllipse(cx, footY + s(4), bodyW * 1.1, s(12));
  g.fillStyle(dressColor, 1);
  g.fillRoundedRect(cx - bodyW * 0.5, bodyTop, bodyW, bodyH * 0.55, s(6));
  g.fillStyle(dressColor, 1);
  g.fillTriangle(cx - bodyW * 0.5, bodyTop + bodyH * 0.4, cx + bodyW * 0.5, bodyTop + bodyH * 0.4, cx + bodyW * 0.7, footY - s(8));
  g.fillTriangle(cx - bodyW * 0.5, bodyTop + bodyH * 0.4, cx - bodyW * 0.7, footY - s(8), cx + bodyW * 0.5, bodyTop + bodyH * 0.4);
  g.fillRoundedRect(cx - bodyW * 0.7, footY - s(20), bodyW * 1.4, s(14), s(4));
  g.fillStyle(dressLight, 0.5);
  g.fillRoundedRect(cx - bodyW * 0.3, bodyTop + s(4), bodyW * 0.15, bodyH * 0.3, s(3));
  g.fillStyle(collarColor, 1);
  g.fillRoundedRect(cx - s(8), bodyTop - s(2), s(16), s(14), s(4));
  g.fillStyle(skin, 1);
  g.fillRoundedRect(cx - bodyW * 0.55 - s(8), bodyTop + s(4), s(10), bodyH * 0.38, s(5));
  g.fillRoundedRect(cx + bodyW * 0.55 - s(2), bodyTop + s(4), s(10), bodyH * 0.38, s(5));
  g.fillStyle(shoeColor, 1);
  g.fillEllipse(cx - s(10), footY, s(18), s(10));
  g.fillEllipse(cx + s(10), footY, s(18), s(10));
  g.fillStyle(hairColor, 1);
  g.fillCircle(cx, headCY, headR * 1.08);
  g.fillRoundedRect(cx - headR * 0.9, headCY - headR * 0.9, headR * 1.8, headR * 0.6, s(4));
  g.fillCircle(cx - headR * 1.05, headCY - headR * 0.5, s(10));
  g.fillCircle(cx + headR * 1.05, headCY - headR * 0.5, s(10));
  g.fillStyle(0xef4444, 1);
  g.fillCircle(cx - headR * 1.05, headCY - headR * 0.5, s(5));
  g.fillCircle(cx + headR * 1.05, headCY - headR * 0.5, s(5));
  g.fillStyle(skin, 1);
  g.fillCircle(cx, headCY, headR);
  g.fillStyle(blushColor, 0.7);
  g.fillCircle(cx - headR * 0.52, headCY + headR * 0.15, headR * 0.25);
  g.fillCircle(cx + headR * 0.52, headCY + headR * 0.15, headR * 0.25);
  const eyeY = headCY - headR * 0.1;
  const eyeRx = headR * 0.22;
  const eyeRy = headR * 0.28;
  g.fillStyle(eyeWhite, 1);
  g.fillEllipse(cx - headR * 0.35, eyeY, eyeRx * 2, eyeRy * 2);
  g.fillEllipse(cx + headR * 0.35, eyeY, eyeRx * 2, eyeRy * 2);
  g.fillStyle(eyeDark, 1);
  g.fillEllipse(cx - headR * 0.35, eyeY + s(1), eyeRx * 1.2, eyeRy * 1.4);
  g.fillEllipse(cx + headR * 0.35, eyeY + s(1), eyeRx * 1.2, eyeRy * 1.4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - headR * 0.3, eyeY - s(2), s(3));
  g.fillCircle(cx + headR * 0.4, eyeY - s(2), s(3));
  g.lineStyle(s(1.8), hairColor, 1);
  g.beginPath(); g.moveTo(cx - headR * 0.52, eyeY - eyeRy - s(3)); g.lineTo(cx - headR * 0.18, eyeY - eyeRy - s(5)); g.strokePath();
  g.beginPath(); g.moveTo(cx + headR * 0.18, eyeY - eyeRy - s(5)); g.lineTo(cx + headR * 0.52, eyeY - eyeRy - s(3)); g.strokePath();
  g.lineStyle(s(1.8), mouthColor, 1);
  g.beginPath(); g.moveTo(cx - headR * 0.22, headCY + headR * 0.38); g.lineTo(cx, headCY + headR * 0.48); g.lineTo(cx + headR * 0.22, headCY + headR * 0.38); g.strokePath();
}

// ── 大叔（Graphics 回退）────────────────────────────────────
function _drawMan(
  g: Phaser.GameObjects.Graphics,
  cx: number, footY: number, headCY: number,
  headR: number, bodyW: number, bodyH: number,
  s: (v: number) => number,
) {
  const skin = 0xf5d5a0;
  const shirtColor = 0xf0f4f8;
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

  g.fillStyle(0x000000, 0.12);
  g.fillEllipse(cx, footY + s(4), bodyW * 1.1, s(12));
  g.fillStyle(0x374151, 1);
  g.fillRoundedRect(cx - bodyW * 0.35, bodyTop + bodyH * 0.55, bodyW * 0.3, bodyH * 0.45, s(4));
  g.fillRoundedRect(cx + bodyW * 0.05, bodyTop + bodyH * 0.55, bodyW * 0.3, bodyH * 0.45, s(4));
  g.fillStyle(shirtColor, 1);
  g.fillRoundedRect(cx - bodyW * 0.5, bodyTop, bodyW, bodyH * 0.6, s(6));
  g.fillStyle(shirtShadow, 0.6);
  g.fillRoundedRect(cx - bodyW * 0.1, bodyTop + s(4), bodyW * 0.2, bodyH * 0.35, s(3));
  g.fillStyle(beltColor, 1);
  g.fillRoundedRect(cx - bodyW * 0.5, bodyTop + bodyH * 0.52, bodyW, s(7), s(2));
  g.fillStyle(shirtColor, 1);
  g.fillRoundedRect(cx - bodyW * 0.58 - s(8), bodyTop + s(4), s(11), bodyH * 0.38, s(5));
  g.fillRoundedRect(cx + bodyW * 0.58 - s(3), bodyTop + s(4), s(11), bodyH * 0.38, s(5));
  g.fillStyle(skin, 1);
  g.fillCircle(cx - bodyW * 0.6 - s(2), bodyTop + bodyH * 0.42, s(7));
  g.fillCircle(cx + bodyW * 0.6 + s(2), bodyTop + bodyH * 0.42, s(7));
  g.fillStyle(shoeColor, 1);
  g.fillEllipse(cx - s(10), footY, s(20), s(11));
  g.fillEllipse(cx + s(10), footY, s(20), s(11));
  g.fillStyle(hatColor, 1);
  g.fillRoundedRect(cx - headR * 0.7, headCY - headR * 1.2, headR * 1.4, headR * 0.9, s(4));
  g.fillStyle(hatBrim, 1);
  g.fillRoundedRect(cx - headR * 0.85, headCY - headR * 0.35, headR * 1.7, s(7), s(3));
  g.fillStyle(skin, 1);
  g.fillCircle(cx, headCY, headR);
  g.fillStyle(blushColor, 0.4);
  g.fillCircle(cx - headR * 0.55, headCY + headR * 0.2, headR * 0.2);
  g.fillCircle(cx + headR * 0.55, headCY + headR * 0.2, headR * 0.2);
  g.fillStyle(eyeDark, 1);
  g.fillEllipse(cx - headR * 0.32, headCY - headR * 0.08, headR * 0.28, headR * 0.2);
  g.fillEllipse(cx + headR * 0.32, headCY - headR * 0.08, headR * 0.28, headR * 0.2);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - headR * 0.27, headCY - headR * 0.12, s(2.5));
  g.fillCircle(cx + headR * 0.38, headCY - headR * 0.12, s(2.5));
  g.lineStyle(s(2.5), beardColor, 1);
  g.beginPath(); g.moveTo(cx - headR * 0.5, headCY - headR * 0.3); g.lineTo(cx - headR * 0.14, headCY - headR * 0.35); g.strokePath();
  g.beginPath(); g.moveTo(cx + headR * 0.14, headCY - headR * 0.35); g.lineTo(cx + headR * 0.5, headCY - headR * 0.3); g.strokePath();
  g.fillStyle(beardColor, 0.85);
  g.fillEllipse(cx - headR * 0.25, headCY + headR * 0.52, headR * 0.4, headR * 0.22);
  g.fillEllipse(cx + headR * 0.25, headCY + headR * 0.52, headR * 0.4, headR * 0.22);
  g.fillEllipse(cx, headCY + headR * 0.62, headR * 0.5, headR * 0.18);
  g.lineStyle(s(1.8), mouthColor, 1);
  g.beginPath(); g.moveTo(cx - headR * 0.18, headCY + headR * 0.38); g.lineTo(cx, headCY + headR * 0.46); g.lineTo(cx + headR * 0.18, headCY + headR * 0.38); g.strokePath();
}

/** 棋牌常用配色：玩家蓝 / AI 紫 / AI 粉 / AI 青 */
export const AVATAR_COLORS = {
  player: 0x0ea5e9,
  ai1: 0x7c3aed,
  ai2: 0xbe185d,
  ai3: 0x14b8a6,
} as const;
