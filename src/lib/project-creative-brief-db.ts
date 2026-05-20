import { prisma } from "@/lib/prisma";
import { CREATIVE_BRIEF_SCHEMA, type CreativeBrief } from "@/lib/creative-brief/types";

/** creativeBriefJson 可能晚于本地 Prisma Client 生成，读写走 raw SQL 保持兼容。 */
export async function fetchCreativeBriefJson(projectId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<{ creativeBriefJson: string | null }[]>`
      SELECT creativeBriefJson FROM "Project" WHERE id = ${projectId}
    `;
    return rows[0]?.creativeBriefJson ?? null;
  } catch {
    return null;
  }
}

export async function saveCreativeBriefJson(projectId: string, briefJson: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "Project" SET "creativeBriefJson" = ${briefJson} WHERE "id" = ${projectId}
    `;
    return;
  } catch {
    /* 列未迁移时尝试 ORM */
  }
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { creativeBriefJson: briefJson },
    });
  } catch {
    /* 旧库无列时忽略 */
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
