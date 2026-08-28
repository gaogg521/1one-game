"use client";

import { forwardRef, useImperativeHandle } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { cacheBustedCoverSrc, useAutoWorkCover } from "@/hooks/use-auto-work-cover";
import type { NovelReaderPalette } from "@/lib/novel-reader-theme";

export type NovelReadCoverHandle = {
  regenerate: () => void;
};

type Props = {
  novelId: string;
  coverPath: string | null;
  locale: AppLocale;
  editing: boolean;
  readPalette: NovelReaderPalette;
  onCoverUpdate: (coverPath: string) => void;
  onCoverFailed?: (message?: string) => void;
  onRegenerateSettled?: () => void;
};

export const NovelReadCoverThumb = forwardRef<NovelReadCoverHandle, Props>(
  function NovelReadCoverThumb(
    {
      novelId,
      coverPath,
      locale,
      editing,
      readPalette,
      onCoverUpdate,
      onCoverFailed,
      onRegenerateSettled,
    },
    ref,
  ) {
    const t = useTranslations("novelRead");
    const { displayCover, coverCacheKey, coverFailed, coverPending, retryCover, markCoverBroken } =
      useAutoWorkCover({
        kind: "novel",
        id: novelId,
        coverPath,
        locale,
        autoFetch: !editing,
        onUpdated: (path) => {
          onCoverUpdate(path);
          onRegenerateSettled?.();
        },
        onFailed: (_reason, message) => {
          onCoverFailed?.(message);
          onRegenerateSettled?.();
        },
      });

    useImperativeHandle(ref, () => ({ regenerate: () => retryCover() }), [retryCover]);

    const shown = editing ? coverPath : displayCover;

    if (shown) {
      return (
        <img
          src={editing ? shown : cacheBustedCoverSrc(shown, coverCacheKey)}
          alt=""
          className="h-[4.5rem] w-12 shrink-0 rounded-md object-cover shadow-sm"
          style={!editing ? { boxShadow: `0 0 0 1px ${readPalette.border}` } : undefined}
          onError={() => {
            if (!editing) markCoverBroken();
          }}
        />
      );
    }

    if (coverPending) {
      return (
        <div
          className={`flex h-[4.5rem] w-12 shrink-0 items-center justify-center rounded-md text-[10px] ${editing ? "bg-[var(--gc-surface-glass)] text-[var(--gc-muted)]" : ""}`}
          style={
            !editing
              ? {
                  backgroundColor: `color-mix(in srgb, ${readPalette.text} 8%, transparent)`,
                  color: readPalette.muted,
                }
              : undefined
          }
        >
          {t("cover")}
        </div>
      );
    }

    if (coverFailed && !editing) {
      return (
        <button
          type="button"
          onClick={() => retryCover()}
          className="flex h-[4.5rem] w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md text-[9px] leading-tight"
          style={{
            backgroundColor: `color-mix(in srgb, ${readPalette.text} 8%, transparent)`,
            color: readPalette.muted,
            boxShadow: `0 0 0 1px ${readPalette.border}`,
          }}
          title={t("coverFailed")}
        >
          <span aria-hidden>⚠</span>
          <span>{t("coverBroken")}</span>
        </button>
      );
    }

    return null;
  },
);
