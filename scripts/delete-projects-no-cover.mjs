/**
 * 删除 dev.db 中无封面（coverPath 为空）的 Project 记录。
 * 用法：node scripts/delete-projects-no-cover.mjs [--dry-run]
 */
import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

const dryRun = process.argv.includes("--dry-run");

if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const prisma = new PrismaClient();

try {
  const rows = await prisma.project.findMany({
    select: { id: true, title: true, coverPath: true },
  });
  const noCover = rows.filter((r) => !r.coverPath?.trim());

  console.log(`共 ${rows.length} 个项目，无封面 ${noCover.length} 个`);
  for (const r of noCover) {
    console.log(`  - ${r.id} | ${r.title}`);
  }

  if (dryRun) {
    console.log("\n[dry-run] 未删除");
    process.exit(0);
  }

  if (noCover.length === 0) {
    console.log("无需删除");
    process.exit(0);
  }

  const ids = noCover.map((r) => r.id);
  const deleted = await prisma.project.deleteMany({ where: { id: { in: ids } } });
  console.log(`\n已删除 ${deleted.count} 条 Project 记录`);

  for (const id of ids) {
    const jpg = path.join(process.cwd(), "public", "covers", `${id}.jpg`);
    const png = path.join(process.cwd(), "public", "covers", `${id}.png`);
    for (const f of [jpg, png]) {
      try {
        await fs.unlink(f);
        console.log(`  已删封面文件 ${f}`);
      } catch {
        /* 无文件则忽略 */
      }
    }
  }
} finally {
  await prisma.$disconnect();
}
