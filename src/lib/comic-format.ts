import type { ComicDirectorPack, ComicShotType } from "@/lib/comic-director-types";
import type { ComicPanelTextType } from "@/lib/comic-panel-text";
import type { ComicCharacterRoster } from "@/lib/comic-character-roster";
import type { ComicPlotDigest } from "@/lib/comic-preread";
import type { ComicAdaptationBlueprint } from "@/lib/comic-adaptation-blueprint";
import type { ComicChapterScope } from "@/lib/comic-chapter-scope";
import type { ComicLayoutId } from "@/lib/comic-layout";
import type { ComicStylePresetId } from "@/lib/comic-style-presets";
import { COMIC_MAX_PAGES } from "@/lib/comic-generate-config";

export type ComicReadMode = "segment" | "full";

export interface ComicPanel {
  scene?: number;
  caption: string;
  prompt: string;
  imageUrl?: string;
  /** 叠字类型：对白气泡 / 旁白 / 内心独白 / 场景注解 / 时间地点 */
  textType?: ComicPanelTextType;
  /** 对白说话人（textType=dialogue 时） */
  speaker?: string;
  /** 绑定的小说段落序号（splitNovelIntoSegments 的 index） */
  sourceSegmentIndex?: number;
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
  /** 全片画风预设 id */
  stylePreset?: ComicStylePresetId;
  layoutId?: ComicLayoutId;
  readMode?: ComicReadMode;
  chapterScopeLabel?: string;
  /** 机器可读：按章连载改编范围 */
  chapterScope?: ComicChapterScope;
  characterRoster?: ComicCharacterRoster;
  plotDigest?: ComicPlotDigest;
  adaptationBlueprint?: ComicAdaptationBlueprint;
  /** Character Sheet First：角色参考图 URL，跨格配图风格锚定 */
  characterSheetUrls?: string[];
  /** 分镜生成断点（draft_storyboard 时用于续跑） */
  generationProgress?: {
    chunkIndex: number;
    chunkCount: number;
    phase: "storyboard" | "panels";
  };
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
      stylePreset?: ComicStylePresetId;
      layoutId?: ComicLayoutId;
      readMode?: ComicReadMode;
      chapterScopeLabel?: string;
      chapterScope?: ComicChapterScope;
      characterRoster?: ComicCharacterRoster;
      plotDigest?: ComicPlotDigest;
      adaptationBlueprint?: ComicAdaptationBlueprint;
      characterSheetUrls?: string[];
      generationProgress?: ComicDocument["generationProgress"];
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
      ...(doc.stylePreset ? { stylePreset: doc.stylePreset } : {}),
      ...(doc.layoutId ? { layoutId: doc.layoutId } : {}),
      ...(doc.readMode ? { readMode: doc.readMode } : {}),
      ...(doc.chapterScopeLabel ? { chapterScopeLabel: doc.chapterScopeLabel } : {}),
      ...(doc.chapterScope ? { chapterScope: doc.chapterScope } : {}),
      ...(doc.characterRoster ? { characterRoster: doc.characterRoster } : {}),
      ...(doc.plotDigest ? { plotDigest: doc.plotDigest } : {}),
      ...(doc.adaptationBlueprint ? { adaptationBlueprint: doc.adaptationBlueprint } : {}),
      ...(doc.characterSheetUrls?.length ? { characterSheetUrls: doc.characterSheetUrls } : {}),
      ...(doc.generationProgress ? { generationProgress: doc.generationProgress } : {}),
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
    ...(doc.stylePreset ? { stylePreset: doc.stylePreset } : {}),
    ...(doc.layoutId ? { layoutId: doc.layoutId } : {}),
    ...(doc.readMode ? { readMode: doc.readMode } : {}),
    ...(doc.chapterScopeLabel ? { chapterScopeLabel: doc.chapterScopeLabel } : {}),
    ...(doc.chapterScope ? { chapterScope: doc.chapterScope } : {}),
    ...(doc.characterRoster ? { characterRoster: doc.characterRoster } : {}),
    ...(doc.plotDigest ? { plotDigest: doc.plotDigest } : {}),
    ...(doc.adaptationBlueprint ? { adaptationBlueprint: doc.adaptationBlueprint } : {}),
    ...(doc.characterSheetUrls?.length ? { characterSheetUrls: doc.characterSheetUrls } : {}),
    ...(doc.generationProgress ? { generationProgress: doc.generationProgress } : {}),
  });
}

