/**
 * 将「内核默认之后、生成模型仍为空」的游戏回填为 kernel + templateId。
 * 生产：cd /opt/operone && npx tsx scripts/backfill-kernel-generation-meta.ts
 */
import { prisma } from "@/lib/prisma";
import { KERNEL_GENERATION_PROVIDER } from "@/lib/work-generation-meta";

/** feat(game): enforce mobile delivery pipeline 起游戏默认走内核。 */
const KERNEL_DEFAULT_SINCE = new Date("2026-08-27T02:32:00.000Z");

function templateIdFromSpecJson(specJson: string): string | null {
  try {
    const spec = JSON.parse(specJson) as { templateId?: unknown };
    const id = typeof spec.templateId === "string" ? spec.templateId.trim() : "";
    return id || null;
  } catch {
    return null;
  }
}

async function main() {
  const rows = await prisma.project.findMany({
    where: {
      createdAt: { gte: KERNEL_DEFAULT_SINCE },
      generationModel: null,
      generationProvider: null,
    },
    select: { id: true, title: true, specJson: true },
  });
  let updated = 0;
  for (const row of rows) {
    const templateId = templateIdFromSpecJson(row.specJson) ?? KERNEL_GENERATION_PROVIDER;
    await prisma.project.update({
      where: { id: row.id },
      data: {
        generationProvider: KERNEL_GENERATION_PROVIDER,
        generationModel: templateId,
      },
    });
    updated += 1;
    console.log(`backfill ${row.id} ${row.title} -> kernel · ${templateId}`);
  }
  console.log(`backfill-kernel-generation-meta: updated ${updated}/${rows.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
