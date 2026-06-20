import type { GameSpec } from "@/lib/game-spec";
import { isMinecraftLikeSpec, MINECRAFT_THEME } from "@/lib/minecraft-franchise";

/** 程序化环境音气质：由模型可选指定，或由主题饱和度/亮度推断。 */
export type MusicProfile = "organic" | "pulse" | "minimal" | "neon";

function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const s = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null;
  return {
    r: parseInt(s.slice(1, 3), 16),
    g: parseInt(s.slice(3, 5), 16),
    b: parseInt(s.slice(5, 7), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return a;
  const u = clamp(t, 0, 1);
  return rgbToHex(
    A.r + (B.r - A.r) * u,
    A.g + (B.g - A.g) * u,
    A.b + (B.b - A.b) * u,
  );
}

export function hexToPhaserUint(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return (rgb.r << 16) | (rgb.g << 8) | rgb.b;
}

/** Phaser Graphics 整数色 → `#rrggbb` */
export function phaserUintToCssHex(u: number): string {
  const n = u >>> 0;
  return `#${n.toString(16).padStart(6, "0")}`;
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = (h % 360) / 360;
  const hue2rgb = (p: number, q: number, tt: number) => {
    let t = tt;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, hh + 1 / 3);
    g = hue2rgb(p, q, hh);
    b = hue2rgb(p, q, hh - 1 / 3);
  }
  return {
    r: Math.round(clamp(r, 0, 1) * 255),
    g: Math.round(clamp(g, 0, 1) * 255),
    b: Math.round(clamp(b, 0, 1) * 255),
  };
}

export function saturateHex(hex: string, delta: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.s = clamp(hsl.s + delta, 0, 1);
  const o = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(o.r, o.g, o.b);
}

export type AssetStyle =
  | "classic-arcade"
  | "hard-sci-fi"
  | "kawaii-mecha"
  | "bullet-hell"
  | "wuxia-flight"
  | "blocky-pixel"
  | "cute-cartoon"
  | "dark-fantasy"
  | "80s-cartoon"
  | "nature-organic"
  | "neon-cyber"
  | "paper-craft";

const ASSET_STYLES: readonly AssetStyle[] = [
  "classic-arcade",
  "hard-sci-fi",
  "kawaii-mecha",
  "bullet-hell",
  "wuxia-flight",
  "blocky-pixel",
  "cute-cartoon",
  "dark-fantasy",
  "80s-cartoon",
  "nature-organic",
  "neon-cyber",
  "paper-craft",
] as const;

/**
 * 从 spec 推断 assetStyle（仅当 LLM 未明确输出时使用）。
 * 检查 title/subtitle/labels 关键词 → 模板默认 → 主题色推断。
 */
