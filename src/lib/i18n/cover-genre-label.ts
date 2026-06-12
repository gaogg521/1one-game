import type { AppLocale } from "@/i18n/routing";
import type { CoverGenre } from "@/lib/cover-genre";
import { COVER_GENRE_STYLES } from "@/lib/cover-genre";
import { tMessage } from "@/lib/i18n/messages";
import { comicPanelProgressMessage } from "@/lib/i18n/progress-message";

export function coverGenreLabel(locale: AppLocale, genre: CoverGenre): string {
  const key = `genreTags.${genre}.label`;
  const fromMessages = tMessage(locale, key);
  if (fromMessages !== key) return fromMessages;
  return COVER_GENRE_STYLES[genre]?.label ?? comicPanelProgressMessage(locale, "defaultGenre");
}
