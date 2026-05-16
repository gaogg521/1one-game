import { parseComicImageUrls } from "@/lib/comic-format";
import { normalizeNovelTitle } from "@/lib/novel-display";

/** 从分镜 JSON 取第一张已生成配图。 */
export function comicCoverFromImageUrls(raw: string): string | null {
  const doc = parseComicImageUrls(raw);
  for (const page of doc.pages) {
    for (const panel of page.panels) {
      const url = panel.imageUrl?.trim();
      if (url) return url;
    }
  }
  return null;
}

/** 列表封面：优先库内 coverPath，否则分镜首图。 */
export function resolveComicCoverPath(
  imageUrls: string,
  storedCoverPath: string | null | undefined,
): string | null {
  const stored = storedCoverPath?.trim();
  if (stored) return stored;
  return comicCoverFromImageUrls(imageUrls);
}

/** 入库用漫画标题（基于规范化书名 + 后缀） */
export function formatComicStorageTitle(novelTitle: string, prompt?: string): string {
  const base = normalizeNovelTitle(novelTitle, prompt);
  return `${base} · 漫画版`;
}

/** 阅读页展示用标题（去掉后缀并规范化，避免整段大纲当书名） */
export function displayComicTitle(comicTitle: string, novelTitle?: string, prompt?: string): string {
  const stripped = comicTitle.replace(/\s*·\s*漫画版\s*$/u, "").trim();
  return normalizeNovelTitle(stripped, prompt ?? novelTitle, undefined);
}
