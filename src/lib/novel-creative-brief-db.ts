import { prisma } from "@/lib/prisma";
import {
  NOVEL_CREATIVE_BRIEF_SCHEMA,
  parseNovelCreativeBrief,
  type NovelCreativeBrief,
} from "@/lib/literary-brief";

export { parseNovelCreativeBrief };

export async function fetchNovelCreativeBriefJson(novelId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<{ creativeBriefJson: string | null }[]>`
      SELECT creativeBriefJson FROM "Novel" WHERE id = ${novelId}
    `;
    return rows[0]?.creativeBriefJson ?? null;
  } catch {
    return null;
  }
}

export async function saveNovelCreativeBriefJson(novelId: string, briefJson: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "Novel" SET "creativeBriefJson" = ${briefJson} WHERE "id" = ${novelId}
    `;
    return;
  } catch {
    /* 列未迁移 */
  }
  try {
    await prisma.novel.update({
      where: { id: novelId },
      data: { creativeBriefJson: briefJson },
    });
  } catch {
    /* ignore */
  }
}

export async function loadNovelCreativeBrief(novelId: string): Promise<NovelCreativeBrief | null> {
  const raw = await fetchNovelCreativeBriefJson(novelId);
  if (!raw?.trim()) return null;
  try {
    return parseNovelCreativeBrief(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function serializeNovelCreativeBrief(brief: NovelCreativeBrief): string {
  return JSON.stringify(NOVEL_CREATIVE_BRIEF_SCHEMA.parse(brief));
}
