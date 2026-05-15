import type { GameSpec } from "@/lib/game-spec";

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

/** 补齐 presentation.musicProfile（仅当缺失时）；不改变模型已输出的合法取值。 */
export function withPresentationDefaults(spec: GameSpec): GameSpec {
  const cur = spec.presentation?.musicProfile;
  if (cur === "organic" || cur === "pulse" || cur === "minimal" || cur === "neon") {
    return spec;
  }
  return {
    ...spec,
    presentation: {
      ...spec.presentation,
      musicProfile: inferMusicProfile(spec.theme),
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
  musicProfile: MusicProfile;
  panelFill: number;
  panelFillAlpha: number;
  panelStroke: number;
  panelStrokeAlpha: number;
  chrome: GameChromeCss;
  platformMid: number;
  platformHi: number;
  platformGround: number;
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

  const musicProfile = resolveMusicProfile(specW);

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

  const platHexMid = mixHex(mixHex(bg, coll, 0.38), "#1e293b", 0.52);
  const platHexHi = mixHex(platHexMid, mixHex(accent2, "#e2e8f0", 0.55), 0.22);
  const platHexGround = mixHex(mixHex(bg, "#020617", 0.72), platHexMid, 0.35);
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
    musicProfile,
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