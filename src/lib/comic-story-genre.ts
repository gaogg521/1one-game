import { inferStoryGenre, type CoverGenre } from "@/lib/cover-genre";
import type { ComicStoryContext } from "@/lib/comic-panel-prompt-urban";
import { prisma } from "@/lib/prisma";

type ComicRow = {
  title: string;
  prompt?: string | null;
  novelId?: string | null;
};

async function loadNovelForComic(comic: ComicRow) {
  if (!comic.novelId) return null;
  return prisma.novel.findUnique({
    where: { id: comic.novelId },
    select: { title: true, summary: true, prompt: true, content: true },
  });
}

/** 从漫画记录及关联小说推断题材（配图/封面重生成用） */
export async function resolveComicStoryGenre(comic: ComicRow): Promise<CoverGenre> {
  const novel = await loadNovelForComic(comic);
  if (novel) {
    return inferStoryGenre({
      title: comic.title || novel.title,
      summary: novel.summary,
      prompt: [comic.prompt, novel.prompt].filter(Boolean).join(" "),
      contentSnippet: novel.content.slice(0, 1200),
    });
  }
  return inferStoryGenre({ title: comic.title, prompt: comic.prompt });
}

/** 配图时注入小说标题/摘要（占位分镜时重建都市画面描述） */
export async function resolveComicStoryContext(
  comic: ComicRow,
): Promise<ComicStoryContext & { genre: CoverGenre }> {
  const novel = await loadNovelForComic(comic);
  const title = comic.title || novel?.title || "未命名";
  const summary =
    novel?.summary?.trim() ||
    novel?.content?.replace(/\n/g, " ").trim().slice(0, 400) ||
    comic.prompt?.trim() ||
    title;
  const genre = novel
    ? inferStoryGenre({
        title,
        summary: novel.summary,
        prompt: [comic.prompt, novel.prompt].filter(Boolean).join(" "),
        contentSnippet: novel.content.slice(0, 1200),
      })
    : inferStoryGenre({ title, prompt: comic.prompt });
  return { title, summary, genre };
}
