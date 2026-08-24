import type { AppLocale } from "@/i18n/routing";
import { detectLocaleFromAcceptLanguage, isAppLocale } from "@/i18n/routing";
import type { RuntimeLocaleGroup } from "@/lib/runtime-providers";
import { headers } from "next/headers";

const LOCALE_HEADER = "x-app-locale";

/** Chinese scripts share one cultural/model pool; other product languages use
 * the international pool. This is model policy, not UI translation. */
export function runtimeLocaleGroup(locale: AppLocale | string | undefined | null): RuntimeLocaleGroup {
  return locale === "zh-Hans" || locale === "zh-Hant" ? "zh" : "international";
}

/**
 * Generation libraries are also used by jobs, where there is no HTTP request.
 * In a request, read the already-established locale headers; outside one, leave
 * routing undefined and safely inherit the global scene route.
 */
export async function runtimeLocaleGroupForCurrentRequest(): Promise<RuntimeLocaleGroup | undefined> {
  try {
    const requestHeaders = await headers();
    const explicit = requestHeaders.get(LOCALE_HEADER);
    return runtimeLocaleGroup(isAppLocale(explicit) ? explicit : detectLocaleFromAcceptLanguage(requestHeaders.get("accept-language")));
  } catch {
    return undefined;
  }
}
