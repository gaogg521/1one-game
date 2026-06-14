import { prisma } from "@/lib/prisma";
import type { NovelLengthTier } from "@/lib/novel-length";

export async function persistNovelLengthTier(
  novelId: string,
  lengthTier: NovelLengthTier,
): Promise<void> {
  try {
    await prisma.novel.update({ where: { id: novelId }, data: { lengthTier } });
  } catch {
    /* ignore */
  }
}
