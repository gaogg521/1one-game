import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isAppLocale } from "@/i18n/routing";
import { LOCALE_COOKIE } from "@/lib/constants";

export default getRequestConfig(async () => {
  const requestHeaders = await headers();
  const headerLocale = requestHeaders.get("x-app-locale");
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale = isAppLocale(headerLocale)
    ? headerLocale
    : isAppLocale(cookieLocale)
      ? cookieLocale
      : defaultLocale;

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
