/**
 * 复现缺格配图并打印 API 错误
 * npx tsx scripts/repro-comic-missing-panels.ts [comicId]
 */
import { config } from "dotenv";
import { countPanelsWithImages, parseComicDocument, renderComicPanels } from "@/lib/comic-panel-render";
import { resolveComicStoryContext } from "@/lib/comic-story-genre";
import { prisma } from "@/lib/prisma";

config();

const id = process.argv[2] ?? "cmqcfapj2000hjo1c79sse9b5";

async function main() {
  const row = await prisma.comic.findUnique({ where: { id } });
  if (!row) throw new Error(`comic not found: ${id}`);

  const before = countPanelsWithImages(parseComicDocument(row.imageUrls));
  console.log("before:", before, "owner:", row.ownerKey);

  const doc = parseComicDocument(row.imageUrls);
  const { title, summary, genre } = await resolveComicStoryContext(row, "zh-Hans");

  const result = await renderComicPanels(doc, {
    onlyMissing: true,
    coverPath: row.coverPath,
    storyGenre: genre,
    storyContext: { title, summary },
    director: doc.director,
    characterSheetUrls: doc.characterSheetUrls,
    uiLocale: "zh-Hans",
    onProgress: (ev) => {
      if (ev.type === "panel_done" && !ev.ok) {
        console.log(`[panel_fail] #${ev.index}:`, ev.error);
      }
      if (ev.type === "done") {
        console.log("[render_done]", { rendered: ev.rendered, total: ev.total, withImage: ev.withImage, message: ev.message });
      }
    },
  });

  const after = countPanelsWithImages(result.doc);
  console.log("after:", after);
  if (result.errors.length) {
    console.log("errors:");
    for (const e of result.errors) console.log(" -", e);
  }

  await prisma.comic.update({
    where: { id },
    data: { imageUrls: JSON.stringify(result.doc) },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