export function inferAssetStyle(spec: GameSpec): AssetStyle {
  const blob = [
    spec.title,
    spec.labels?.subtitle ?? "",
    spec.labels?.player ?? "",
    spec.labels?.hazard ?? "",
    spec.labels?.collectible ?? "",
  ]
    .join(" ")
    .toLowerCase();

  // 强关键词命中
  if (/方块|我的世界|minecraft|像素|pixel|8bit|steve|苦力怕/.test(blob)) return "blocky-pixel";
  if (/赛博|霓虹|cyber|neon|赛博朋克|cyberpunk/.test(blob)) return "neon-cyber";
  if (/弹幕|bullet hell|东方|touhou|barrage/.test(blob)) return "bullet-hell";
  if (/武侠|剑客|江湖|水墨|wuxia|中国风|仙侠/.test(blob)) return "wuxia-flight";
  if (/萌|可爱|cute|chibi|kawaii|猫|狗|kitten|喵/.test(blob)) return "cute-cartoon";
  if (/机甲|高达|gundam|mecha|robot/.test(blob)) return "kawaii-mecha";
  if (/暗黑|哥特|地狱|恶魔|gothic|dark fantasy|demon|undead/.test(blob)) return "dark-fantasy";
  if (/纸|折纸|手工|paper|craft|origami/.test(blob)) return "paper-craft";
  if (/田园|自然|森林|花园|garden|forest|farm/.test(blob)) return "nature-organic";
  if (/80s|复古|retro|vintage|霓虹复古/.test(blob)) return "80s-cartoon";
  if (/太空|宇宙|星际|战舰|space|galaxy|spaceship|starfighter|sci-?fi/.test(blob)) return "hard-sci-fi";

  // 模板默认气质
  const templateDefault: Partial<Record<GameSpec["templateId"], AssetStyle>> = {
    shooter: "classic-arcade",
    towerDefense: "cute-cartoon",
    platformer: "80s-cartoon",
    coaster: "kawaii-mecha",
    farming: "nature-organic",
    survivor: "dark-fantasy",
    avoider: "classic-arcade",
    collector: "cute-cartoon",
    puzzle: "paper-craft",
    physics: "paper-craft",
    chess: "paper-craft",
    customization: "cute-cartoon",
    strategy: "dark-fantasy",
  };
  const def = templateDefault[spec.templateId];
  if (def) return def;

  // 主题色推断兜底
  const bg = hexToRgb(spec.theme.backgroundColor);
  const player = hexToRgb(spec.theme.playerColor);
  if (bg && player) {
    const lum = relativeLuminance(bg);
    const hs = rgbToHsl(player.r, player.g, player.b);
    if (lum < 0.18 && hs.s > 0.5) return "neon-cyber";
    if (lum > 0.6) return "cute-cartoon";
  }
  return "classic-arcade";
}

/** 补齐 presentation.musicProfile / assetStyle / qualityTier 等（仅当缺失时）。 */
export function withPresentationDefaults(spec: GameSpec): GameSpec {
  const cur = spec.presentation ?? {};
  const musicProfile =
    cur.musicProfile === "organic" ||
    cur.musicProfile === "pulse" ||
    cur.musicProfile === "minimal" ||
    cur.musicProfile === "neon"
      ? cur.musicProfile
      : inferMusicProfile(spec.theme);
  const qualityTier = cur.qualityTier ?? "standard";
  const assetStyle =
    cur.assetStyle && ASSET_STYLES.includes(cur.assetStyle as AssetStyle)
      ? cur.assetStyle
      : inferAssetStyle(spec);

  if (
    cur.musicProfile === musicProfile &&
    cur.qualityTier === qualityTier &&
    cur.assetStyle === assetStyle
  ) {
    return spec;
  }
  return {
    ...spec,
    presentation: {
      ...cur,
      musicProfile,
      qualityTier,
      assetStyle,
    },
  };
}

export function resolveAssetStyle(spec: GameSpec): AssetStyle {
  const cur = spec.presentation?.assetStyle;
  if (cur && ASSET_STYLES.includes(cur as AssetStyle)) return cur as AssetStyle;
  return inferAssetStyle(spec);
}

export type ShaderPack =
  | "flat"
  | "neon-glow"
  | "hologram"
  | "toon"
  | "pixel-grade"
  | "ink-wash"
  | "dissolve"
  | "crystal"
  | "organic-pulse";

export type ParticleIntensity = "minimal" | "standard" | "showcase";

export type VisualAnimationSet =
  | "none"
  | "prop-bounce"
  | "prop-action"
  | "prop-action-glb";

const SHADER_PACKS: readonly ShaderPack[] = [
  "flat",
  "neon-glow",
  "hologram",
  "toon",
  "pixel-grade",
  "ink-wash",
  "dissolve",
  "crystal",
  "organic-pulse",
] as const;

const ANIMATION_SETS: readonly VisualAnimationSet[] = [
  "none",
  "prop-bounce",
  "prop-action",
  "prop-action-glb",
] as const;

