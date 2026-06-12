/**
 * Upsert public English fixtures for /en/ detail-page QA (novel / play / comic).
 * DATABASE_URL must match the running server. Idempotent.
 */
import { prisma } from "@/lib/prisma";
import { mockSpecFromPrompt } from "@/lib/mock-spec";

import { QA_EN_FIXTURE } from "./qa-en-fixture-ids";

const NOVEL_CONTENT = `=== Chapter 1: Harbor Light ===

The harbor woke early. Ships cut through the mist while gulls circled the warehouse roofs.

=== Chapter 2: The Letter ===

A sealed note changed everything she thought she knew about the old lighthouse keeper.`;

const COMIC_IMAGE_URLS = JSON.stringify({
  formatVersion: 2,
  pageCount: 1,
  pages: [
    {
      page: 1,
      panels: [
        {
          index: 1,
          caption: "Morning at the harbor.",
          imageUrl: null,
        },
      ],
    },
  ],
});

async function main(): Promise<void> {
  const spec = mockSpecFromPrompt("Defend the crystal from shadow creepers");
  spec.title = "QA Fixture Game";

  await prisma.novel.upsert({
    where: { id: QA_EN_FIXTURE.novelId },
    create: {
      id: QA_EN_FIXTURE.novelId,
      ownerKey: QA_EN_FIXTURE.ownerKey,
      visibility: "public",
      title: "QA Fixture Novel",
      prompt: "English locale acceptance fixture",
      content: NOVEL_CONTENT,
      summary: "Short English fixture for /en/ detail QA.",
      lengthTier: "short",
      status: "ready",
      playCount: 1,
    },
    update: {
      visibility: "public",
      title: "QA Fixture Novel",
      content: NOVEL_CONTENT,
      summary: "Short English fixture for /en/ detail QA.",
      status: "ready",
    },
  });

  await prisma.project.upsert({
    where: { id: QA_EN_FIXTURE.projectId },
    create: {
      id: QA_EN_FIXTURE.projectId,
      ownerKey: QA_EN_FIXTURE.ownerKey,
      visibility: "public",
      title: spec.title,
      prompt: "English locale acceptance fixture game",
      specJson: JSON.stringify(spec),
      status: "ready",
      playCount: 1,
    },
    update: {
      visibility: "public",
      title: spec.title,
      specJson: JSON.stringify(spec),
      status: "ready",
    },
  });

  await prisma.comic.upsert({
    where: { id: QA_EN_FIXTURE.comicId },
    create: {
      id: QA_EN_FIXTURE.comicId,
      ownerKey: QA_EN_FIXTURE.ownerKey,
      novelId: QA_EN_FIXTURE.novelId,
      visibility: "public",
      title: "QA Fixture Comic",
      prompt: "English locale acceptance fixture comic",
      imageUrls: COMIC_IMAGE_URLS,
      status: "ready",
      likeCount: 1,
    },
    update: {
      visibility: "public",
      title: "QA Fixture Comic",
      imageUrls: COMIC_IMAGE_URLS,
      status: "ready",
    },
  });

  console.log("qa-seed-public-en-fixtures: ok", QA_EN_FIXTURE);
}

main()
  .catch((e) => {
    console.error("[FAIL]", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
