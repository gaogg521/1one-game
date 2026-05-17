import { prisma } from "@/lib/prisma";

/** refinementLogJson 可能晚于本地 Prisma Client 生成，读写走 raw SQL 保持兼容。 */
export async function fetchRefinementLogJson(projectId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<{ refinementLogJson: string | null }[]>`
      SELECT refinementLogJson FROM "Project" WHERE id = ${projectId}
    `;
    return rows[0]?.refinementLogJson ?? null;
  } catch {
    return null;
  }
}

export async function saveRefinementLogJson(projectId: string, logJson: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "Project" SET "refinementLogJson" = ${logJson} WHERE "id" = ${projectId}
    `;
    return;
  } catch {
    /* 列未迁移或 Client 未 generate 时尝试 ORM */
  }
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { refinementLogJson: logJson },
    });
  } catch {
    /* 旧库无 refinementLogJson 时忽略，避免 refine 整链 500 */
  }
}
