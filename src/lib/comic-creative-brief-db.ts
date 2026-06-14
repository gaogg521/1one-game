import { prisma } from "@/lib/prisma";
import {
  NOVEL_CREATIVE_BRIEF_SCHEMA,
  parseNovelCreativeBrief,
  type NovelCreativeBrief,
} from "@/lib/literary-brief";

export async function saveComicCreativeBriefJson(comicId: string, briefJson: string): Promise<void> {
  try {
    await prisma.comic.update({
      where: { id: comicId },
      data: { creativeBriefJson: briefJson },
    });
  } catch {
    /* ignore */
  }
}

export async function loadComicCreativeBrief(comicId: string): Promise<NovelCreativeBrief | null> {
  try {
    const row = await prisma.comic.findUnique({
      where: { id: comicId },
      select: { creativeBriefJson: true },
    });
    const raw = row?.creativeBriefJson;
    if (!raw?.trim()) return null;
    return parseNovelCreativeBrief(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function serializeComicCreativeBrief(brief: NovelCreativeBrief): string {
  return JSON.stringify(NOVEL_CREATIVE_BRIEF_SCHEMA.parse(brief));
}
