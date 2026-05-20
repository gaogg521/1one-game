import { prisma } from "@/lib/prisma";
import {
  parseNovelGenerationMeta,
  serializeNovelGenerationMeta,
  type NovelGenerationMeta,
} from "@/lib/novel-long-pipeline-types";

/** 写入长篇流水线元数据（generationMetaJson 列）；Client 未同步时静默忽略。 */
export async function persistNovelGenerationMeta(
  novelId: string,
  meta: NovelGenerationMeta,
): Promise<void> {
  const json = serializeNovelGenerationMeta(meta);
  try {
    await prisma.$executeRaw`UPDATE "Novel" SET "generationMetaJson" = ${json} WHERE "id" = ${novelId}`;
  } catch {
    /* 列或 Client 未同步时忽略 */
  }
}

/** 读取长篇流水线元数据。 */
export async function loadNovelGenerationMeta(novelId: string): Promise<NovelGenerationMeta | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ generationMetaJson: string | null }>>`
      SELECT "generationMetaJson" FROM "Novel" WHERE "id" = ${novelId}
    `;
    return parseNovelGenerationMeta(rows[0]?.generationMetaJson);
  } catch {
    return null;
  }
}
