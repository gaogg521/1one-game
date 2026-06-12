"use client";

import { useTranslations } from "next-intl";
import type { ComicChapterAdaptationProgress } from "@/lib/comic-chapter-adaptation";
import type { ComicChapterScope } from "@/lib/comic-chapter-scope";

type Props = {
  progress: ComicChapterAdaptationProgress;
  draftComics?: { id: string; title: string }[];
  onContinueNext?: (scope: ComicChapterScope) => void;
  onResumeDraft?: (comicId: string) => void;
};

export function ComicChapterAdaptationBanner({
  progress,
  draftComics = [],
  onContinueNext,
  onResumeDraft,
}: Props) {
  const t = useTranslations("comicBanner");
  const { totalChapters, adaptedCount, nextChapter } = progress;
  if (totalChapters <= 1 && adaptedCount === 0 && draftComics.length === 0) return null;

  const pct =
    totalChapters > 0 ? Math.min(100, Math.round((adaptedCount / totalChapters) * 100)) : 0;

  return (
    <div className="rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_22%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_6%,transparent)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--gc-text)]">{t("title")}</p>
          <p className="mt-1 text-[11px] text-[var(--gc-muted)]">
            {t("adapted", { adapted: adaptedCount, total: totalChapters })}
            {adaptedCount > 0 ? t("percent", { pct }) : ""}
            {nextChapter ? t("nextChapter", { label: nextChapter.label }) : t("allCovered")}
          </p>
          {totalChapters > 1 ? (
            <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--gc-border)_80%,transparent)]">
              <div
                className="h-full rounded-full bg-[color:color-mix(in_srgb,var(--gc-accent)_75%,white)] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {draftComics.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onResumeDraft?.(d.id)}
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-200"
            >
              {t("resumeDraft")}
            </button>
          ))}
          {nextChapter && onContinueNext ? (
            <button
              type="button"
              onClick={() => onContinueNext(nextChapter)}
              className="gc-theme-cta rounded-lg px-3 py-1.5 text-[11px] font-semibold"
            >
              {t("adaptNext")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
