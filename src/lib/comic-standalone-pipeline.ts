import type { ComicSourceMode } from "@/lib/comic-pipeline-mode";
import { PRODUCT } from "@/lib/product-config";

/** 独立漫画：正文足够长时跳过后台 Brief LLM（直接分镜） */
export function shouldSkipStandaloneComicBrief(opts: {
  sourceMode: ComicSourceMode;
  contentLength: number;
  hasInheritedBrief: boolean;
  hasUserBrief: boolean;
}): boolean {
  if (opts.sourceMode !== "standalone") return false;
  if (opts.hasInheritedBrief || opts.hasUserBrief) return false;
  const min = PRODUCT.comic.standaloneBriefSkipMinChars ?? 1500;
  return opts.contentLength >= min;
}

/** 从已有小说改编时跳过漫画 Brief 二次扩写（创作链路已扩写过的 prompt/正文）。 */
export function shouldSkipComicBriefExpand(opts: {
  sourceMode: ComicSourceMode;
  actualNovelId: string | null;
  hasBriefRevision: boolean;
  skipStandaloneBrief: boolean;
}): boolean {
  if (opts.skipStandaloneBrief) return true;
  if (opts.sourceMode === "from_novel" && opts.actualNovelId && !opts.hasBriefRevision) {
    return true;
  }
  return false;
}

/** 独立漫画生成时不按「章节改编」切 scope */
export function resolveChapterScopeForComicGenerate(
  sourceMode: ComicSourceMode,
  chapterScope: import("@/lib/comic-chapter-scope").ComicChapterScope | null | undefined,
): import("@/lib/comic-chapter-scope").ComicChapterScope | null {
  if (sourceMode === "standalone") return null;
  return chapterScope ?? null;
}

export function comicProgressStartKey(sourceMode: ComicSourceMode): "startCreate" | "startAdapt" {
  return sourceMode === "standalone" ? "startCreate" : "startAdapt";
}

export function comicProgressScopeKey(sourceMode: ComicSourceMode): "standaloneScope" | null {
  return sourceMode === "standalone" ? "standaloneScope" : null;
}

export function comicCreativeExpandKey(sourceMode: ComicSourceMode): "creativeExpandStandalone" | "creativeExpand" {
  return sourceMode === "standalone" ? "creativeExpandStandalone" : "creativeExpand";
}
