import { config } from "dotenv";
import { countPanelsWithImages, parseComicDocument } from "@/lib/comic-panel-render";
import { prisma } from "@/lib/prisma";

config();

const id = process.argv[2] ?? "cmqcfapj2000hjo1c79sse9b5";

async function main() {
  const row = await prisma.comic.findUnique({ where: { id } });
  if (!row) {
    console.error("comic not found", id);
    process.exit(1);
  }
  const doc = parseComicDocument(row.imageUrls);
  const stats = countPanelsWithImages(doc);
  console.log("ownerKey:", row.ownerKey);
  console.log("stats:", stats);

  let panelIndex = 0;
  const missing: { index: number; page: number; imageUrl: unknown; caption: string }[] = [];
  for (const page of doc.pages) {
    for (const panel of page.panels) {
      panelIndex += 1;
      const url = panel.imageUrl?.trim();
      if (!url) {
        missing.push({
          index: panelIndex,
          page: page.page,
          imageUrl: panel.imageUrl,
          caption: (panel.caption ?? "").slice(0, 80),
        });
      }
    }
  }
  console.log("missing panels:", missing.length);
  console.log(JSON.stringify(missing, null, 2));

  // Simulate onlyMissing flat
  const flat: number[] = [];
  panelIndex = 0;
  for (const page of doc.pages) {
    for (const panel of page.panels) {
      panelIndex += 1;
      if (!panel.imageUrl?.trim()) flat.push(panelIndex);
    }
  }
  console.log("flat indices:", flat);
}

main()
  .finally(() => prisma.$disconnect());
