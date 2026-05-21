"use client";

import { useEffect, useState } from "react";
import { ComicGenerateButton } from "@/components/comic/ComicGenerateButton";
import {
  ComicGenerateOptions,
  defaultComicGenerateOptions,
  type ComicGenerateOptionsState,
} from "@/components/comic/ComicGenerateOptions";
import { isChildrenNovelTier, parseNovelLengthTier, resolveNovelLengthTier } from "@/lib/novel-length";
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
}: Props) {
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
      {showOptions ? (
        <ComicGenerateOptions
          novelId={novelId}
          novelContent={novelContent}
          lengthTier={lengthTier}
          novelPrompt={novelPrompt}
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
        className={className}
        style={style}
        onError={onError}
      />
    </div>
  );
}
