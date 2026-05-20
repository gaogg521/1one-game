import { prisma } from "@/lib/prisma";
import {
  NOVEL_CREATIVE_BRIEF_SCHEMA,
  parseNovelCreativeBrief,
  type NovelCreativeBrief,
} from "@/lib/literary-brief";

export async function saveComicCreativeBriefJson(comicId: string, briefJson: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "Comic" SET "creativeBriefJson" = ${briefJson} WHERE "id" = ${comicId}
    `;
  } catch {
    /* 列未迁移时忽略 */
  }
}

export async function loadComicCreativeBrief(comicId: string): Promise<NovelCreativeBrief | null> {
  try {
    const rows = await prisma.$queryRaw<{ creativeBriefJson: string | null }[]>`
      SELECT creativeBriefJson FROM "Comic" WHERE id = ${comicId}
    `;
    const raw = rows[0]?.creativeBriefJson;
    if (!raw?.trim()) return null;
    return parseNovelCreativeBrief(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function serializeComicCreativeBrief(brief: NovelCreativeBrief): string {
  return JSON.stringify(NOVEL_CREATIVE_BRIEF_SCHEMA.parse(brief));
}
