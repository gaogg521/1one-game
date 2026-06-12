import { parseComicImageUrls } from "@/lib/comic-format";
import { prisma } from "@/lib/prisma";

const novelId = process.argv[2] ?? "cmq57lqzr0001f4e5zpigk9ok";
const comicId = process.argv[3] ?? "cmq57ti8g0003f4e5dgscu5ls";

async function main() {
  const novel = await prisma.novel.findUnique({ where: { id: novelId } });
  const comic = await prisma.comic.findUnique({ where: { id: comicId } });

  if (!novel) {
    console.log("novel not found");
  } else {
    console.log(
      JSON.stringify(
        {
          title: novel.title,
          prompt: novel.prompt?.slice(0, 200),
          contentLen: novel.content.length,
          contentHead: novel.content.slice(0, 400),
          lengthTier: novel.lengthTier,
        },
        null,
        2,
      ),
    );
  }

  if (!comic) {
    console.log("comic not found");
    return;
  }

  const doc = parseComicImageUrls(comic.imageUrls);
  let panels = 0;
  let withImg = 0;
  for (const p of doc.pages) {
    for (const pan of p.panels) {
      panels += 1;
      if (pan.imageUrl?.trim()) withImg += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        title: comic.title,
        novelId: comic.novelId,
        status: comic.status,
        pages: doc.pages.length,
        panels,
        withImg,
        stylePreset: doc.stylePreset,
        readMode: doc.readMode,
        pipeline: doc.pipeline,
        pagesDetail: doc.pages,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
