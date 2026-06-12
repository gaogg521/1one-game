import type { AppLocale } from "@/i18n/routing";
import { getLocalePrefix, stripLocalePrefix } from "@/i18n/routing";

export function withLocalePath(pathname: string, locale: AppLocale): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const { pathname: barePath } = stripLocalePrefix(normalized);
  return barePath === "/" ? getLocalePrefix(locale) : `${getLocalePrefix(locale)}${barePath}`;
}
