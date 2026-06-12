import type { AppLocale } from "@/i18n/routing";
import { tMessage } from "@/lib/i18n/messages";

/** Server-side SSE / API progress copy under `progressNovel.*` / `progressComic.*`. */
export function progressNovelMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `progressNovel.${key}`, params);
}

export function progressComicMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `progressComic.${key}`, params);
}

export function apiErrorMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `apiErrors.${key}`, params);
}

export function clientErrorMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `clientErrors.${key}`, params);
}

export function comicPanelProgressMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `comicPanelProgress.${key}`, params);
}

export function creativeBriefBulletMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `creativeBriefBullets.${key}`, params);
}

export function ingestWarningMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `ingestWarnings.${key}`, params);
}

export function assetGenMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `assetGen.${key}`, params);
}

export function novelCompletenessMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `novelCompleteness.${key}`, params);
}

export function novelConsistencyMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `novelConsistency.${key}`, params);
}

export function comicConsistencyMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `comicConsistency.${key}`, params);
}

/** Comic chapter scope labels for SSE / API (uses existing `comicOptions.*` keys). */
export function comicScopeLabelMessage(
  locale: AppLocale,
  kind: "fullBookNovel" | "fullBookChildren" | "chapter" | "chapterRange",
  params?: { num?: number; from?: number; to?: number },
): string {
  switch (kind) {
    case "fullBookNovel":
      return tMessage(locale, "comicOptions.modeAllNovel");
    case "fullBookChildren":
      return tMessage(locale, "comicOptions.modeAllChildren");
    case "chapter":
      return tMessage(locale, "comicOptions.chapterShort", { num: params?.num ?? 1 });
    case "chapterRange":
      return tMessage(locale, "comicOptions.chapterRange", {
        from: params?.from ?? 1,
        to: params?.to ?? 1,
      });
  }
}
