import type { AppLocale } from "@/i18n/routing";
import { locales } from "@/i18n/routing";
import { tMessage } from "@/lib/i18n/messages";

export function defaultChapterTitle(locale: AppLocale, num: number): string {
  return tMessage(locale, "novelEditor.defaultChapterTitle", { num });
}

export function ttsChapterIntro(locale: AppLocale, num: number, title: string): string {
  return tMessage(locale, "novelListen.ttsChapterIntro", { num, title });
}

export function untitledNovelLabel(locale: AppLocale): string {
  return tMessage(locale, "novelDisplay.untitledNovel");
}

export function untitledShortLabel(locale: AppLocale): string {
  return tMessage(locale, "novelDisplay.untitledShort");
}

export function novelChapterBodyLabel(locale: AppLocale): string {
  return tMessage(locale, "novelChapterLabels.body");
}

export function novelChapterOpeningLabel(locale: AppLocale): string {
  return tMessage(locale, "novelChapterLabels.opening");
}

export function novelChapterSectionLabel(locale: AppLocale, num: number): string {
  return tMessage(locale, "novelChapterLabels.section", { num });
}

/** 是否为解析/占位用章节标题（不宜当作书名） */
export function isGenericNovelChapterTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  for (const locale of locales) {
    if (t === novelChapterBodyLabel(locale)) return true;
    if (t === novelChapterOpeningLabel(locale)) return true;
    for (let n = 1; n <= 24; n++) {
      if (t === defaultChapterTitle(locale, n)) return true;
      if (t === novelChapterSectionLabel(locale, n)) return true;
    }
  }
  if (t === "正文" || t === "开篇") return true;
  if (/^第\d+章$/.test(t) || /^第\d+节$/.test(t)) return true;
  if (/^Section \d+$/i.test(t) || /^Chapter \d+$/i.test(t)) return true;
  return false;
}

/** 是否为未命名占位（各语系 + 历史中文） */
export function isUntitledLabel(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (t === "未命名") return true;
  for (const locale of locales) {
    if (t === untitledShortLabel(locale) || t === untitledNovelLabel(locale)) return true;
    if (t === childrenUnnamedLabel(locale)) return true;
  }
  return false;
}

export function comicEditionSuffix(locale: AppLocale): string {
  return tMessage(locale, "comicDisplay.editionSuffix");
}

export function childrenInterpretSectionLabel(locale: AppLocale): string {
  return tMessage(locale, "childrenReader.interpretDefault");
}

export function childrenStorySectionLabel(locale: AppLocale, storyTitle?: string): string {
  const base = tMessage(locale, "childrenReader.storyDefault");
  const name = storyTitle?.trim();
  if (!name || isUntitledLabel(name)) return base;
  return `${base}·${name}`;
}

export function childrenParentReadingSectionLabel(locale: AppLocale): string {
  return tMessage(locale, "childrenReader.parentReading");
}

export function childrenUnnamedLabel(locale: AppLocale): string {
  return tMessage(locale, "childrenReader.unnamed");
}

export function untitledGameLabel(locale: AppLocale): string {
  return tMessage(locale, "gameDisplay.untitledGame");
}

export function novelContinuationMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `novelContinuation.${key}`, params);
}

export function novelContinuePhaseMessage(
  locale: AppLocale,
  index: number,
  total: number,
): string {
  let key = "progress";
  if (index === 0) key = "opening";
  else if (index === total - 1) key = "closing";
  else if (index === total - 2 && total > 2) key = "climax";
  return tMessage(locale, `novelContinuePhase.${key}`);
}

export function godotBuildHintMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `godotBuildHint.${key}`, params);
}

export function formatDurationMessage(
  locale: AppLocale,
  key: "secOnly" | "minSec" | "minOnly",
  params: Record<string, string | number>,
): string {
  return tMessage(locale, `formatDuration.${key}`, params);
}

export function novelSynopsisMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `novelSynopsis.${key}`, params);
}
