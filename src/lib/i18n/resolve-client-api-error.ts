import type { AppLocale } from "@/i18n/routing";
import { apiErrorMessage } from "@/lib/i18n/progress-message";

export type ClientApiErrorPayload = {
  error?: string;
  errorKey?: string;
  errorParams?: Record<string, string | number | undefined | null>;
};

/** 优先用 errorKey 按当前 UI locale 解析；否则回退服务端 error 文本。 */
export function resolveClientApiError(
  locale: AppLocale,
  payload: ClientApiErrorPayload | null | undefined,
  fallbackKey = "generateFailed",
): string {
  if (payload?.errorKey) {
    return apiErrorMessage(locale, payload.errorKey, payload.errorParams);
  }
  const text = payload?.error?.trim();
  if (text) return text;
  return apiErrorMessage(locale, fallbackKey);
}
