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
  interpretMark?: string;
  bodyMark?: string;
  closingMark?: string;
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
    interpretMark: tier.interpretMark,
    bodyMark: tier.bodyMark,
    closingMark: tier.closingMark,
  };
}

export function localizedChildrenStructureMarks(
  age: ChildrenTargetAge,
  locale: AppLocale,
): { interpret: string; body: string; closing: string } {
  const tier = getChildrenAgeTier(age);
  const entry = getLocalizedChildrenAgeTier(age, locale);
  return {
    interpret: entry.interpretMark ?? tier.interpretMark,
    body: entry.bodyMark ?? tier.bodyMark,
    closing: entry.closingMark ?? tier.closingMark,
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

type NovelLengthTierUiId = "short" | "medium" | "long";

/** 创作页篇幅档位文案（短篇 / 中篇 / 长篇），与 novelCreate i18n 键对齐。 */
export function getNovelLengthTierUiCopy(
  tierId: NovelLengthTierUiId,
  locale: AppLocale,
): { label: string; desc: string } {
  const messages = getMessages(locale);
  const nc = (messages as { novelCreate?: Record<string, string> }).novelCreate ?? {};
  switch (tierId) {
    case "short":
      return {
        label: nc.lengthShort ?? "Short",
        desc: nc.lengthShortDesc ?? "",
      };
    case "medium":
      return {
        label: nc.lengthMedium ?? "Medium",
        desc: nc.lengthMediumDesc ?? "",
      };
    case "long":
      return {
        label: nc.lengthLong ?? "Long",
        desc: nc.lengthLongDesc ?? "",
      };
  }
}
