import type { NovelLengthTier } from "@/lib/novel-length";
import type { ComicStylePresetId } from "@/lib/comic-style-presets";

/** 漫画页分格版式 */
export type ComicLayoutId = "grid_4" | "picture_book_5";

export type ComicLayoutDef = {
  id: ComicLayoutId;
  label: string;
  panelsPerPage: number;
  /** 每页行描述（供分镜 LLM 理解阅读顺序） */
  layoutGuideZh: string;
};

export const COMIC_LAYOUTS: Record<ComicLayoutId, ComicLayoutDef> = {
  grid_4: {
    id: "grid_4",
    label: "四宫格",
    panelsPerPage: 4,
    layoutGuideZh: "每页 4 格：2×2 网格，阅读顺序左上→右上→左下→右下。",
  },
  picture_book_5: {
    id: "picture_book_5",
    label: "儿童小人书五格",
    panelsPerPage: 5,
    layoutGuideZh:
      "每页 5 格（现代儿童漫画小人书）：第1行左小格(1/3宽)+右大格(2/3宽)；第2行通栏大格；第3行左右各半。阅读顺序 1→2→3→4→5。",
  },
};

export function getComicLayout(id: ComicLayoutId): ComicLayoutDef {
  return COMIC_LAYOUTS[id];
}

export function panelsPerPageForLayout(layoutId: ComicLayoutId): number {
  return COMIC_LAYOUTS[layoutId].panelsPerPage;
}

/** 儿童短篇 → 小人书五格；其余默认四宫格 */
export function resolveComicLayoutId(opts: {
  lengthTier?: NovelLengthTier | null;
  layoutId?: ComicLayoutId | null;
}): ComicLayoutId {
  if (opts.layoutId && opts.layoutId in COMIC_LAYOUTS) return opts.layoutId;
  if (opts.lengthTier === "children") return "picture_book_5";
  return "grid_4";
}

export function resolveComicStyleForNovel(opts: {
  lengthTier?: NovelLengthTier | null;
  stylePreset?: ComicStylePresetId | null;
}): ComicStylePresetId {
  if (opts.stylePreset) return opts.stylePreset;
  if (opts.lengthTier === "children") return "children_picture_book";
  return "japanese_clean";
}
