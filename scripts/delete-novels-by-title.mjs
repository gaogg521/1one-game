/**
 * 按标题删除小说（及级联漫画、封面文件）。
 * 用法：node scripts/delete-novels-by-title.mjs "32格配图长测" "批量配图基准" [--dry-run]
 */
import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

const dryRun = process.argv.includes("--dry-run");
const titles = process.argv.slice(2).filter((a) => a !== "--dry-run");

if (titles.length === 0) {
  console.error('用法: node scripts/delete-novels-by-title.mjs "标题1" "标题2" [--dry-run]');
  process.exit(1);
}

if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const prisma = new PrismaClient();

async function removeCover(novelId) {
  const rel = `public/covers/novel-${novelId}.jpg`;
  try {
    await fs.unlink(path.join(process.cwd(), rel));
    console.log(`  封面已删: ${rel}`);
  } catch {
    /* 无封面文件 */
  }
}

try {
  const rows = await prisma.novel.findMany({
    where: {
      OR: titles.map((t) => ({ title: { contains: t } })),
    },
    select: { id: true, title: true, _count: { select: { comics: true } } },
  });

  console.log(`匹配 ${rows.length} 部小说：`);
  for (const r of rows) {
    console.log(`  - ${r.id} | ${r.title} | 漫画 ${r._count.comics} 部`);
  }

  if (rows.length === 0) {
    console.log("未找到，请核对标题或 DATABASE_URL");
    process.exit(0);
  }

  if (dryRun) {
    console.log("\n[dry-run] 未删除");
    process.exit(0);
  }

  for (const r of rows) {
    await prisma.novel.delete({ where: { id: r.id } });
    await removeCover(r.id);
    console.log(`已删除: ${r.title}`);
  }
} finally {
  await prisma.$disconnect();
}
