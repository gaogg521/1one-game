/**
 * 按 ID 删除漫画。
 * 用法：node scripts/delete-comics-by-id.mjs <id> [id2...] [--dry-run]
 */
import { PrismaClient } from "@prisma/client";

const dryRun = process.argv.includes("--dry-run");
const ids = process.argv.slice(2).filter((a) => a !== "--dry-run");

if (ids.length === 0) {
  console.error("用法: node scripts/delete-comics-by-id.mjs <comicId> [...] [--dry-run]");
  process.exit(1);
}

if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const prisma = new PrismaClient();

try {
  const rows = await prisma.comic.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, novelId: true },
  });

  console.log(`匹配 ${rows.length} / ${ids.length} 部漫画：`);
  for (const r of rows) {
    console.log(`  - ${r.id} | ${r.title} | novel ${r.novelId}`);
  }

  if (rows.length === 0) {
    console.log("未找到");
    process.exit(0);
  }

  if (dryRun) {
    console.log("\n[dry-run] 未删除");
    process.exit(0);
  }

  const deleted = await prisma.comic.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  console.log(`\n已删除 ${deleted.count} 部漫画`);
} finally {
  await prisma.$disconnect();
}
