import type { AppLocale } from "@/i18n/routing";
import { apiErrorMessage } from "@/lib/i18n/progress-message";

/** Throw from lib helpers; API routes map to localized JSON via errorKey. */
export class ApiKeyedError extends Error {
  constructor(
    public readonly errorKey: string,
    public readonly params?: Record<string, string | number | undefined | null>,
  ) {
    super(errorKey);
    this.name = "ApiKeyedError";
  }
}

export function isApiKeyedError(e: unknown): e is ApiKeyedError {
  return e instanceof ApiKeyedError;
}

export function apiKeyedErrorText(
  locale: AppLocale,
  e: ApiKeyedError,
): string {
  return apiErrorMessage(locale, e.errorKey, e.params);
}
