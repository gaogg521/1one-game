import type { AppLocale } from "@/i18n/routing";
import { apiErrorMessage, progressComicMessage } from "@/lib/i18n/progress-message";

export type ComicGenerateErrorKey = "novelNotFound" | "comicNovelForbidden" | "needNovelOrContent";

export class ComicGenerateError extends Error {
  constructor(
    readonly errorKey: ComicGenerateErrorKey,
    readonly status: number,
  ) {
    super(errorKey);
    this.name = "ComicGenerateError";
  }
}

export class ComicGenerationRunError extends Error {
  constructor(
    readonly messageKey: string,
    readonly params?: Record<string, string | number | undefined | null>,
  ) {
    super(messageKey);
    this.name = "ComicGenerationRunError";
  }
}

export function resolveComicRunErrorMessage(locale: AppLocale, err: unknown): string {
  if (err instanceof ComicGenerateError) {
    return apiErrorMessage(locale, err.errorKey);
  }
  if (err instanceof ComicGenerationRunError) {
    return progressComicMessage(locale, err.messageKey, err.params);
  }
  return progressComicMessage(locale, "comicFailed");
}
