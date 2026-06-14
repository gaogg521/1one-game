import { prisma } from "@/lib/prisma";
import { CREATIVE_BRIEF_SCHEMA, type CreativeBrief } from "@/lib/creative-brief/types";

export async function fetchCreativeBriefJson(projectId: string): Promise<string | null> {
  try {
    const row = await prisma.project.findUnique({
      where: { id: projectId },
      select: { creativeBriefJson: true },
    });
    return row?.creativeBriefJson ?? null;
  } catch {
    return null;
  }
}

export async function saveCreativeBriefJson(projectId: string, briefJson: string): Promise<void> {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { creativeBriefJson: briefJson },
    });
  } catch {
    /* ignore */
  }
}

export function parseStoredCreativeBrief(raw: string | null | undefined): CreativeBrief | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = CREATIVE_BRIEF_SCHEMA.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function loadProjectCreativeBrief(projectId: string): Promise<CreativeBrief | null> {
  const raw = await fetchCreativeBriefJson(projectId);
  return parseStoredCreativeBrief(raw);
}
