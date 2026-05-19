/**
 * 为指定小说：强制重生成都市封面 → 漫画封面 → 串行渲染全部配图
 * 用法: node scripts/run-novel-comic-pipeline.mjs <novelId> [comicId]
 */
import { PrismaClient } from "@prisma/client";

const novelId = process.argv[2] || "cmpawu0hx0008bxbbfkehkiy1";
const comicIdArg = process.argv[3];

async function main() {
  const { deleteNovelCoverFile } = await import("../src/lib/novel-cover-persist.ts");
  const { persistNovelCoverPath } = await import("../src/lib/cover-path-db.ts");
  const { generateNovelCover, generateComicCover } = await import("../src/lib/cover-generation.ts");
  const { inferStoryGenre } = await import("../src/lib/cover-genre.ts");
  const { parseComicDocument, renderComicPanels, serializeComicPanels } = await import(
    "../src/lib/comic-panel-render.ts"
  );
  const { resolveComicStoryContext } = await import("../src/lib/comic-story-genre.ts");

  const p = new PrismaClient();
  const novel = await p.novel.findUnique({ where: { id: novelId } });
  if (!novel) {
    console.error("小说不存在:", novelId);
    process.exit(1);
  }

  const genre = inferStoryGenre({
    title: novel.title,
    summary: novel.summary,
    prompt: novel.prompt,
    contentSnippet: novel.content.slice(0, 1200),
  });
  console.log("题材:", genre, "标题:", novel.title);

  console.log("\n[1/3] 强制重生成小说封面…");
  await deleteNovelCoverFile(novelId);
  await persistNovelCoverPath(novelId, null);
  const storyHint = [novel.prompt, novel.content.slice(0, 800)].filter(Boolean).join(" ");
  const novelCover = await generateNovelCover(
    novelId,
    novel.title,
    novel.summary ?? "",
    storyHint,
    genre,
  );
  console.log(novelCover ? `小说封面 OK: ${novelCover}` : "小说封面生成失败");

  let comic = comicIdArg
    ? await p.comic.findUnique({ where: { id: comicIdArg } })
    : await p.comic.findFirst({ where: { novelId }, orderBy: { createdAt: "desc" } });

  if (!comic) {
    console.error("未找到漫画");
    process.exit(1);
  }
  console.log("\n使用漫画:", comic.id);

  const ctx = await resolveComicStoryContext(comic);
  console.log("\n[2/3] 生成漫画封面…");
  const comicCover = await generateComicCover(
    comic.id,
    comic.title,
    novel.summary ?? "",
    storyHint,
    ctx.genre,
  );
  console.log(comicCover ? `漫画封面 OK: ${comicCover}` : "漫画封面跳过/失败");

  const doc = parseComicDocument(comic.imageUrls);
  if (doc.pages.length === 0) {
    console.error("漫画无分镜");
    process.exit(1);
  }

  console.log("\n[3/3] 渲染配图（32 格，耗时较长）…");
  const t0 = Date.now();
  const result = await renderComicPanels(doc, {
    onlyMissing: true,
    coverPath: comicCover ?? comic.coverPath,
    storyGenre: ctx.genre,
    storyContext: { title: ctx.title, summary: ctx.summary },
    skipStyleRefs: true,
    onProgress: (ev) => {
      if (ev.type === "panel_done") {
        console.log(`[panel] ${ev.index}/${ev.total} ok=${ev.ok} withImage=${ev.withImage}`);
      } else if (ev.type === "done") {
        console.log("[done]", ev.message);
      }
    },
  });

  const imageUrls = serializeComicPanels(result.doc);
  const { persistComicPanelsDb } = await import("../src/lib/comic-path-db.ts");
  const { persistComicCoverPath } = await import("../src/lib/cover-path-db.ts");
  await persistComicPanelsDb(
    comic.id,
    imageUrls,
    result.rendered > 0 ? "ready" : comic.status,
  );
  if (comicCover) await persistComicCoverPath(comic.id, comicCover);

  console.log(
    `\n完成: 渲染 ${result.rendered} 格, 耗时 ${Math.round((Date.now() - t0) / 60000)} 分钟`,
  );
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
