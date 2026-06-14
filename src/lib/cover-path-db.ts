import { prisma } from "@/lib/prisma";

export async function persistComicCoverPath(comicId: string, coverPath: string | null): Promise<void> {
  try {
    await prisma.comic.update({ where: { id: comicId }, data: { coverPath } });
  } catch {
    /* ignore */
  }
}

export async function persistNovelCoverPath(novelId: string, coverPath: string | null): Promise<void> {
  try {
    await prisma.novel.update({ where: { id: novelId }, data: { coverPath } });
  } catch {
    /* ignore */
  }
}
