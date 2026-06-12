import type { AppLocale } from "@/i18n/routing";

const LOCALE_HEADER = "x-app-locale";

export function localeApiHeaders(locale: AppLocale): Record<string, string> {
  return { [LOCALE_HEADER]: locale };
}

export function mergeLocaleHeaders(
  locale: AppLocale,
  headers?: HeadersInit,
): Record<string, string> {
  const base: Record<string, string> = { ...localeApiHeaders(locale) };
  if (!headers) return base;
  if (headers instanceof Headers) {
    headers.forEach((v, k) => {
      base[k] = v;
    });
    return base;
  }
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) base[k] = v;
    return base;
  }
  return { ...base, ...headers };
}
