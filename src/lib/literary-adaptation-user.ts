import type { ComicChapterScope } from "@/lib/comic-chapter-scope";
import type { CoverGenre } from "@/lib/cover-genre";
import { coverGenreLabel } from "@/lib/i18n/cover-genre-label";
import type { AppLocale } from "@/i18n/routing";

/** 用户/PM：小说 → 漫画改编的可感知质量承诺 */
export type LiteraryAdaptationUserInfo = {
  novelTitle: string;
  chapterLabel?: string;
  /** 视觉题材（历史/穿越等），非误判都市 */
  genreVisualLabel: string;
  pipelineSummary: "key_moments" | "chapter_scope" | "full_read";
};

export function resolveLiteraryAdaptationUserInfo(opts: {
  novelTitle: string;
  chapterScope?: ComicChapterScope | null;
  chapterScopeLabel?: string;
  readMode?: string;
  storyGenre?: CoverGenre;
  uiLocale?: AppLocale;
}): LiteraryAdaptationUserInfo {
  const locale = opts.uiLocale ?? "zh-Hans";
  const genreVisualLabel = coverGenreLabel(locale, opts.storyGenre ?? "general");
  const chapterLabel =
    opts.chapterScopeLabel?.trim() ||
    (opts.chapterScope
      ? opts.chapterScope.fromChapter === opts.chapterScope.toChapter
        ? opts.chapterScope.label
        : `${opts.chapterScope.label}（${opts.chapterScope.fromChapter}–${opts.chapterScope.toChapter}）`
      : undefined);

  const pipelineSummary: LiteraryAdaptationUserInfo["pipelineSummary"] =
    opts.chapterScope && opts.chapterScope.fromChapter > 0
      ? "chapter_scope"
      : opts.readMode === "full"
        ? "full_read"
        : "key_moments";

  return {
    novelTitle: opts.novelTitle,
    chapterLabel,
    genreVisualLabel,
    pipelineSummary,
  };
}
