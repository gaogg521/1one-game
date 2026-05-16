export interface ComicPanel {
  scene?: number;
  caption: string;
  prompt: string;
  imageUrl?: string;
}

export interface ComicPage {
  page: number;
  panels: ComicPanel[];
}

export interface ComicDocument {
  formatVersion: number;
  pageCount: number;
  pages: ComicPage[];
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
    const doc = data as { formatVersion?: number; pageCount?: number; pages: ComicPage[] };
    const pages = Array.isArray(doc.pages) ? doc.pages : [];
    return {
      formatVersion: doc.formatVersion ?? 2,
      pageCount: doc.pageCount ?? pages.length,
      pages: pages.map((p, i) => ({
        page: p.page ?? i + 1,
        panels: Array.isArray(p.panels) ? p.panels : [],
      })),
    };
  }

  return { formatVersion: 1, pageCount: 0, pages: [] };
}

export function serializeComicDocument(doc: ComicDocument): string {
  return JSON.stringify({
    formatVersion: 2,
    pageCount: doc.pageCount,
    pages: doc.pages,
  });
}

export function flattenPanels(doc: ComicDocument): ComicPanel[] {
  return doc.pages.flatMap((p) => p.panels);
}
