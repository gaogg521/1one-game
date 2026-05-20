import type { ComicDirectorPack, ComicShotType } from "@/lib/comic-director-types";

export interface ComicPanel {
  scene?: number;
  caption: string;
  prompt: string;
  imageUrl?: string;
  /** 长篇导演流水线：角色/场景/镜头 */
  characterIds?: string[];
  locationId?: string;
  shotType?: ComicShotType;
  sceneDescriptionEn?: string;
}

export interface ComicPage {
  page: number;
  panels: ComicPanel[];
}

export interface ComicDocument {
  formatVersion: number;
  pageCount: number;
  pages: ComicPage[];
  /** formatVersion 3：长篇导演包，配图时保持一致性 */
  director?: ComicDirectorPack;
  pipeline?: "long_director" | "light";
}

/** 兼容旧版：imageUrls 为 panel 数组 */
export function parseComicImageUrls(raw: string): ComicDocument {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { formatVersion: 1, pageCount: 0, pages: [] };
  }

  if (Array.isArray(data)) {
    const panels = data as ComicPanel[];
    if (panels.length === 0) {
      return { formatVersion: 1, pageCount: 0, pages: [] };
    }
    return {
      formatVersion: 1,
      pageCount: 1,
      pages: [{ page: 1, panels }],
    };
  }

  if (data && typeof data === "object" && "pages" in data) {
    const doc = data as {
      formatVersion?: number;
      pageCount?: number;
      pages: ComicPage[];
      director?: ComicDirectorPack;
      pipeline?: "long_director" | "light";
    };
    const pages = Array.isArray(doc.pages) ? doc.pages : [];
    return {
      formatVersion: doc.formatVersion ?? 2,
      pageCount: doc.pageCount ?? pages.length,
      pages: pages.map((p, i) => ({
        page: p.page ?? i + 1,
        panels: Array.isArray(p.panels) ? p.panels : [],
      })),
      ...(doc.director ? { director: doc.director } : {}),
      ...(doc.pipeline ? { pipeline: doc.pipeline } : {}),
    };
  }

  return { formatVersion: 1, pageCount: 0, pages: [] };
}

export function serializeComicDocument(doc: ComicDocument): string {
  const formatVersion = doc.director ? 3 : doc.formatVersion ?? 2;
  return JSON.stringify({
    formatVersion,
    pageCount: doc.pageCount,
    pages: doc.pages,
    ...(doc.director ? { director: doc.director, pipeline: doc.pipeline ?? "long_director" } : {}),
  });
}

export function flattenPanels(doc: ComicDocument): ComicPanel[] {
  return doc.pages.flatMap((p) => p.panels);
}
