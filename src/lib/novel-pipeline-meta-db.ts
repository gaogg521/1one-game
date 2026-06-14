import { prisma } from "@/lib/prisma";
import {
  parseNovelGenerationMeta,
  serializeNovelGenerationMeta,
  type NovelGenerationMeta,
} from "@/lib/novel-long-pipeline-types";

export async function persistNovelGenerationMeta(
  novelId: string,
  meta: NovelGenerationMeta,
): Promise<void> {
  const json = serializeNovelGenerationMeta(meta);
  try {
    await prisma.novel.update({
      where: { id: novelId },
      data: { generationMetaJson: json },
    });
  } catch {
    /* ignore */
  }
}

export async function loadNovelGenerationMeta(novelId: string): Promise<NovelGenerationMeta | null> {
  try {
    const row = await prisma.novel.findUnique({
      where: { id: novelId },
      select: { generationMetaJson: true },
    });
    return parseNovelGenerationMeta(row?.generationMetaJson);
  } catch {
    return null;
  }
}
