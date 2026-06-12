import type { AppLocale } from "@/i18n/routing";
import en from "@/messages/en.json";
import ms from "@/messages/ms.json";
import th from "@/messages/th.json";
import zhHans from "@/messages/zh-Hans.json";
import zhHant from "@/messages/zh-Hant.json";
import { formatMessage } from "@/lib/i18n/format-message";

export type AppMessages = typeof zhHans;

const MESSAGES_BY_LOCALE: Record<AppLocale, AppMessages> = {
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
  en,
  ms,
  th,
};

export function getMessages(locale: AppLocale): AppMessages {
  return MESSAGES_BY_LOCALE[locale] ?? MESSAGES_BY_LOCALE["zh-Hans"];
}

export function getMessageValue(messages: AppMessages, keyPath: string): string | undefined {
  let cur: unknown = messages;
  for (const part of keyPath.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function tMessage(
  locale: AppLocale,
  keyPath: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  const template = getMessageValue(getMessages(locale), keyPath);
  if (!template) return keyPath;
  return formatMessage(template, params);
}