/** assetStyle → 推荐 shaderPack（运行时 fallback 到 flat） */
const ASSET_STYLE_SHADER_PACK: Record<AssetStyle, ShaderPack> = {
  "classic-arcade": "flat",
  "hard-sci-fi": "hologram",
  "kawaii-mecha": "toon",
  "bullet-hell": "neon-glow",
  "wuxia-flight": "ink-wash",
  "blocky-pixel": "pixel-grade",
  "cute-cartoon": "toon",
  "dark-fantasy": "dissolve",
  "80s-cartoon": "toon",
  "nature-organic": "organic-pulse",
  "neon-cyber": "neon-glow",
  "paper-craft": "flat",
};

const ASSET_STYLE_ANIMATION_SET: Record<AssetStyle, VisualAnimationSet> = {
  "classic-arcade": "prop-bounce",
  "hard-sci-fi": "prop-action",
  "kawaii-mecha": "prop-action",
  "bullet-hell": "prop-action",
  "wuxia-flight": "prop-action",
  "blocky-pixel": "prop-bounce",
  "cute-cartoon": "prop-bounce",
  "dark-fantasy": "prop-action",
  "80s-cartoon": "prop-bounce",
  "nature-organic": "prop-bounce",
  "neon-cyber": "prop-action",
  "paper-craft": "prop-bounce",
};

export function inferShaderPack(spec: GameSpec): ShaderPack {
  return ASSET_STYLE_SHADER_PACK[resolveAssetStyle(spec)];
}

export function inferAnimationSet(spec: GameSpec): VisualAnimationSet {
  return ASSET_STYLE_ANIMATION_SET[resolveAssetStyle(spec)];
}

export function resolveShaderPack(spec: GameSpec): ShaderPack {
  const cur = spec.visual?.shaderPack;
  if (cur && SHADER_PACKS.includes(cur)) return cur;
  return inferShaderPack(spec);
}

export function resolveAnimationSet(spec: GameSpec): VisualAnimationSet {
  const cur = spec.visual?.animationSet;
  if (cur && ANIMATION_SETS.includes(cur)) return cur;
  return inferAnimationSet(spec);
}

export function resolveParticleIntensity(spec: GameSpec): ParticleIntensity {
  const cur = spec.visual?.particleIntensity;
  if (cur === "minimal" || cur === "standard" || cur === "showcase") return cur;
  const tier = spec.presentation?.qualityTier;
  if (tier === "showcase") return "showcase";
  if (tier === "minimal") return "minimal";
  return "standard";
}

/**
 * 补齐 visual.shaderPack / particleIntensity / animationSet（仅当缺失时）。
 * zones 不在此注入——LLM 关卡意图，缺则 runtime 走 blueprint 默认。
 * 必须在 withPresentationDefaults 之后调用（依赖 assetStyle/qualityTier 已就位）。
 */
export function withVisualDefaults(spec: GameSpec): GameSpec {
  const cur = spec.visual;
  const shaderPack = resolveShaderPack(spec);
  const particleIntensity = resolveParticleIntensity(spec);
  const animationSet = resolveAnimationSet(spec);
  if (
    cur?.shaderPack === shaderPack &&
    cur?.particleIntensity === particleIntensity &&
    cur?.animationSet === animationSet
  ) {
    return spec;
  }
  return {
    ...spec,
    visual: {
      ...(cur ?? {}),
      shaderPack,
      particleIntensity,
      animationSet,
    },
  };
}

export function resolveMusicProfile(spec: GameSpec): MusicProfile {
  const m = spec.presentation?.musicProfile;
  if (m === "organic" || m === "pulse" || m === "minimal" || m === "neon") return m;
  return inferMusicProfile(spec.theme);
}

function inferMusicProfile(theme: GameSpec["theme"]): MusicProfile {
  const bg = hexToRgb(theme.backgroundColor);
  const pv = hexToRgb(theme.playerColor);
  const hz = hexToRgb(theme.hazardColor);
  if (!bg || !pv || !hz) return "pulse";
  if (
    theme.backgroundColor.toLowerCase() === MINECRAFT_THEME.backgroundColor.toLowerCase() &&
    theme.playerColor.toLowerCase() === MINECRAFT_THEME.playerColor.toLowerCase()
  ) {
    return "organic";
  }
  const h1 = rgbToHsl(pv.r, pv.g, pv.b);
  const h2 = rgbToHsl(hz.r, hz.g, hz.b);
  const sat = (h1.s + h2.s) / 2;
  const lum = relativeLuminance(bg);
  if (sat > 0.42 && lum < 0.22) return "neon";
  if (sat < 0.22) return "organic";
  return "pulse";
}

