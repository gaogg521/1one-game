import type { AppLocale } from "@/i18n/routing";
import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { getMessages } from "@/lib/i18n/messages";
import type { ChildrenAgeTierId, ChildrenTargetAge } from "@/lib/children-age-length";
import { getChildrenAgeTier } from "@/lib/children-age-length";

export function briefLocaleToAppLocale(locale: BriefInputLocale | AppLocale): AppLocale {
  if (locale === "zh-Hant") return "zh-Hant";
  if (locale === "en" || locale === "ms" || locale === "th") return locale;
  return "zh-Hans";
}

type GenreTagEntry = { label: string; desc: string };

export function getLocalizedGenreTagFromMessages(
  tagId: string,
  locale: BriefInputLocale | AppLocale,
): GenreTagEntry | null {
  const appLocale = briefLocaleToAppLocale(locale);
  const messages = getMessages(appLocale);
  const entry = (messages as { genreTags?: Record<string, GenreTagEntry> }).genreTags?.[tagId];
  return entry ?? null;
}

type ChildrenAgeEntry = {
  label: string;
  stage: string;
  charRangeLabel: string;
  features: string;
};

export function getLocalizedChildrenAgeTier(
  age: ChildrenTargetAge,
  locale: AppLocale,
): ChildrenAgeEntry {
  const tier = getChildrenAgeTier(age);
  const messages = getMessages(locale);
  const entry = (messages as { childrenAge?: Record<ChildrenAgeTierId, ChildrenAgeEntry> }).childrenAge?.[
    tier.tierId
  ];
  if (entry) return entry;
  return {
    label: tier.label,
    stage: tier.stage,
    charRangeLabel: tier.charRangeLabel,
    features: tier.features,
  };
}

export function localizedChildrenAgeLabel(age: ChildrenTargetAge, locale: AppLocale): string {
  return getLocalizedChildrenAgeTier(age, locale).label;
}

export function localizedChildrenStageLabel(age: ChildrenTargetAge, locale: AppLocale): string {
  return getLocalizedChildrenAgeTier(age, locale).stage;
}

export function localizedChildrenCharRangeLabel(age: ChildrenTargetAge, locale: AppLocale): string {
  return getLocalizedChildrenAgeTier(age, locale).charRangeLabel;
}

export function localizedChildrenFeaturesLabel(age: ChildrenTargetAge, locale: AppLocale): string {
  return getLocalizedChildrenAgeTier(age, locale).features;
}

export function localizedReaderThemeLabel(themeId: string, locale: AppLocale): string {
  const messages = getMessages(locale);
  const label = (messages as { readerThemes?: Record<string, string> }).readerThemes?.[themeId];
  return label ?? themeId;
}
