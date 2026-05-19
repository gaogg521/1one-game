/** 仅渲染漫画配图：node scripts/render-comic-panels-only.mjs <comicId> */
const comicId = process.argv[2];
if (!comicId) {
  console.error("用法: node scripts/render-comic-panels-only.mjs <comicId>");
  process.exit(1);
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { parseComicDocument, renderComicPanels, serializeComicPanels } = await import(
    "../src/lib/comic-panel-render.ts"
  );
  const { resolveComicStoryContext } = await import("../src/lib/comic-story-genre.ts");

  const p = new PrismaClient();
  const comic = await p.comic.findUnique({ where: { id: comicId } });
  if (!comic) {
    console.error("漫画不存在");
    process.exit(1);
  }
  const ctx = await resolveComicStoryContext(comic);
  const doc = parseComicDocument(comic.imageUrls);
  console.log("开始配图", comicId, "题材", ctx.genre);

  const result = await renderComicPanels(doc, {
    onlyMissing: true,
    coverPath: comic.coverPath,
    storyGenre: ctx.genre,
    storyContext: { title: ctx.title, summary: ctx.summary },
    skipStyleRefs: true,
    onProgress: (ev) => {
      if (ev.type === "panel_done") console.log(`格 ${ev.index}/${ev.total} ok=${ev.ok}`);
    },
  });

  const { persistComicPanelsDb } = await import("../src/lib/comic-path-db.ts");
  await persistComicPanelsDb(
    comicId,
    serializeComicPanels(result.doc),
    result.rendered > 0 ? "ready" : comic.status,
  );
  console.log("完成", result.rendered, "格");
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
