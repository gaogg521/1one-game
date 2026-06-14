import { NextResponse } from "next/server";
import { buildChapterAdaptationProgress } from "@/lib/comic-chapter-adaptation";
import { isChildrenFormattedNovelContent } from "@/lib/children-comic-sections";
import { getOwnerKey } from "@/lib/owner";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { prisma } from "@/lib/prisma";

/** 工作室：汇总各小说的按章连载改编进度 */
export async function GET(req: Request) {
  const uiLocale = resolveRequestLocaleSync(req);
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ items: [] });
  }

  const novels = await prisma.novel.findMany({
    where: { ownerKey, status: { not: "draft_generating" } },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      content: true,
      comics: {
        select: { id: true, title: true, imageUrls: true, status: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const items = novels
    .map((n) => {
      const isChildren = isChildrenFormattedNovelContent(n.content);
      const progress = buildChapterAdaptationProgress(
        n.content,
        n.comics.filter((c) => c.status !== "draft_storyboard"),
        { isChildren, uiLocale },
      );
      const draftStoryboardComics = n.comics
        .filter((c) => c.status === "draft_storyboard")
        .map((c) => ({ id: c.id, title: c.title }));
      if (progress.totalChapters <= 1 && progress.adaptedCount === 0 && draftStoryboardComics.length === 0) {
        return null;
      }
      return {
        novelId: n.id,
        title: n.title,
        totalChapters: progress.totalChapters,
        adaptedCount: progress.adaptedCount,
        adaptedChapterNums: progress.adaptedChapterNums,
        nextChapter: progress.nextChapter,
        draftStoryboardComics,
        percent:
          progress.totalChapters > 0
            ? Math.min(100, Math.round((progress.adaptedCount / progress.totalChapters) * 100))
            : 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => {
      const aIncomplete = a.adaptedCount < a.totalChapters ? 1 : 0;
      const bIncomplete = b.adaptedCount < b.totalChapters ? 1 : 0;
      if (aIncomplete !== bIncomplete) return bIncomplete - aIncomplete;
      return b.percent - a.percent;
    });

  return NextResponse.json({ items });
}