/** 与主题色相挂钩的根音高（Hz），供环境铺底与和弦使用。 */
export function thematicRootFrequencyHz(theme: GameSpec["theme"]): number {
  const rgb = hexToRgb(theme.playerColor);
  if (!rgb) return 130;
  const h = rgbToHsl(rgb.r, rgb.g, rgb.b).h;
  return 92 + (h / 360) * 118;
}

function legibleForeground(bgHex: string, warmHex: string): string {
  const bgRgb = hexToRgb(bgHex);
  if (!bgRgb) return "#f4f4f5";
  const lum = relativeLuminance(bgRgb);
  if (lum > 0.52) {
    return mixHex("#0c1220", bgHex, 0.9);
  }
  return mixHex("#f5f5f5", mixHex(warmHex, "#ffffff", 0.38), 0.84);
}

function legibleMuted(fgHex: string, bgHex: string): string {
  return mixHex(fgHex, bgHex, 0.45);
}

export interface CohesiveHud {
  title: string;
  subtitle: string;
  body: string;
  muted: string;
  accent: string;
  accent2: string;
  coins: string;
  danger: string;
  hint: string;
}

export interface CohesiveHudBannerStyle {
  fill: number;
  fillAlpha: number;
  stroke: number;
  strokeAlpha: number;
  titleColor: string;
  messageColor: string;
}

/** 映射到首页主题变量 (--gc-accent 等)，使试玩外框随作品调色。 */
export interface GameChromeCss {
  accent: string;
  accent2: string;
  cyan: string;
  text: string;
  muted: string;
  elevated: string;
  borderRgb: string;
  ctaA: string;
  ctaB: string;
  ctaC: string;
}

export interface CohesivePresentation {
  hud: CohesiveHud;
  banner: CohesiveHudBannerStyle;
  bleepTemperament: number;
  contrastLevel: "low" | "medium" | "high";
  musicProfile: MusicProfile;
  qualityTier: "minimal" | "standard" | "showcase";
  panelFill: number;
  panelFillAlpha: number;
  panelStroke: number;
  panelStrokeAlpha: number;
  chrome: GameChromeCss;
  platformMid: number;
  platformHi: number;
  platformGround: number;
}

export type CohesiveExperienceSnapshot = {
  label: string;
  detail: string;
  chips: string[];
};

function contrastRatio(a: string, b: string): number {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return 1;
  const lumA = relativeLuminance(A);
  const lumB = relativeLuminance(B);
  const hi = Math.max(lumA, lumB);
  const lo = Math.min(lumA, lumB);
  return (hi + 0.05) / (lo + 0.05);
}

function classifyContrast(ratio: number): "low" | "medium" | "high" {
  if (ratio >= 5.5) return "high";
  if (ratio >= 3.5) return "medium";
  return "low";
}

