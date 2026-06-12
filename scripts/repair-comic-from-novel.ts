/**
 * 将占位分镜（……）按小说正文重新对齐对白/旁白，并可选重跑配图。
 * 用法：npx tsx scripts/repair-comic-from-novel.ts <comicId> [--render]
 */
import {
  assignSourceSegmentIndicesToPages,
  enrichPagesFromSegmentDialogues,
  enrichPagesFromSegmentNarration,
} from "@/lib/comic-dialogue-extract";
import { parseComicImageUrls, serializeComicDocument } from "@/lib/comic-format";
import { isPlaceholderComicPanel } from "@/lib/comic-panel-prompt-urban";
import { renderComicPanels } from "@/lib/comic-panel-render";
import { splitNovelIntoSegments } from "@/lib/comic-storyboard-segments";
import { inferStoryGenre } from "@/lib/cover-genre";
import { prisma } from "@/lib/prisma";

async function main() {
  const comicId = process.argv[2];
  const doRender = process.argv.includes("--render");
  if (!comicId) {
    console.error("用法: npx tsx scripts/repair-comic-from-novel.ts <comicId> [--render]");
    process.exit(1);
  }

  const comic = await prisma.comic.findUnique({ where: { id: comicId } });
  if (!comic?.novelId) throw new Error("漫画不存在或未绑定小说");

  const novel = await prisma.novel.findUnique({ where: { id: comic.novelId } });
  if (!novel) throw new Error("小说不存在");

  const doc = parseComicImageUrls(comic.imageUrls);
  const segments = splitNovelIntoSegments(novel.content);
  let pages = assignSourceSegmentIndicesToPages(doc.pages, segments);
  pages = enrichPagesFromSegmentDialogues(pages, segments);
  pages = enrichPagesFromSegmentNarration(pages, segments);

  const before = doc.pages.flatMap((p) => p.panels).filter((p) => isPlaceholderComicPanel(p)).length;
  const after = pages.flatMap((p) => p.panels).filter((p) => isPlaceholderComicPanel(p)).length;

  const nextDoc = { ...doc, pages };
  let imageUrls = serializeComicDocument(nextDoc);

  if (doRender) {
    const storyGenre = inferStoryGenre({
      title: novel.title,
      summary: novel.summary ?? "",
      prompt: novel.prompt,
      contentSnippet: novel.content.slice(0, 1200),
    });
    for (const p of nextDoc.pages) {
      for (const pan of p.panels) {
        delete pan.imageUrl;
      }
    }
    const rendered = await renderComicPanels(nextDoc, {
      onlyMissing: false,
      storyGenre,
      storyContext: {
        title: novel.title,
        summary: novel.summary ?? novel.content.slice(0, 400).replace(/\n/g, " "),
      },
      director: doc.director ?? null,
      characterSheetUrls: doc.characterSheetUrls,
    } as Parameters<typeof renderComicPanels>[1]);
    imageUrls = serializeComicDocument(rendered.doc);
    console.log("rendered", rendered.rendered, "/", rendered.total);
  }

  await prisma.comic.update({
    where: { id: comicId },
    data: { imageUrls, prompt: novel.content.slice(0, 200) },
  });

  console.log(
    JSON.stringify(
      {
        comicId,
        placeholderBefore: before,
        placeholderAfter: after,
        sampleCaptions: pages.flatMap((p) => p.panels.map((x) => x.caption)).slice(0, 6),
        rendered: doRender,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
