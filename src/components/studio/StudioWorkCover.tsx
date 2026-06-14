"use client";

import { CoverThumb } from "@/components/CoverThumb";
import { useAutoWorkCover, WorkCoverPlaceholder } from "@/hooks/use-auto-work-cover";
import type { AppLocale } from "@/i18n/routing";
import { useTranslations } from "next-intl";

type LiteraryKind = "novel" | "comic";

function StudioLiteraryWorkCover({
  kind,
  id,
  coverPath,
  locale,
  coverAlt,
  className,
  icon,
  fallbackCover,
  onCoverUpdate,
}: {
  kind: LiteraryKind;
  id: string;
  coverPath: string | null;
  locale: AppLocale;
  coverAlt: string;
  className?: string;
  icon: string;
  fallbackCover?: string | null;
  onCoverUpdate?: (coverPath: string) => void;
}) {
  const t = useTranslations();
  const { displayCover, coverFailed, coverPending, retryCover } = useAutoWorkCover({
    kind,
    id,
    coverPath,
    locale,
    fallbackCover,
    onUpdated: onCoverUpdate,
  });

  return (
    <CoverThumb
      coverPath={displayCover}
      alt={coverAlt}
      className={className}
      placeholder={
        <div className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-bg))] to-[color:color-mix(in_srgb,var(--gc-cyan)_18%,var(--gc-bg))]">
          <WorkCoverPlaceholder
            icon={icon}
            failedLabel={t("lists.coverFailed")}
            generatingLabel={t("studio.coverGenerating")}
            retryLabel={t("lists.coverRetry")}
            coverFailed={coverFailed}
            coverPending={coverPending}
            onRetry={retryCover}
            testId={`studio-cover-retry-${kind}-${id}`}
          />
        </div>
      }
    />
  );
}

export function StudioWorkCover({
  type,
  id,
  coverPath,
  locale,
  coverAlt,
  className,
  icon,
  fallbackCover,
  onCoverUpdate,
}: {
  type: "project" | "novel" | "comic";
  id: string;
  coverPath: string | null;
  locale: AppLocale;
  coverAlt: string;
  className?: string;
  icon: string;
  fallbackCover?: string | null;
  onCoverUpdate?: (coverPath: string) => void;
}) {
  const t = useTranslations();

  if (type === "novel" || type === "comic") {
    return (
      <StudioLiteraryWorkCover
        kind={type}
        id={id}
        coverPath={coverPath}
        locale={locale}
        coverAlt={coverAlt}
        className={className}
        icon={icon}
        fallbackCover={fallbackCover}
        onCoverUpdate={onCoverUpdate}
      />
    );
  }

  return (
    <CoverThumb
      coverPath={coverPath}
      alt={coverAlt}
      className={className}
      placeholder={
        <div className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-bg))] to-[color:color-mix(in_srgb,var(--gc-cyan)_18%,var(--gc-bg))]">
          <span className="text-3xl opacity-50" aria-hidden>
            {icon}
          </span>
          <span className="text-[11px] font-medium text-[var(--gc-text-faint)]">
            {t("studio.autoCover")}
          </span>
        </div>
      }
    />
  );
}
