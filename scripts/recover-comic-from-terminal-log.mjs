/**
 * 从 pipeline 终端日志中恢复已生成但未入库的 imageUrls（Prisma coverPath 报错时）
 * 用法: node scripts/recover-comic-from-terminal-log.mjs <terminal.txt> <comicId>
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const logPath = process.argv[2];
const comicId = process.argv[3];
if (!logPath || !comicId) {
  console.error("Usage: node scripts/recover-comic-from-terminal-log.mjs <log.txt> <comicId>");
  process.exit(1);
}

const text = readFileSync(resolve(logPath), "utf8");
const coverM = text.match(/coverPath: "([^"]+)"/);
const coverPath = coverM?.[1] ?? null;

let imageUrls;
const jsonM = text.match(/imageUrls: "(\{.+?\})",\s*\n\s*status:/s);
if (jsonM) {
  imageUrls = JSON.parse(jsonM[1].replace(/\\"/g, '"'));
} else {
  const paths = [...text.matchAll(/imageUrl\\":\\"(\/covers\/openai-[^\\]+)"/g)].map((x) => x[1]);
  if (paths.length === 0) {
    console.error("imageUrls not found in log");
    process.exit(1);
  }
  const { prisma } = await import("../src/lib/prisma.ts");
  const comic = await prisma.comic.findUnique({ where: { id: comicId }, select: { imageUrls: true } });
  if (!comic?.imageUrls) {
    console.error("comic imageUrls skeleton missing in DB");
    process.exit(1);
  }
  imageUrls = JSON.parse(comic.imageUrls);
  let i = 0;
  for (const page of imageUrls.pages ?? []) {
    for (const panel of page.panels ?? []) {
      if (paths[i]) panel.imageUrl = paths[i++];
    }
  }
}

const { persistComicPanelsDb } = await import("../src/lib/comic-path-db.ts");
const { persistComicCoverPath } = await import("../src/lib/cover-path-db.ts");

await persistComicPanelsDb(comicId, JSON.stringify(imageUrls), "ready");
if (coverPath) await persistComicCoverPath(comicId, coverPath);

console.log("Recovered", comicId, "panels with images:", countPanels(imageUrls), "cover:", coverPath);

function countPanels(doc) {
  let n = 0;
  for (const page of doc.pages ?? []) {
    for (const p of page.panels ?? []) {
      if (p.imageUrl) n++;
    }
  }
  return n;
}
