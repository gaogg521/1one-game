"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ComicGenerateButton } from "@/components/comic/ComicGenerateButton";
import {
  ComicGenerateOptions,
  defaultComicGenerateOptions,
  type ComicGenerateOptionsState,
} from "@/components/comic/ComicGenerateOptions";
import { isChildrenNovelTier, parseNovelLengthTier, resolveNovelLengthTier } from "@/lib/novel-length";
import type { ComicChapterScope } from "@/lib/comic-chapter-scope";
import { inferNovelGenreTagFromStoredPrompt } from "@/lib/novel-genre-tags";

type Props = {
  novelId?: string;
  novelContent?: string;
  novelPrompt?: string;
  lengthTier?: string;
  pageCount?: number;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  onError?: (message: string) => void;
  showOptions?: boolean;
  initialChapterScope?: ComicChapterScope | null;
  resumeComicId?: string;
};

export function ComicGeneratePanel({
  novelId,
  novelContent,
  novelPrompt,
  lengthTier,
  pageCount,
  label,
  className,
  style,
  onError,
  showOptions = true,
  initialChapterScope,
  resumeComicId,
}: Props) {
  const t = useTranslations("comicPanel");
  const genreFromPrompt = inferNovelGenreTagFromStoredPrompt(novelPrompt ?? "");
  const isChildren = isChildrenNovelTier(
    resolveNovelLengthTier({ genreTagId: genreFromPrompt?.id, lengthTierPick: lengthTier }),
  );
  const [opts, setOpts] = useState<ComicGenerateOptionsState>(() =>
    isChildren
      ? { ...defaultComicGenerateOptions(), stylePreset: "children_picture_book" }
      : defaultComicGenerateOptions(),
  );

  useEffect(() => {
    if (isChildren) {
      setOpts((prev) =>
        prev.stylePreset === "children_picture_book"
          ? prev
          : { ...prev, stylePreset: "children_picture_book" },
      );
    }
  }, [isChildren]);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_22%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_6%,transparent)] px-4 py-3 text-xs leading-relaxed text-[var(--gc-text-soft)]">
        <p className="font-medium text-[var(--gc-text)]">{t("consistencyTitle")}</p>
        <p className="mt-1 text-[var(--gc-muted)]">{t("consistencyBody")}</p>
      </div>
      {showOptions ? (
        <ComicGenerateOptions
          novelId={novelId}
          novelContent={novelContent}
          lengthTier={lengthTier}
          novelPrompt={novelPrompt}
          initialChapterScope={initialChapterScope}
          value={opts}
          onChange={setOpts}
          compact={!novelId}
        />
      ) : null}
      <ComicGenerateButton
        novelId={novelId}
        lengthTier={lengthTier}
        pageCount={pageCount}
        stylePreset={opts.stylePreset}
        readMode={opts.readMode}
        chapterScope={opts.chapterScope}
        characterRoster={opts.characterRoster}
        label={label}
        className={
          className ??
          "gc-theme-cta w-full rounded-xl px-6 py-3 text-sm font-semibold text-[var(--gc-text)] disabled:opacity-50"
        }
        style={style}
        onError={onError}
        resumeComicId={resumeComicId}
      />
      {resumeComicId ? (
        <p className="text-[11px] text-amber-300/90">{t("resumeCheckpoint")}</p>
      ) : null}
    </div>
  );
}
