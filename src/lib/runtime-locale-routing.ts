import type { AppLocale } from "@/i18n/routing";
import { detectLocaleFromAcceptLanguage, isAppLocale } from "@/i18n/routing";
import type { RuntimeLocaleGroup } from "@/lib/runtime-providers";

const LOCALE_HEADER = "x-app-locale";

/** Chinese scripts share one cultural/model pool; other product languages use
 * the international pool. This is model policy, not UI translation. */
export function runtimeLocaleGroup(locale: AppLocale | string | undefined | null): RuntimeLocaleGroup {
  const v = (locale ?? "").trim().toLowerCase();
  if (v === "zh" || v === "zh-hans" || v === "zh-hant" || v.startsWith("zh-")) return "zh";
  return "international";
}

/**
 * Generation libraries are also used by jobs, where there is no HTTP request.
 * In a request, read the already-established locale headers; outside one, leave
 * routing undefined and safely inherit the global scene route.
 */
export async function runtimeLocaleGroupForCurrentRequest(): Promise<RuntimeLocaleGroup | undefined> {
  try {
    // This helper is reached through shared generation utilities that also have
    // client-side consumers. Keep the App Router-only API out of that static
    // client graph, while still loading it normally for server requests.
    const nextHeadersModule = "next/headers";
    const { headers } = await import(nextHeadersModule);
    const requestHeaders = await headers();
    const explicit = requestHeaders.get(LOCALE_HEADER);
    return runtimeLocaleGroup(isAppLocale(explicit) ? explicit : detectLocaleFromAcceptLanguage(requestHeaders.get("accept-language")));
  } catch {
    return undefined;
  }
}
