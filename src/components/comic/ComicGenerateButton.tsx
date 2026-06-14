"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { ComicChapterScope } from "@/lib/comic-chapter-scope";
import type { ComicCharacterRoster } from "@/lib/comic-character-roster";
import type { ComicReadMode } from "@/lib/comic-format";
import type { ComicGenerateStreamBody } from "@/lib/comic-generate-request";
import {
  consumeComicGenerateStream,
  type ComicGenerateStreamEvent,
} from "@/lib/comic-generate-stream.client";
import { resolveComicPipelineMode } from "@/lib/comic-pipeline-mode";

type Props = {
  novelId?: string;
  content?: string;
  title?: string;
  lengthTier?: string;
  pageCount?: number;
  stylePreset?: string;
  readMode?: ComicReadMode;
  chapterScope?: ComicChapterScope | null;
  characterRoster?: ComicCharacterRoster | null;
  forceLightStoryboard?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
  onError?: (message: string) => void;
  resumeComicId?: string;
};

export function ComicGenerateButton({
  novelId,
  content,
  title,
  lengthTier,
  pageCount,
  stylePreset,
  readMode,
  chapterScope,
  characterRoster,
  forceLightStoryboard,
  label,
  className = "gc-theme-cta w-full rounded-xl px-6 py-3 text-sm font-semibold disabled:opacity-50",
  style,
  onError,
  resumeComicId,
}: Props) {
  const t = useTranslations("comicButton");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const buttonLabel = label ?? t("defaultLabel");

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setProgress(t("connecting"));
    onError?.("");

    const body: ComicGenerateStreamBody = {
      sourceMode: novelId
        ? resolveComicPipelineMode({ sourceMode: "from_novel", novelId })
        : resolveComicPipelineMode({ sourceMode: "standalone" }),
      ...(novelId ? { novelId } : {}),
      ...(content ? { content } : {}),
      ...(title ? { title } : {}),
      ...(lengthTier ? { lengthTier } : {}),
      ...(pageCount ? { pageCount } : {}),
      ...(stylePreset ? { stylePreset } : {}),
      ...(readMode ? { readMode } : {}),
      ...(chapterScope ? { chapterScope } : {}),
      ...(characterRoster?.characters.length ? { characterRoster } : {}),
      ...(forceLightStoryboard ? { forceLightStoryboard: true } : {}),
      ...(resumeComicId ? { resumeComicId } : {}),
    };

    const result = await consumeComicGenerateStream(body, (ev: ComicGenerateStreamEvent) => {
      if (ev.message) setProgress(ev.message);
    }, locale);

    setLoading(false);

    if (!result.ok) {
      onError?.(result.error);
      setProgress("");
      return;
    }

    setProgress(t("redirecting"));
    router.push(
      result.needsPanelRender
        ? `/comic/${result.comicId}?renderPanels=1`
        : `/comic/${result.comicId}`,
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className}
        style={style}
      >
        {loading ? progress || t("generating") : buttonLabel}
      </button>
    </div>
  );
}
