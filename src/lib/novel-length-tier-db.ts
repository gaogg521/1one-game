import { prisma } from "@/lib/prisma";
import type { NovelLengthTier } from "@/lib/novel-length";

/** Prisma Client 未 generate 时 create 不能带 lengthTier；列存在则用 raw SQL 写入。 */
export async function persistNovelLengthTier(
  novelId: string,
  lengthTier: NovelLengthTier,
): Promise<void> {
  try {
    await prisma.$executeRaw`UPDATE "Novel" SET "lengthTier" = ${lengthTier} WHERE "id" = ${novelId}`;
  } catch {
    /* lengthTier 列或 Client 未同步时忽略 */
  }
}
