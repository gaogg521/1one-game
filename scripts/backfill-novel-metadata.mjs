/**
 * 批量修正小说书名（≤15 字）并可选重生成封面。
 *
 * 用法：
 *   npx tsx scripts/backfill-novel-metadata.mjs           # 仅修正书名
 *   npx tsx scripts/backfill-novel-metadata.mjs --covers    # 书名 + 全部重生成封面
 *   npx tsx scripts/backfill-novel-metadata.mjs --covers-only  # 仅重生成封面（不改书名）
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const args = new Set(process.argv.slice(2));
const regenCovers = args.has("--covers") || args.has("--covers-only");
const fixTitles = !args.has("--covers-only");

const { PrismaClient } = await import("@prisma/client");
const { extractNovelTitleFromContent, clampNovelTitle, looksLikeOutlineOrPrompt } = await import(
  "../src/lib/novel-display.ts"
);
const { generateNovelCover } = await import("../src/lib/cover-generation.ts");
const { deleteNovelCoverFile } = await import("../src/lib/novel-cover-persist.ts");

const prisma = new PrismaClient();
const rows = await prisma.novel.findMany({
  orderBy: { createdAt: "desc" },
  select: { id: true, title: true, summary: true, prompt: true, content: true, coverPath: true },
});

console.log(`共 ${rows.length} 篇 · 修正书名=${fixTitles} · 重生成封面=${regenCovers}`);

let titleUpdates = 0;
let coverOk = 0;
let coverFail = 0;

for (const row of rows) {
  let title = row.title;

  if (fixTitles) {
    const next = extractNovelTitleFromContent(row.content, row.title, row.prompt);
    const clamped = clampNovelTitle(next);
    const shouldUpdate = clamped !== row.title || looksLikeOutlineOrPrompt(row.title);
    if (shouldUpdate && clamped !== row.title) {
      await prisma.novel.update({ where: { id: row.id }, data: { title: clamped } });
      titleUpdates += 1;
      console.log(`[title] ${row.title.slice(0, 30)}… → ${clamped}`);
    }
    title = clamped;
  }

  if (regenCovers) {
    process.stdout.write(`[cover] ${title} … `);
    await deleteNovelCoverFile(row.id);
    await prisma.novel.update({ where: { id: row.id }, data: { coverPath: null } });
    const path = await generateNovelCover(row.id, title, row.summary ?? "", row.prompt);
    if (path) {
      coverOk += 1;
      console.log(`OK ${path}`);
    } else {
      coverFail += 1;
      console.log("FAIL");
    }
  }
}

console.log(`完成：书名更新 ${titleUpdates} 篇；封面成功 ${coverOk}，失败 ${coverFail}`);
await prisma.$disconnect();
