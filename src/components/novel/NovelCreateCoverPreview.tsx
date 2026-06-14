"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { useAutoWorkCover, WorkCoverPlaceholder } from "@/hooks/use-auto-work-cover";
import type { NovelReadCoverHandle } from "@/components/novel/NovelReadCoverThumb";
import {
  novelCoverPreviewFrameClass,
  novelCoverPreviewHeightClass,
} from "@/lib/cover-display-sizes";

type Props = {
  novelId: string;
  coverPath: string | null;
  locale: AppLocale;
  onCoverUpdate: (coverPath: string) => void;
  onCoverFailed?: (message: string) => void;
  onRegenerateSettled?: () => void;
  onPendingChange?: (pending: boolean) => void;
};

export const NovelCreateCoverPreview = forwardRef<NovelReadCoverHandle, Props>(
  function NovelCreateCoverPreview(
    { novelId, coverPath, locale, onCoverUpdate, onCoverFailed, onRegenerateSettled, onPendingChange },
    ref,
  ) {
    const t = useTranslations("novelCreatePage");
    const tl = useTranslations("lists");
    const [cacheKey, setCacheKey] = useState(0);

    const handleFailed = (reason: "timeout" | "api" | "network" | "empty") => {
      const message = reason === "timeout" ? t("coverTimeout") : t("coverFailed");
      onCoverFailed?.(message);
      onRegenerateSettled?.();
    };

    const { displayCover, coverFailed, coverPending, retryCover } = useAutoWorkCover({
      kind: "novel",
      id: novelId,
      coverPath,
      locale,
      fetchTimeoutMs: 180_000,
      onUpdated: (path) => {
        setCacheKey((k) => k + 1);
        onCoverUpdate(path);
        onRegenerateSettled?.();
      },
      onFailed: handleFailed,
    });

    useImperativeHandle(ref, () => ({ regenerate: () => retryCover() }), [retryCover]);

    useEffect(() => {
      onPendingChange?.(coverPending);
    }, [coverPending, onPendingChange]);

    const coverSrc =
      displayCover ?
        `${displayCover}${displayCover.includes("?") ? "&" : "?"}v=${cacheKey}`
      : null;

    return (
      <>
        <div className={`${novelCoverPreviewFrameClass} ${novelCoverPreviewHeightClass}`}>
          {coverSrc ?
            <img src={coverSrc} alt={t("novelCoverAlt")} className="h-full w-full object-cover" />
          : coverPending ?
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-xs text-[var(--gc-muted)]">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--gc-accent)] border-t-transparent" />
              {t("coverDrawing")}
            </div>
          : coverFailed ?
            <WorkCoverPlaceholder
              icon="📖"
              failedLabel={t("coverFailed")}
              generatingLabel={t("coverPending")}
              retryLabel={tl("coverRetry")}
              coverFailed={coverFailed}
              coverPending={coverPending}
              onRetry={retryCover}
              testId={`novel-create-cover-retry-${novelId}`}
            />
          : <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-[var(--gc-muted)]">
              {t("coverPending")}
            </div>
          }
        </div>
        {displayCover ?
          <p className="mt-2 text-center text-[10px] text-[var(--gc-text-faint)] sm:text-left">
            {t("redoCoverHint")}
          </p>
        : null}
      </>
    );
  },
);
