/**
 * 诊断并修复指定小说的封面 + 漫画配图（需配置 .env 与 dev 同源数据库）
 * 用法: npx tsx scripts/fix-novel-comic-urban.mjs <novelId>
 */
import { PrismaClient } from "@prisma/client";

const novelId = process.argv[2] || "cmpawu0hx0008bxbbfkehkiy1";
const p = new PrismaClient();

function parseDoc(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return { pages: [] };
  }
}

const novel = await p.novel.findUnique({ where: { id: novelId } });
if (!novel) {
  console.error("novel not found");
  process.exit(1);
}
console.log("Novel:", novel.title);
console.log("coverPath:", novel.coverPath);
const comics = await p.comic.findMany({
  where: { novelId },
  orderBy: { createdAt: "desc" },
});
for (const c of comics) {
  const doc = parseDoc(c.imageUrls);
  let withImg = 0;
  let total = 0;
  for (const page of doc.pages || []) {
    for (const pan of page.panels || []) {
      total++;
      if (pan.imageUrl) withImg++;
    }
  }
  console.log(`Comic ${c.id} status=${c.status} cover=${c.coverPath} panels=${withImg}/${total}`);
}
await p.$disconnect();
