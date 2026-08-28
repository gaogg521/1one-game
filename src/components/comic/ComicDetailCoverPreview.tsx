"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { comicCoverDetailFrameClass } from "@/lib/cover-display-sizes";
import { comicCoverFromImageUrls } from "@/lib/comic-display";
import { cacheBustedCoverSrc, useAutoWorkCover, WorkCoverPlaceholder } from "@/hooks/use-auto-work-cover";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";
import { superAdminFetchInit } from "@/lib/super-admin-client";

type Props = {
  comicId: string;
  title: string;
  coverPath: string | null;
  imageUrls: string;
  locale: AppLocale;
  isOwner?: boolean;
  onCoverUpdate?: (coverPath: string) => void;
  onCoverError?: (message: string) => void;
};

export function ComicDetailCoverPreview({
  comicId,
  title,
  coverPath,
  imageUrls,
  locale,
  isOwner,
  onCoverUpdate,
  onCoverError,
}: Props) {
  const t = useTranslations("lists");
  const tr = useTranslations("comicRead");
  const panelFallback = comicCoverFromImageUrls(imageUrls);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { displayCover, coverCacheKey, coverFailed, coverPending, retryCover, markCoverBroken } = useAutoWorkCover({
    kind: "comic",
    id: comicId,
    coverPath,
    locale,
    fallbackCover: panelFallback,
    onUpdated: onCoverUpdate,
    onFailed: (_reason, message) => {
      if (message) onCoverError?.(message);
    },
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/comic/${encodeURIComponent(comicId)}/cover`,
        superAdminFetchInit({
          method: "PUT",
          headers: mergeLocaleHeaders(locale),
          body: fd,
        }),
      );
      const data = (await res.json().catch(() => ({}))) as {
        coverPath?: string;
        error?: string;
        errorKey?: string;
        errorParams?: Record<string, string | number>;
      };
      if (!res.ok || !data.coverPath) {
        onCoverError?.(resolveClientApiError(locale, data, "coverSaveFailed"));
        return;
      }
      onCoverUpdate?.(data.coverPath);
    } catch {
      onCoverError?.(tr("coverUploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${comicCoverDetailFrameClass} rounded-xl border border-[color:var(--gc-border)] shadow-md`}>
        {displayCover ? (
          <img
            src={cacheBustedCoverSrc(displayCover, coverCacheKey)}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={markCoverBroken}
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
      {isOwner ? (
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => retryCover()}
            disabled={coverPending || uploading}
            className="rounded-lg border border-[color:var(--gc-border)] px-3 py-1.5 text-xs font-medium text-[var(--gc-muted)] disabled:opacity-50"
          >
            {coverPending ? tr("coverGenerating") : tr("regenerateCover")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={coverPending || uploading}
            className="rounded-lg border border-[color:var(--gc-border)] px-3 py-1.5 text-xs font-medium text-[var(--gc-muted)] disabled:opacity-50"
          >
            {uploading ? tr("coverUploading") : tr("uploadCover")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
