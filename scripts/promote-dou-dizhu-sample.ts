/**
 * Promote local dou-dizhu project into sample gallery with real AI assets.
 * Usage: DATABASE_URL=file:./dev.db npx tsx scripts/promote-dou-dizhu-sample.ts
 */
import fs from "node:fs";
import path from "node:path";
import { copyProjectToSampleGallery } from "@/lib/sample-gallery-copy";
import { sampleProjectId } from "@/lib/sample-gallery";
import { prisma } from "@/lib/prisma";

const SOURCE_ID = "cmqnl5p2v0000ys3pnta2nw6u";
const SAMPLE_ID = "dou-dizhu";
const TARGET_ID = sampleProjectId(SAMPLE_ID);

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    if (!fs.statSync(from).isFile()) continue;
    fs.copyFileSync(from, path.join(dest, name));
  }
}

async function main(): Promise<void> {
  const source = await prisma.project.findUnique({ where: { id: SOURCE_ID } });
  if (!source) throw new Error(`source_not_found:${SOURCE_ID}`);

  const result = await copyProjectToSampleGallery({
    sourceProjectId: SOURCE_ID,
    sampleId: SAMPLE_ID,
    featured: true,
  });

  const sampleCover = path.join(process.cwd(), "public", "samples", "dou-dizhu.jpg");
  const sourceCover = path.join(process.cwd(), "public", "covers", `${SOURCE_ID}.jpg`);
  fs.mkdirSync(path.dirname(sampleCover), { recursive: true });
  fs.copyFileSync(sourceCover, sampleCover);

  const spriteSrc = path.join(process.cwd(), "public", "game-sprites", SOURCE_ID);
  const spriteDest = path.join(process.cwd(), "public", "game-sprites", TARGET_ID);
  copyDir(spriteSrc, spriteDest);

  const bgSrc = path.join(process.cwd(), "public", "game-bg", `${SOURCE_ID}.png`);
  const bgDest = path.join(process.cwd(), "public", "game-bg", `${TARGET_ID}.png`);
  fs.copyFileSync(bgSrc, bgDest);

  await prisma.project.update({
    where: { id: TARGET_ID },
    data: { coverPath: "/samples/dou-dizhu.jpg" },
  });

  console.log("promote-dou-dizhu-sample: ok", result);
}

main()
  .catch((e) => {
    console.error("[FAIL]", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
