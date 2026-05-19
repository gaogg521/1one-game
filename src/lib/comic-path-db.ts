import { prisma } from "@/lib/prisma";

/** Prisma Client 未同步时，用 raw SQL 写入漫画分镜 JSON 与状态 */
export async function persistComicPanelsDb(
  comicId: string,
  imageUrls: string,
  status: string,
): Promise<void> {
  try {
    await prisma.$executeRaw`UPDATE "Comic" SET "imageUrls" = ${imageUrls}, "status" = ${status} WHERE "id" = ${comicId}`;
    return;
  } catch {
    /* fallback */
  }
  try {
    await prisma.comic.update({
      where: { id: comicId },
      data: { imageUrls, status },
    });
  } catch {
    /* ignore */
  }
}
