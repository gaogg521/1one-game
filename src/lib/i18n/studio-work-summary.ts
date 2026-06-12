import type { AppLocale } from "@/i18n/routing";
import { guessPlayStyle } from "@/lib/create-studio-narrative";
import { tMessage } from "@/lib/i18n/messages";
import { getLocalizedNovelGenreTag, inferNovelGenreTagFromStoredPrompt } from "@/lib/novel-genre-tags";

type WorkRow = {
  type: "project" | "novel" | "comic";
  title: string;
  prompt: string;
};

/** 工作室卡片副标题：避免直接展示入库中文 prompt 摘要。 */
export function formatStudioWorkSummary(row: WorkRow, locale: AppLocale): string {
  if (row.type === "project") {
    return guessPlayStyle(row.prompt, locale);
  }
  if (row.type === "novel") {
    const tag = inferNovelGenreTagFromStoredPrompt(row.prompt);
    if (tag) {
      const genre = getLocalizedNovelGenreTag(tag, locale);
      return tMessage(locale, "studio.workSummary.novelGenre", {
        title: row.title,
        genre: genre.label,
      });
    }
  }
  if (row.type === "comic") {
    const tag = inferNovelGenreTagFromStoredPrompt(row.prompt);
    if (tag) {
      const genre = getLocalizedNovelGenreTag(tag, locale);
      return tMessage(locale, "studio.workSummary.comicGenre", {
        title: row.title,
        genre: genre.label,
      });
    }
  }
  return row.title;
}