export function flattenPanels(doc: ComicDocument): ComicPanel[] {
  return doc.pages.flatMap((p) => p.panels);
}

/** 在同一页内调整分镜格顺序（0-based panel 索引） */
export function reorderComicPanelsInPage(
  doc: ComicDocument,
  pageIndex: number,
  fromIndex: number,
  toIndex: number,
): ComicDocument | null {
  if (pageIndex < 0 || pageIndex >= doc.pages.length) return null;
  const page = doc.pages[pageIndex];
  if (!page) return null;
  const { panels } = page;
  if (
    fromIndex < 0 ||
    fromIndex >= panels.length ||
    toIndex < 0 ||
    toIndex >= panels.length ||
    fromIndex === toIndex
  ) {
    return null;
  }

  const nextPanels = [...panels];
  const [moved] = nextPanels.splice(fromIndex, 1);
  if (!moved) return null;
  nextPanels.splice(toIndex, 0, moved);

  const pages = doc.pages.map((p, i) =>
    i === pageIndex ? { ...p, panels: nextPanels } : p,
  );
  return { ...doc, pages, pageCount: pages.length };
}

export function emptyComicPanel(): ComicPanel {
  return { caption: "", prompt: "" };
}

/** 跨页或同页移动分镜格（0-based 索引；toPanelIndex 可等于目标页 panel 数表示追加到末尾） */
export function moveComicPanel(
  doc: ComicDocument,
  fromPageIndex: number,
  fromPanelIndex: number,
  toPageIndex: number,
  toPanelIndex: number,
): ComicDocument | null {
  if (fromPageIndex === toPageIndex) {
    return reorderComicPanelsInPage(doc, fromPageIndex, fromPanelIndex, toPanelIndex);
  }
  if (
    fromPageIndex < 0 ||
    fromPageIndex >= doc.pages.length ||
    toPageIndex < 0 ||
    toPageIndex >= doc.pages.length
  ) {
    return null;
  }
  const fromPage = doc.pages[fromPageIndex];
  const toPage = doc.pages[toPageIndex];
  if (!fromPage || !toPage) return null;
  if (fromPanelIndex < 0 || fromPanelIndex >= fromPage.panels.length) return null;
  if (toPanelIndex < 0 || toPanelIndex > toPage.panels.length) return null;

  const fromPanels = [...fromPage.panels];
  const [moved] = fromPanels.splice(fromPanelIndex, 1);
  if (!moved) return null;
  if (fromPanels.length === 0) return null;

  const toPanels = [...toPage.panels];
  toPanels.splice(Math.min(toPanelIndex, toPanels.length), 0, moved);

  const pages = doc.pages.map((p, i) => {
    if (i === fromPageIndex) return { ...p, panels: fromPanels };
    if (i === toPageIndex) return { ...p, panels: toPanels };
    return p;
  });
  return { ...doc, pages, pageCount: pages.length };
}

/** 在指定页插入空白分镜格（afterPanelIndex 缺省则追加到页末） */
export function addComicPanel(
  doc: ComicDocument,
  pageIndex: number,
  afterPanelIndex?: number,
): ComicDocument | null {
  const page = doc.pages[pageIndex];
  if (!page) return null;
  const panels = [...page.panels];
  const insertAt =
    afterPanelIndex === undefined || afterPanelIndex < 0
      ? panels.length
      : Math.min(afterPanelIndex + 1, panels.length);
  panels.splice(insertAt, 0, emptyComicPanel());
  const pages = doc.pages.map((p, i) => (i === pageIndex ? { ...p, panels } : p));
  return { ...doc, pages, pageCount: pages.length };
}

