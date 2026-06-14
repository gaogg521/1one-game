"use client";

import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { comicCoverDetailFrameClass } from "@/lib/cover-display-sizes";
import { comicCoverFromImageUrls } from "@/lib/comic-display";
import { useAutoWorkCover, WorkCoverPlaceholder } from "@/hooks/use-auto-work-cover";

type Props = {
  comicId: string;
  title: string;
  coverPath: string | null;
  imageUrls: string;
  locale: AppLocale;
  onCoverUpdate?: (coverPath: string) => void;
};

export function ComicDetailCoverPreview({
  comicId,
  title,
  coverPath,
  imageUrls,
  locale,
  onCoverUpdate,
}: Props) {
  const t = useTranslations("lists");
  const panelFallback = comicCoverFromImageUrls(imageUrls);
  const { displayCover, coverFailed, coverPending, retryCover } = useAutoWorkCover({
    kind: "comic",
    id: comicId,
    coverPath,
    locale,
    fallbackCover: panelFallback,
    onUpdated: onCoverUpdate,
  });

  return (
    <div className={`${comicCoverDetailFrameClass} rounded-xl border border-[color:var(--gc-border)] shadow-md`}>
      {displayCover ? (
        <img
          src={displayCover}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <WorkCoverPlaceholder
          icon="🎨"
          failedLabel={t("coverFailed")}
          generatingLabel={t("coverGenerating")}
          retryLabel={t("coverRetry")}
          coverFailed={coverFailed}
          coverPending={coverPending}
          onRetry={retryCover}
          testId={`comic-detail-cover-retry-${comicId}`}
        />
      )}
    </div>
  );
}
