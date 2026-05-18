import fs from "fs";
import path from "path";
import type { ComicDocument } from "@/lib/comic-format";
import { docHasPlaceholderPanels } from "@/lib/comic-panel-prompt-urban";
import { getComicPanelStyleLock, type CoverGenre } from "@/lib/cover-genre";

export type StyleReferenceImage = {
  mimeType: string;
  base64: string;
};

export type ComicStyleRefOpts = {
  storyGenre?: CoverGenre;
  /** 分镜为占位/玄幻文案时勿用旧图锚定（都市题材） */
  skipStyleRefs?: boolean;
};

/** 首张已有分镜图 + 封面（最多 2 张），作风格锚点。 */
export function collectComicStyleReferenceUrls(
  doc: ComicDocument,
  coverPath?: string | null,
  opts?: ComicStyleRefOpts,
): string[] {
  if (opts?.skipStyleRefs) return [];

  const urban = opts?.storyGenre === "urban";
  if (urban && docHasPlaceholderPanels(doc)) return [];

  const urls: string[] = [];
  let firstPanelUrl: string | null = null;

  for (const page of doc.pages) {
    for (const panel of page.panels) {
      const u = panel.imageUrl?.trim();
      if (u) {
        firstPanelUrl = u;
        break;
      }
    }
    if (firstPanelUrl) break;
  }

  if (firstPanelUrl) urls.push(firstPanelUrl);

  const cover = coverPath?.trim();
  if (cover && !urban && !urls.includes(cover)) urls.push(cover);

  return urls.slice(0, 2);
}

async function loadImageReferenceFromUrl(url: string): Promise<StyleReferenceImage | null> {
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 64) return null;
      const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
      return { mimeType: mime, base64: buf.toString("base64") };
    }

    const rel = url.replace(/^\//, "").replace(/^public\//, "");
    const filePath = path.join(process.cwd(), "public", rel);
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    if (buf.length < 64) return null;
    const ext = path.extname(filePath).toLowerCase();
    const mimeType =
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
    return { mimeType, base64: buf.toString("base64") };
  } catch {
    return null;
  }
}

export async function loadStyleReferenceImages(urls: string[]): Promise<StyleReferenceImage[]> {
  const out: StyleReferenceImage[] = [];
  for (const url of urls) {
    const img = await loadImageReferenceFromUrl(url);
    if (img) out.push(img);
  }
  return out;
}

export const COMIC_STYLE_REFERENCE_INSTRUCTION =
  "Using the reference image(s) above as the ONLY style guide: match their art style, line weight, color palette, shading, and character designs (face, hair, clothing). Draw ONE new manga panel for this scene. Do not copy the reference composition. ";

export function buildComicStyleReferenceInstruction(genre?: CoverGenre): string {
  const base = COMIC_STYLE_REFERENCE_INSTRUCTION;
  if (genre === "urban") {
    return `${base}Setting MUST stay modern contemporary urban China (realistic clothes, city/office/apartment). Do NOT add fantasy magic, purple energy, ancient robes, or ruined apocalypse unless the scene text explicitly requires it. `;
  }
  if (genre && genre !== "general") {
    return `${base}Keep setting consistent with: ${getComicPanelStyleLock(genre)}. `;
  }
  return base;
}

/** 有参考图锚点时必须走 Gemini 多模态（OpenAI 无法读参考图）。 */
export function comicPanelRenderNeedsGemini(styleRefUrls: string[]): boolean {
  return styleRefUrls.length > 0;
}

export const COMIC_STYLE_GEMINI_REQUIRED_MSG =
  "漫画分镜配图为保持画风一致，须配置 GEMINI_API_KEY（首张分镜图+封面作为参考图，仅 Gemini 多模态支持）。";
