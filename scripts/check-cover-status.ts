import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

async function main() {
  const novels = await prisma.novel.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, title: true, coverPath: true, createdAt: true },
  });
  const comics = await prisma.comic.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, title: true, coverPath: true, status: true, imageUrls: true, createdAt: true },
  });

  console.log("=== Latest novels ===");
  for (const n of novels) {
    const exists = n.coverPath ? fs.existsSync(path.join("public", n.coverPath.replace(/^\//, ""))) : false;
    console.log({ title: n.title.slice(0, 50), coverPath: n.coverPath, file: exists, at: n.createdAt.toISOString().slice(0, 10) });
  }

  console.log("\n=== Latest comics ===");
  for (const c of comics) {
    let panels = 0;
    let imgs = 0;
    try {
      const doc = JSON.parse(c.imageUrls || "{}") as { pages?: { panels?: { imageUrl?: string }[] }[] };
      for (const pg of doc.pages ?? []) {
        for (const pan of pg.panels ?? []) {
          panels++;
          if (pan.imageUrl?.trim()) imgs++;
        }
      }
    } catch {
      /* ignore */
    }
    const coverOk = c.coverPath ? fs.existsSync(path.join("public", c.coverPath.replace(/^\//, ""))) : false;
    console.log({
      title: c.title.slice(0, 50),
      coverPath: c.coverPath,
      coverFile: coverOk,
      status: c.status,
      panels,
      imgs,
      at: c.createdAt.toISOString().slice(0, 10),
    });
  }

  const noCoverNovels = novels.filter((n) => !n.coverPath).length;
  const noCoverComics = comics.filter((c) => !c.coverPath).length;
  const noPanelImgs = comics.filter((c) => {
    try {
      const doc = JSON.parse(c.imageUrls || "{}") as { pages?: { panels?: { imageUrl?: string }[] }[] };
      return !(doc.pages ?? []).some((pg) => (pg.panels ?? []).some((p) => p.imageUrl?.trim()));
    } catch {
      return true;
    }
  }).length;
  console.log("\nSummary:", { noCoverNovels, noCoverComics, noPanelImgs, totalNovels: novels.length, totalComics: comics.length });

  await prisma.$disconnect();
}

main();
