import { prisma } from "@/lib/prisma";

/** 煤山 8 页样例漫画 ID（可用 COMIC_FEATURED_MEISHAN_ID 覆盖） */
export const DEFAULT_MEISHAN_FEATURED_COMIC_ID = "cmqcjell90008hwa0d2ngatyz";

export function resolveMeishanFeaturedComicId(): string {
  return process.env.COMIC_FEATURED_MEISHAN_ID?.trim() || DEFAULT_MEISHAN_FEATURED_COMIC_ID;
}

/** 将煤山 8 页漫画标记为公开精选（幂等；找不到则跳过） */
export async function seedMeishanFeaturedComic(): Promise<{ id: string | null; updated: boolean }> {
  const preferredId = resolveMeishanFeaturedComicId();
  let comic = await prisma.comic.findUnique({ where: { id: preferredId }, select: { id: true } });
  if (!comic) {
    comic = await prisma.comic.findFirst({
      where: {
        visibility: "public",
        title: { contains: "煤山" },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
  }
  if (!comic) return { id: null, updated: false };

  await prisma.comic.update({
    where: { id: comic.id },
    data: { featured: true, visibility: "public" },
  });
  return { id: comic.id, updated: true };
}
