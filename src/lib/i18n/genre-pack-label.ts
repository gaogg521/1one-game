import type { AppLocale } from "@/i18n/routing";
import { GENRE_PACKS } from "@/lib/creative-brief/genre-packs";
import { tMessage } from "@/lib/i18n/messages";

/** 游戏题材包展示名：优先 messages.genrePacks.{id}.label。 */
export function localizedGenrePackLabel(
  locale: AppLocale,
  packId: string,
  fallbackLabel?: string,
): string {
  const fromMessages = tMessage(locale, `genrePacks.${packId}.label`);
  if (fromMessages !== `genrePacks.${packId}.label`) return fromMessages;
  const pack = GENRE_PACKS.find((p) => p.id === packId);
  return fallbackLabel ?? pack?.label ?? packId;
}
