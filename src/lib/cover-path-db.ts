import { prisma } from "@/lib/prisma";

/** Prisma Client 未 generate 时 update 不能带 coverPath；列存在则用 raw SQL。 */
export async function persistComicCoverPath(comicId: string, coverPath: string | null): Promise<void> {
  try {
    await prisma.$executeRaw`UPDATE "Comic" SET "coverPath" = ${coverPath} WHERE "id" = ${comicId}`;
    return;
  } catch {
    /* 无列或 SQL 失败时尝试 Client */
  }
  try {
    await prisma.comic.update({ where: { id: comicId }, data: { coverPath } });
  } catch {
    /* 忽略 */
  }
}

export async function persistNovelCoverPath(novelId: string, coverPath: string | null): Promise<void> {
  try {
    await prisma.$executeRaw`UPDATE "Novel" SET "coverPath" = ${coverPath} WHERE "id" = ${novelId}`;
    return;
  } catch {
    /* 无列或 SQL 失败时尝试 Client */
  }
  try {
    await prisma.novel.update({ where: { id: novelId }, data: { coverPath } });
  } catch {
    /* 忽略 */
  }
}
