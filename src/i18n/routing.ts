export const locales = ["zh-Hans", "zh-Hant", "en", "ms", "th"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "zh-Hans";

export const localeLabels: Record<AppLocale, string> = {
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
  ms: "Bahasa Melayu",
  th: "ไทย",
};

export const localeShortLabels: Record<AppLocale, string> = {
  "zh-Hans": "简",
  "zh-Hant": "繁",
  en: "EN",
  ms: "MS",
  th: "TH",
};

const browserLocaleMap: Array<{ pattern: RegExp; locale: AppLocale }> = [
  { pattern: /^zh(-(hans|cn|sg))?$/i, locale: "zh-Hans" },
  { pattern: /^zh-(hant|tw|hk|mo)$/i, locale: "zh-Hant" },
  { pattern: /^en(-|$)/i, locale: "en" },
  { pattern: /^ms(-|$)/i, locale: "ms" },
  { pattern: /^th(-|$)/i, locale: "th" },
];

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return Boolean(value && locales.includes(value as AppLocale));
}

export function detectLocaleFromAcceptLanguage(headerValue: string | null | undefined): AppLocale {
  if (!headerValue) return defaultLocale;

  const candidates = headerValue
    .split(",")
    .map((entry) => entry.trim().split(";")[0]?.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    for (const item of browserLocaleMap) {
      if (item.pattern.test(candidate)) return item.locale;
    }
  }

  return defaultLocale;
}

export function getLocalePrefix(locale: AppLocale): string {
  return `/${locale}`;
}

export function stripLocalePrefix(pathname: string): { locale: AppLocale | null; pathname: string } {
  for (const locale of locales) {
    const prefix = getLocalePrefix(locale);
    if (pathname === prefix) {
      return { locale, pathname: "/" };
    }
    if (pathname.startsWith(`${prefix}/`)) {
      return { locale, pathname: pathname.slice(prefix.length) || "/" };
    }
  }
  return { locale: null, pathname };
}

export function localeToHtmlLang(locale: AppLocale): string {
  switch (locale) {
    case "zh-Hant":
      return "zh-Hant";
    case "en":
      return "en";
    case "ms":
      return "ms";
    case "th":
      return "th";
    default:
      return "zh-Hans";
  }
}

export function localeToIntlTag(locale: AppLocale): string {
  switch (locale) {
    case "zh-Hant":
      return "zh-TW";
    case "en":
      return "en-US";
    case "ms":
      return "ms-MY";
    case "th":
      return "th-TH";
    default:
      return "zh-CN";
  }
}
