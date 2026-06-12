import type { AppLocale } from "@/i18n/routing";
import {
  defaultChildrenComicChapterScope,
  isChildrenFormattedNovelContent,
  listChildrenComicScopeOptions,
  sliceChildrenComicByScope,
} from "@/lib/children-comic-sections";
import { comicScopeLabelMessage } from "@/lib/i18n/progress-message";
import { parseNovelChapters, type NovelChapter } from "@/lib/novel-chapters";
import { resolveComicPageCount } from "@/lib/comic-generate-config";
import type { NovelLengthTier } from "@/lib/novel-length";

export type ComicChapterScope = {
  fromChapter: number;
  toChapter: number;
  label: string;
};

export type ComicScopeListOptions = {
  /** 儿童短篇：按「创意解读 / 儿童故事」模块，不按网文章节 */
  isChildren?: boolean;
  uiLocale?: AppLocale;
};

export function listChapterScopeOptions(
  content: string,
  opts?: ComicScopeListOptions,
): Array<{ num: number; title: string }> {
  const isChildren = opts?.isChildren ?? isChildrenFormattedNovelContent(content);
  const uiLocale = opts?.uiLocale ?? "zh-Hans";
  if (isChildren) return listChildrenComicScopeOptions(content, uiLocale);
  return parseNovelChapters(content, uiLocale).map((ch) => ({ num: ch.num, title: ch.title }));
}

/** 儿童漫画：未选范围时默认仅「儿童故事」模块（用于分镜） */
export function resolveComicChapterScopeForGenerate(
  content: string,
  scope: ComicChapterScope | null | undefined,
  opts?: ComicScopeListOptions,
): ComicChapterScope | null {
  const isChildren = opts?.isChildren ?? isChildrenFormattedNovelContent(content);
  const uiLocale = opts?.uiLocale ?? "zh-Hans";
  if (!isChildren || scope) return scope ?? null;
  return defaultChildrenComicChapterScope(content, uiLocale);
}

export function sliceNovelByChapterScope(
  content: string,
  scope?: ComicChapterScope | null,
  opts?: ComicScopeListOptions,
): { content: string; chapters: NovelChapter[]; scopeLabel: string } {
  const isChildren = opts?.isChildren ?? isChildrenFormattedNovelContent(content);
  const uiLocale = opts?.uiLocale ?? "zh-Hans";
  if (isChildren) {
    const effective = resolveComicChapterScopeForGenerate(content, scope, opts);
    return sliceChildrenComicByScope(content, effective, uiLocale);
  }

  const chapters = parseNovelChapters(content);
  if (!scope || chapters.length <= 1) {
    return {
      content,
      chapters,
      scopeLabel: comicScopeLabelMessage(uiLocale, "fullBookNovel"),
    };
  }
  const from = Math.max(1, scope.fromChapter);
  const to = Math.max(from, scope.toChapter);
  const picked = chapters.filter((ch) => ch.num >= from && ch.num <= to);
  if (picked.length === 0) {
    return {
      content,
      chapters,
      scopeLabel: comicScopeLabelMessage(uiLocale, "fullBookNovel"),
    };
  }
  const body = picked.map((ch) => `=== 第${ch.num}章 ${ch.title} ===\n\n${ch.body}`).join("\n\n");
  return {
    content: body,
    chapters: picked,
    scopeLabel:
      picked.length === 1
        ? comicScopeLabelMessage(uiLocale, "chapter", { num: picked[0]!.num })
        : comicScopeLabelMessage(uiLocale, "chapterRange", { from, to }),
  };
}

export function resolvePageCountForChapterScope(opts: {
  fullContentLength: number;
  scopedContentLength: number;
  lengthTier?: NovelLengthTier | null;
  pageCount?: number | null;
}): number {
  if (typeof opts.pageCount === "number" && opts.pageCount > 0) {
    return resolveComicPageCount({ pageCount: opts.pageCount, contentLength: opts.scopedContentLength });
  }
  const ratio = opts.scopedContentLength / Math.max(1, opts.fullContentLength);
  if (ratio < 0.22) return 2;
  if (ratio < 0.45) return 4;
  return resolveComicPageCount({ lengthTier: opts.lengthTier, contentLength: opts.scopedContentLength });
}
