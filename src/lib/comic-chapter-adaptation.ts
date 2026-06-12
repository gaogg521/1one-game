import type { AppLocale } from "@/i18n/routing";
import { tMessage } from "@/lib/i18n/messages";
import type { ComicChapterScope } from "@/lib/comic-chapter-scope";
import { listChapterScopeOptions } from "@/lib/comic-chapter-scope";
import { listChildrenComicScopeOptions } from "@/lib/children-comic-sections";
import { parseComicImageUrls, type ComicDocument } from "@/lib/comic-format";

export type ComicChapterAdaptationProgress = {
  totalChapters: number;
  adaptedChapterNums: number[];
  nextChapter: ComicChapterScope | null;
  adaptedCount: number;
};

/** 从漫画 JSON 读取机器可读的章节范围 */
export function extractChapterScopeFromComicDoc(
  doc: ComicDocument,
  uiLocale: AppLocale = "zh-Hans",
): ComicChapterScope | null {
  const scope = doc.chapterScope;
  if (!scope?.fromChapter || !scope?.toChapter) return null;
  return {
    fromChapter: scope.fromChapter,
    toChapter: scope.toChapter,
    label:
      scope.label ||
      tMessage(uiLocale, "comicOptions.chapterShort", { num: scope.fromChapter }),
  };
}

/** 解析单本漫画已改编的章序号（单章 scope 取 fromChapter） */
export function adaptedChapterNumsFromComicImageUrls(imageUrls: string): number[] {
  try {
    const doc = parseComicImageUrls(imageUrls);
    const scope = extractChapterScopeFromComicDoc(doc);
    if (!scope) return [];
    if (scope.fromChapter === scope.toChapter) return [scope.fromChapter];
    const nums: number[] = [];
    for (let n = scope.fromChapter; n <= scope.toChapter; n += 1) nums.push(n);
    return nums;
  } catch {
    return [];
  }
}

/** 汇总小说下各漫画已覆盖的章 */
export function buildChapterAdaptationProgress(
  novelContent: string,
  comics: { imageUrls: string }[],
  opts?: { isChildren?: boolean; uiLocale?: AppLocale },
): ComicChapterAdaptationProgress {
  const uiLocale = opts?.uiLocale ?? "zh-Hans";
  const isChildren = opts?.isChildren ?? false;
  const chapters = isChildren
    ? listChildrenComicScopeOptions(novelContent, uiLocale).filter((ch) => ch.id !== "children-interpret")
    : listChapterScopeOptions(novelContent, { ...opts, uiLocale });
  const adapted = new Set<number>();
  for (const c of comics) {
    for (const n of adaptedChapterNumsFromComicImageUrls(c.imageUrls)) {
      adapted.add(n);
    }
  }
  const adaptedChapterNums = [...adapted].sort((a, b) => a - b);
  const storyChapters = chapters;
  const totalChapters = storyChapters.length;
  let nextChapter: ComicChapterScope | null = null;
  for (const ch of storyChapters) {
    if (!adapted.has(ch.num)) {
      nextChapter = {
        fromChapter: ch.num,
        toChapter: ch.num,
        label: ch.title,
      };
      break;
    }
  }
  return {
    totalChapters,
    adaptedChapterNums,
    nextChapter,
    adaptedCount: adaptedChapterNums.length,
  };
}

export function chapterScopeEquals(
  a: ComicChapterScope | null | undefined,
  b: ComicChapterScope | null | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.fromChapter === b.fromChapter && a.toChapter === b.toChapter;
}
