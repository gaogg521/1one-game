import { prisma } from "@/lib/prisma";

export async function fetchRefinementLogJson(projectId: string): Promise<string | null> {
  try {
    const row = await prisma.project.findUnique({
      where: { id: projectId },
      select: { refinementLogJson: true },
    });
    return row?.refinementLogJson ?? null;
  } catch {
    return null;
  }
}

/** 批量读取 refine 日志（Studio 列表摘要） */
export async function fetchRefinementLogJsonBatch(
  projectIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (projectIds.length === 0) return map;
  try {
    const rows = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, refinementLogJson: true },
    });
    for (const row of rows) {
      map.set(row.id, row.refinementLogJson);
    }
  } catch {
    /* ignore */
  }
  return map;
}

export async function saveRefinementLogJson(projectId: string, logJson: string): Promise<void> {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { refinementLogJson: logJson },
    });
  } catch {
    /* ignore */
  }
}
