/**
 * 离线程序化游戏资产：用 sharp 从 GameSpec 主题色生成 sprite / 背景 PNG。
 * 供样品馆 seed、E2E stub、无文生图密钥环境使用。
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { GameSpec } from "@/lib/game-spec";

export type ProceduralSpriteKind = "player" | "hazard" | "gem" | "power" | "boss";

const SPRITE_KINDS: ProceduralSpriteKind[] = ["player", "hazard", "gem", "power", "boss"];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbCss([r, g, b]: [number, number, number], alpha = 1): string {
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function lighten([r, g, b]: [number, number, number], amt: number): [number, number, number] {
  return [
    Math.min(255, Math.round(r + (255 - r) * amt)),
    Math.min(255, Math.round(g + (255 - g) * amt)),
    Math.min(255, Math.round(b + (255 - b) * amt)),
  ];
}

function spriteSvg(kind: ProceduralSpriteKind, spec: GameSpec, size: number, rich: boolean): string {
  const bg = hexToRgb(spec.theme.backgroundColor);
  const player = hexToRgb(spec.theme.playerColor);
  const hazard = hexToRgb(spec.theme.hazardColor);
  const gem = hexToRgb(spec.theme.collectibleColor ?? spec.theme.particleTint ?? "#f1c40f");
  const cx = size / 2;
  const cy = size / 2;
  const pad = Math.round(size * 0.08);

  const body = (() => {
    switch (kind) {
      case "player": {
        const headR = size * 0.14;
        const bodyW = size * 0.34;
        const bodyH = size * 0.36;
        const eye = rich ? `<circle cx="${cx - headR * 0.35}" cy="${cy - size * 0.18}" r="${headR * 0.18}" fill="#fff"/><circle cx="${cx + headR * 0.35}" cy="${cy - size * 0.18}" r="${headR * 0.18}" fill="#fff"/>` : "";
        return `
          <rect x="${cx - bodyW / 2}" y="${cy - size * 0.02}" width="${bodyW}" height="${bodyH}" rx="${bodyW * 0.2}" fill="${rgbCss(player)}"/>
          <circle cx="${cx}" cy="${cy - size * 0.2}" r="${headR}" fill="${rgbCss(lighten(player, 0.15))}"/>
          ${eye}
        `;
      }
      case "hazard": {
        const r = size * 0.28;
        const spikes = rich ? 10 : 8;
        const pts: string[] = [];
        for (let i = 0; i < spikes; i += 1) {
          const a = (i / spikes) * Math.PI * 2 - Math.PI / 2;
          const rr = i % 2 === 0 ? r : r * 0.72;
          pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
        }
        return `<polygon points="${pts.join(" ")}" fill="${rgbCss(hazard)}"/>`;
      }
      case "gem": {
        const w = size * 0.22;
        const h = size * 0.3;
        return `
          <polygon points="${cx},${cy - h} ${cx + w},${cy} ${cx},${cy + h} ${cx - w},${cy}" fill="${rgbCss(gem)}"/>
          <polygon points="${cx},${cy - h * 0.55} ${cx + w * 0.55},${cy} ${cx},${cy + h * 0.2} ${cx - w * 0.55},${cy}" fill="${rgbCss(lighten(gem, 0.35))}" opacity="0.85"/>
        `;
      }
      case "power": {
        const r = size * 0.26;
        return `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="${rgbCss(lighten(player, 0.25))}" opacity="0.9"/>
          <polygon points="${cx},${cy - r * 0.9} ${cx + r * 0.35},${cy + r * 0.15} ${cx - r * 0.1},${cy + r * 0.15} ${cx + r * 0.2},${cy + r * 0.85} ${cx - r * 0.35},${cy - r * 0.05} ${cx + r * 0.05},${cy - r * 0.05}" fill="${rgbCss(player)}"/>
        `;
      }
      case "boss": {
        const r = size * 0.3;
        return `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="${rgbCss(hazard)}"/>
          <circle cx="${cx - r * 0.3}" cy="${cy - r * 0.15}" r="${r * 0.14}" fill="#fff"/>
          <circle cx="${cx + r * 0.3}" cy="${cy - r * 0.15}" r="${r * 0.14}" fill="#fff"/>
          <rect x="${cx - r * 0.55}" y="${cy + r * 0.1}" width="${r * 1.1}" height="${r * 0.22}" rx="${r * 0.08}" fill="#2b0f0f" opacity="0.65"/>
        `;
      }
      default:
        return "";
    }
  })();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${rgbCss(bg)}"/>
    <rect x="${pad}" y="${pad}" width="${size - pad * 2}" height="${size - pad * 2}" rx="${pad}" fill="${rgbCss(bg, 0.0)}"/>
    ${body}
  </svg>`;
}

function backgroundSvg(spec: GameSpec, w: number, h: number, rich: boolean): string {
  const bg = hexToRgb(spec.theme.backgroundColor);
  const player = hexToRgb(spec.theme.playerColor);
  const hazard = hexToRgb(spec.theme.hazardColor);
  const gem = hexToRgb(spec.theme.collectibleColor ?? spec.theme.particleTint ?? "#f1c40f");
  const blobs = rich
    ? `
    <circle cx="${w * 0.2}" cy="${h * 0.25}" r="${w * 0.18}" fill="${rgbCss(player, 0.18)}"/>
    <circle cx="${w * 0.82}" cy="${h * 0.7}" r="${w * 0.22}" fill="${rgbCss(hazard, 0.14)}"/>
    <circle cx="${w * 0.55}" cy="${h * 0.15}" r="${w * 0.12}" fill="${rgbCss(gem, 0.16)}"/>
  `
    : `
    <circle cx="${w * 0.25}" cy="${h * 0.3}" r="${w * 0.15}" fill="${rgbCss(player, 0.12)}"/>
    <circle cx="${w * 0.75}" cy="${h * 0.65}" r="${w * 0.18}" fill="${rgbCss(hazard, 0.1)}"/>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${rgbCss(bg)}"/>
        <stop offset="100%" stop-color="${rgbCss(lighten(bg, 0.08))}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    ${blobs}
  </svg>`;
}

export async function renderProceduralSprite(
  kind: ProceduralSpriteKind,
  spec: GameSpec,
  opts?: { size?: number; rich?: boolean },
): Promise<Buffer> {
  const size = opts?.size ?? 256;
  const svg = spriteSvg(kind, spec, size, Boolean(opts?.rich));
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderProceduralBackground(
  spec: GameSpec,
  opts?: { width?: number; height?: number; rich?: boolean },
): Promise<Buffer> {
  const w = opts?.width ?? 512;
  const h = opts?.height ?? 512;
  const svg = backgroundSvg(spec, w, h, Boolean(opts?.rich));
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export type WriteSampleAssetsResult = {
  projectId: string;
  sampleId: string;
  sprites: ProceduralSpriteKind[];
  background: boolean;
};

export async function writeSampleProceduralAssets(
  projectId: string,
  spec: GameSpec,
  opts?: { rich?: boolean; rootDir?: string },
): Promise<WriteSampleAssetsResult> {
  const root = opts?.rootDir ?? path.join(process.cwd(), "public");
  const rich = Boolean(opts?.rich);
  const spriteDir = path.join(root, "game-sprites", projectId);
  const bgDir = path.join(root, "game-bg");
  fs.mkdirSync(spriteDir, { recursive: true });
  fs.mkdirSync(bgDir, { recursive: true });

  for (const kind of SPRITE_KINDS) {
    const buf = await renderProceduralSprite(kind, spec, { rich });
    fs.writeFileSync(path.join(spriteDir, `${kind}.png`), buf);
  }

  const bgBuf = await renderProceduralBackground(spec, { rich });
  fs.writeFileSync(path.join(bgDir, `${projectId}.png`), bgBuf);

  const sampleId = projectId.startsWith("sample-") ? projectId.slice("sample-".length) : projectId;
  return { projectId, sampleId, sprites: [...SPRITE_KINDS], background: true };
}