/** 依据 GameSpec.theme 推导 HUD / 横幅 / React 外壳 / 程序化音频气质。 */
export function buildCohesivePresentation(spec: GameSpec): CohesivePresentation {
  const specW = withPresentationDefaults(spec);
  const th = specW.theme;
  const coll = th.collectibleColor ?? th.playerColor;
  const part = th.particleTint ?? coll;
  const bg = th.backgroundColor;

  const fg = legibleForeground(bg, coll);
  const muted = legibleMuted(fg, bg);
  const accent = saturateHex(coll, 0.08);
  const accent2 = saturateHex(mixHex(th.playerColor, part, 0.5), 0.06);
  const danger = mixHex(th.hazardColor, "#fb7185", 0.28);
  const coins = saturateHex(coll, 0.14);
  const subtitleColor = legibleMuted(mixHex(fg, coll, 0.22), bg);
  const hintColor = legibleMuted(mixHex(muted, bg, 0.55), bg);

  const prPlayer = hexToRgb(th.playerColor);
  const meanHue = prPlayer ? rgbToHsl(prPlayer.r, prPlayer.g, prPlayer.b).h : 180;
  const bleepTemperament = clamp(0.82 + (meanHue / 360) * 0.34, 0.76, 1.24);
  const contrastLevel = classifyContrast(contrastRatio(bg, fg));

  const musicProfile = resolveMusicProfile(specW);
  const qualityTier = specW.presentation?.qualityTier ?? "standard";

  const panelHex = mixHex(bg, "#070b10", 0.52);
  const fillInt = hexToPhaserUint(panelHex) ?? 0x0b1220;
  const strokeLine = mixHex(accent, "#ffffff", 0.55);
  const strokeInt = hexToPhaserUint(strokeLine) ?? 0x94a3b8;

  const banner: CohesiveHudBannerStyle = {
    fill: fillInt,
    fillAlpha: 0.58,
    stroke: strokeInt,
    strokeAlpha: 0.24,
    titleColor: fg,
    messageColor: legibleMuted(fg, mixHex(bg, panelHex, 0.45)),
  };

  const chAccent = saturateHex(th.playerColor, 0.14);
  const chAccent2 = saturateHex(coll, 0.12);
  const chCyan = saturateHex(part, 0.1);
  const elevated = mixHex(bg, "#020508", 0.38);
  const accRgb = hexToRgb(chAccent)!;

  const chrome: GameChromeCss = {
    accent: chAccent,
    accent2: chAccent2,
    cyan: chCyan,
    text: fg,
    muted,
    elevated,
    borderRgb: `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`,
    ctaA: mixHex(chCyan, chAccent, 0.35),
    ctaB: chAccent,
    ctaC: chAccent2,
  };

  const mc = isMinecraftLikeSpec(specW);
  const platHexMid = mc ? "#5d9b47" : mixHex(mixHex(bg, coll, 0.38), "#1e293b", 0.52);
  const platHexHi = mc ? "#6eb854" : mixHex(platHexMid, mixHex(accent2, "#e2e8f0", 0.55), 0.22);
  const platHexGround = mc ? "#8b6914" : mixHex(mixHex(bg, "#020617", 0.72), platHexMid, 0.35);
  const platMid = hexToPhaserUint(platHexMid) ?? 0x334155;
  const platHi = hexToPhaserUint(platHexHi) ?? 0x475569;
  const platGround = hexToPhaserUint(platHexGround) ?? 0x1e293b;

  const panelFill = hexToPhaserUint(mixHex(panelHex, accent, 0.12)) ?? fillInt;
  const panelStroke = hexToPhaserUint(strokeLine) ?? strokeInt;

  const hud: CohesiveHud = {
    title: fg,
    subtitle: subtitleColor,
    body: fg,
    muted,
    accent,
    accent2,
    coins,
    danger,
    hint: hintColor,
  };

  return {
    hud,
    banner,
    bleepTemperament,
    contrastLevel,
    musicProfile,
    qualityTier,
    panelFill,
    panelFillAlpha: 0.56,
    panelStroke,
    panelStrokeAlpha: 0.28,
    chrome,
    platformMid: platMid,
    platformHi: platHi,
    platformGround: platGround,
  };
}

/**
 * 给试玩页/调试视图使用的可见摘要：
 * 让“共享体验层”是否生效一眼可见，而不是只埋在数据里。
 */
export function describeCohesiveExperience(p: CohesivePresentation): CohesiveExperienceSnapshot {
  return {
    label: "共享体验层",
    detail: `音乐 ${p.musicProfile} · 表现 ${p.qualityTier} · 打击 ${p.bleepTemperament.toFixed(2)}x · 对比 ${p.contrastLevel}`,
    chips: [
      `music:${p.musicProfile}`,
      `tier:${p.qualityTier}`,
      `juice:${p.bleepTemperament.toFixed(2)}x`,
      `contrast:${p.contrastLevel}`,
    ],
  };
}