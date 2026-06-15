import type { AppLocale } from "@/i18n/routing";
import { ApiKeyedError } from "@/lib/api/api-keyed-error";
import { untitledShortLabel } from "@/lib/i18n/chapter-labels";
import fs from "node:fs/promises";
import path from "node:path";
import { loadSharp } from "@/lib/sharp-loader";
import { COVER_GENRE_STYLES, type CoverGenre } from "@/lib/cover-genre";

const COVER_W = 600;
const COVER_H = 800;

const FONT_CDN =
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.2.9/files/noto-serif-sc-chinese-simplified-700-normal.woff";

let cachedFontB64: string | null = null;

async function loadCoverFontBase64(): Promise<string> {
  if (cachedFontB64) return cachedFontB64;

  const root = process.cwd();
  const localCandidates = [
    path.join(/* turbopackIgnore: true */ root, "assets/fonts/noto-serif-sc-chinese-simplified-700-normal.woff"),
    path.join(
      /* turbopackIgnore: true */ root,
      "node_modules/@fontsource/noto-serif-sc/files/noto-serif-sc-chinese-simplified-700-normal.woff",
    ),
  ];

  for (const p of localCandidates) {
    try {
      const buf = await fs.readFile(p);
      cachedFontB64 = buf.toString("base64");
      return cachedFontB64;
    } catch {
      /* try next */
    }
  }

  const res = await fetch(FONT_CDN, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new ApiKeyedError("coverFontDownloadFailed", { status: res.status });
  cachedFontB64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  return cachedFontB64;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitTitleLines(title: string, uiLocale: AppLocale, maxCharsPerLine = 5): string[] {
  const clean = title.trim().replace(/\s+/g, "");
  if (!clean) return [untitledShortLabel(uiLocale)];
  if (clean.length <= maxCharsPerLine) return [clean];
  const lines: string[] = [];
  for (let i = 0; i < clean.length; i += maxCharsPerLine) {
    lines.push(clean.slice(i, i + maxCharsPerLine));
  }
  return lines.slice(0, 4);
}

function buildOverlaySvg(title: string, genre: CoverGenre, fontB64: string, uiLocale: AppLocale): string {
  const style = COVER_GENRE_STYLES[genre];
  const lines = splitTitleLines(title, uiLocale);
  const fontSize = lines.length >= 3 ? 44 : lines.length === 2 ? 52 : 58;
  const lineHeight = fontSize + 10;
  const baseY = COVER_H - 72;

  const titleTexts = lines
    .map((line, i) => {
      const y = baseY - (lines.length - 1 - i) * lineHeight;
      return `<text x="36" y="${y}" class="title" fill="${style.titleColor}">${escapeXml(line)}</text>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${COVER_H}">
  <defs>
    <style>
      @font-face {
        font-family: 'CoverHan';
        src: url('data:font/woff;base64,${fontB64}') format('woff');
        font-weight: 700;
        font-style: normal;
      }
      .title {
        font-family: 'CoverHan', 'Microsoft YaHei', 'SimHei', sans-serif;
        font-size: ${fontSize}px;
        font-weight: 700;
        letter-spacing: 0.06em;
      }
      .genre {
        font-family: 'CoverHan', 'Microsoft YaHei', sans-serif;
        font-size: 13px;
        letter-spacing: 0.2em;
      }
    </style>
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="35%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="55%" stop-color="#000000" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.82"/>
    </linearGradient>
    <filter id="titleShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.9"/>
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="${style.titleColor}" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#vignette)"/>
  <text x="36" y="${baseY - lines.length * lineHeight - 8}" class="genre" fill="${style.accentColor}">${escapeXml(style.label)}</text>
  <g filter="url(#titleShadow)">
    ${titleTexts}
  </g>
</svg>`;
}

/** 将 AI 背景图与小说标题合成为网文风格封面（3:4 竖版，含书名）。 */
export async function compositeNovelCover(
  background: Buffer,
  opts: { title: string; genre: CoverGenre; uiLocale?: AppLocale },
): Promise<Buffer> {
  const fontB64 = await loadCoverFontBase64();
  const uiLocale = opts.uiLocale ?? "zh-Hans";
  const svg = Buffer.from(buildOverlaySvg(opts.title, opts.genre, fontB64, uiLocale));
  const sharp = await loadSharp();

  const bg = await sharp(background)
    .resize(COVER_W, COVER_H, { fit: "cover", position: "centre" })
    .toBuffer();

  return sharp(bg)
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