/** 删除分镜格；若页变空则移除该页（至少保留 1 格） */
export function removeComicPanel(
  doc: ComicDocument,
  pageIndex: number,
  panelIndex: number,
): ComicDocument | null {
  const totalPanels = doc.pages.reduce((n, p) => n + p.panels.length, 0);
  if (totalPanels <= 1) return null;
  const page = doc.pages[pageIndex];
  if (!page || panelIndex < 0 || panelIndex >= page.panels.length) return null;

  const panels = page.panels.filter((_, i) => i !== panelIndex);
  if (panels.length === 0) {
    if (doc.pages.length <= 1) return null;
    const pages = doc.pages
      .filter((_, i) => i !== pageIndex)
      .map((p, i) => ({ ...p, page: i + 1 }));
    return { ...doc, pages, pageCount: pages.length };
  }

  const pages = doc.pages.map((p, i) => (i === pageIndex ? { ...p, panels } : p));
  return { ...doc, pages, pageCount: pages.length };
}

export type ComicPanelTextPatch = {
  speaker?: string;
  caption?: string;
  prompt?: string;
};

/** 更新单格分镜文本（speaker / caption / prompt） */
export function updateComicPanelFields(
  doc: ComicDocument,
  pageIndex: number,
  panelIndex: number,
  patch: ComicPanelTextPatch,
): ComicDocument | null {
  const page = doc.pages[pageIndex];
  if (!page || panelIndex < 0 || panelIndex >= page.panels.length) return null;

  const hasPatch =
    patch.speaker !== undefined || patch.caption !== undefined || patch.prompt !== undefined;
  if (!hasPatch) return null;

  const panels = page.panels.map((panel, i) => {
    if (i !== panelIndex) return panel;
    return {
      ...panel,
      ...(patch.speaker !== undefined ? { speaker: patch.speaker } : {}),
      ...(patch.caption !== undefined ? { caption: patch.caption } : {}),
      ...(patch.prompt !== undefined ? { prompt: patch.prompt } : {}),
    };
  });

  const pages = doc.pages.map((p, i) => (i === pageIndex ? { ...p, panels } : p));
  return { ...doc, pages, pageCount: pages.length };
}

function renumberComicPages(pages: ComicPage[]): ComicPage[] {
  return pages.map((p, i) => ({ ...p, page: i + 1 }));
}

/** 在指定页后插入空白页（含 1 格）；afterPageIndex 缺省则追加到末尾 */
export function addComicPage(
  doc: ComicDocument,
  afterPageIndex?: number,
  maxPages: number = COMIC_MAX_PAGES,
): ComicDocument | null {
  if (doc.pages.length >= maxPages) return null;
  const insertAt =
    afterPageIndex === undefined || afterPageIndex < 0
      ? doc.pages.length
      : Math.min(afterPageIndex + 1, doc.pages.length);
  const pages = [...doc.pages];
  pages.splice(insertAt, 0, { page: insertAt + 1, panels: [emptyComicPanel()] });
  const renumbered = renumberComicPages(pages);
  return { ...doc, pages: renumbered, pageCount: renumbered.length };
}

/** 合并相邻页：pageIndex 与 pageIndex+1；至少保留 1 页 */
export function mergeComicPages(doc: ComicDocument, pageIndex: number): ComicDocument | null {
  if (doc.pages.length <= 1) return null;
  if (pageIndex < 0 || pageIndex >= doc.pages.length - 1) return null;
  const page = doc.pages[pageIndex];
  const next = doc.pages[pageIndex + 1];
  if (!page || !next) return null;

  const mergedPanels = [...page.panels, ...next.panels];
  if (mergedPanels.length === 0) return null;

  const pages = [
    ...doc.pages.slice(0, pageIndex),
    { ...page, panels: mergedPanels },
    ...doc.pages.slice(pageIndex + 2),
  ];
  const renumbered = renumberComicPages(pages);
  return { ...doc, pages: renumbered, pageCount: renumbered.length };
}
