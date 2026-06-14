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
  if (err instanceof Error) {
    const msg = err.message.trim();
    // 保留 LLM/分镜层抛出的可读文案，避免一律显示「漫画生成失败」
    if (msg && msg !== "Error" && !/^[a-z][a-zA-Z0-9]*$/.test(msg)) {
      return msg.slice(0, 240);
    }
  }
  return progressComicMessage(locale, "comicFailed");
}
