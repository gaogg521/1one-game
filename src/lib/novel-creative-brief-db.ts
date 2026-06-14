import { prisma } from "@/lib/prisma";
import {
  CHILDREN_CREATIVE_BRIEF_SCHEMA,
  NOVEL_CREATIVE_BRIEF_SCHEMA,
  parseChildrenCreativeBrief,
  parseNovelCreativeBrief,
  type ChildrenCreativeBrief,
  type NovelCreativeBrief,
} from "@/lib/literary-brief";

export { parseNovelCreativeBrief, parseChildrenCreativeBrief };

export async function fetchNovelCreativeBriefJson(novelId: string): Promise<string | null> {
  try {
    const row = await prisma.novel.findUnique({
      where: { id: novelId },
      select: { creativeBriefJson: true },
    });
    return row?.creativeBriefJson ?? null;
  } catch {
    return null;
  }
}

export async function saveNovelCreativeBriefJson(novelId: string, briefJson: string): Promise<void> {
  try {
    await prisma.novel.update({
      where: { id: novelId },
      data: { creativeBriefJson: briefJson },
    });
  } catch {
    /* ignore */
  }
}

async function fetchAndParseBrief<T>(
  novelId: string,
  parse: (raw: unknown) => T | null,
): Promise<T | null> {
  const raw = await fetchNovelCreativeBriefJson(novelId);
  if (!raw?.trim()) return null;
  try {
    return parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function loadNovelCreativeBrief(novelId: string): Promise<NovelCreativeBrief | null> {
  return fetchAndParseBrief(novelId, (v) => parseNovelCreativeBrief(v));
}

export function serializeNovelCreativeBrief(brief: NovelCreativeBrief): string {
  return JSON.stringify(NOVEL_CREATIVE_BRIEF_SCHEMA.parse(brief));
}

export function serializeChildrenCreativeBrief(brief: ChildrenCreativeBrief): string {
  return JSON.stringify(CHILDREN_CREATIVE_BRIEF_SCHEMA.parse(brief));
}

export async function loadChildrenCreativeBrief(
  novelId: string,
): Promise<ChildrenCreativeBrief | null> {
  return fetchAndParseBrief(novelId, (v) => parseChildrenCreativeBrief(v));
}

export async function loadCreativeBriefForNovel(
  novelId: string,
): Promise<ChildrenCreativeBrief | NovelCreativeBrief | null> {
  return fetchAndParseBrief(novelId, (v) => parseChildrenCreativeBrief(v) ?? parseNovelCreativeBrief(v));
}
