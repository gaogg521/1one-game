/**
 * 为 coverPath 指向缺失文件的小说重新生成封面。
 * 用法：npx tsx scripts/regenerate-missing-novel-covers.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { ensureNovelCoverAfterCreate } from "@/lib/cover-generation";
import { resolveNovelCoverGenre } from "@/lib/cover-genre";
import { inferNovelGenreTagFromStoredPrompt } from "@/lib/novel-genre-tags";
import { deleteNovelCoverFile } from "@/lib/novel-cover-persist";
import { persistNovelCoverPath } from "@/lib/cover-path-db";

const prisma = new PrismaClient();

function coverFileExists(coverPath: string | null | undefined): boolean {
  const cp = coverPath?.trim();
  if (!cp?.startsWith("/covers/")) return false;
  return fs.existsSync(path.join(process.cwd(), "public", cp.replace(/^\//, "")));
}

async function regenerateOne(row: {
  id: string;
  title: string;
  summary: string | null;
  prompt: string;
  content: string | null;
  coverPath: string | null;
}) {
  console.info(`[cover] 开始：${row.title} (${row.id})`);
  if (row.coverPath) {
    await deleteNovelCoverFile(row.id);
    await persistNovelCoverPath(row.id, null);
  }

  const storyHint = [row.prompt, row.content?.slice(0, 800)].filter(Boolean).join(" ").trim();
  const tagFromPrompt = inferNovelGenreTagFromStoredPrompt(row.prompt);
  const genre = resolveNovelCoverGenre({
    genreTagCoverGenre: tagFromPrompt?.coverGenre,
    title: row.title,
    summary: row.summary,
    prompt: row.prompt,
    contentSnippet: row.content?.slice(0, 1200),
  });

  const coverPath = await ensureNovelCoverAfterCreate(
    row.id,
    row.title,
    row.summary ?? "",
    storyHint || row.prompt,
    600_000,
    genre,
  );

  if (!coverPath || !coverFileExists(coverPath)) {
    console.error(`[cover] 失败：${row.title}`);
    return false;
  }
  console.info(`[cover] 成功：${row.title} → ${coverPath}`);
  return true;
}

async function main() {
  const novels = await prisma.novel.findMany({
    orderBy: { createdAt: "desc" },
  });

  const targets = novels.filter((n) => !coverFileExists(n.coverPath));
  if (targets.length === 0) {
    console.info("没有需要补封面的 novel。");
    return;
  }

  console.info(`待补封面：${targets.length} 本`);
  let ok = 0;
  for (const row of targets) {
    if (await regenerateOne(row)) ok++;
  }
  console.info(`完成：${ok}/${targets.length} 本成功`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
