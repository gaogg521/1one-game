import { cookies } from "next/headers";
import { defaultLocale, detectLocaleFromAcceptLanguage, isAppLocale, type AppLocale } from "@/i18n/routing";
import { LOCALE_COOKIE } from "@/lib/constants";

const LOCALE_HEADER = "x-app-locale";

/** Resolve UI locale from an incoming Request (API routes / server actions). */
export async function resolveRequestLocale(req: Request): Promise<AppLocale> {
  const headerLocale = req.headers.get(LOCALE_HEADER);
  if (isAppLocale(headerLocale)) return headerLocale;

  try {
    const store = await cookies();
    const cookieLocale = store.get(LOCALE_COOKIE)?.value;
    if (isAppLocale(cookieLocale)) return cookieLocale;
  } catch {
    /* cookies() unavailable outside request context */
  }

  return detectLocaleFromAcceptLanguage(req.headers.get("accept-language"));
}

export function resolveRequestLocaleSync(req: Request): AppLocale {
  const headerLocale = req.headers.get(LOCALE_HEADER);
  if (isAppLocale(headerLocale)) return headerLocale;
  return detectLocaleFromAcceptLanguage(req.headers.get("accept-language"));
}

export function localeRequestHeaders(locale: AppLocale): HeadersInit {
  return { [LOCALE_HEADER]: locale };
}
