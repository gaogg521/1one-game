/**
 * 为 coverPath 为空的小说补生成封面。用法：npx tsx scripts/backfill-novel-covers.mjs
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const { PrismaClient } = await import("@prisma/client");
const { generateNovelCover } = await import("../src/lib/cover-generation.ts");

const prisma = new PrismaClient();
const rows = await prisma.novel.findMany({
  where: { OR: [{ coverPath: null }, { coverPath: "" }] },
  orderBy: { createdAt: "desc" },
  select: { id: true, title: true, summary: true, prompt: true },
});

console.log(`待补封面：${rows.length} 篇`);

for (const row of rows) {
  process.stdout.write(`→ ${row.title.slice(0, 40)} … `);
  const path = await generateNovelCover(row.id, row.title, row.summary ?? "", row.prompt);
  console.log(path ? `OK ${path}` : "FAIL");
}

await prisma.$disconnect();
