/**
 * 漫画精选位离线门禁（seed + Prisma 断言，不依赖 dev）
 * npm run qa:comic-featured:offline
 *
 * 默认写 prisma/ci.sqlite；测 dev.db 时：QA_USE_DEV_DB=1 npm run qa:comic-featured:offline
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

loadEnv();
if (process.env.QA_USE_DEV_DB !== "1") {
  process.env.DATABASE_URL = "file:./prisma/ci.sqlite";
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL?.trim() || "file:./prisma/ci.sqlite";
  console.log(`# qa:comic-featured:offline (${dbUrl})\n`);

  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });

  const { prisma } = await import("@/lib/prisma");
  const { seedMeishanFeaturedComic } = await import("@/lib/comic-featured");
  const { queryComicList } = await import("@/lib/comic-list-query");

  try {
    const { id } = await seedMeishanFeaturedComic();
    if (!id) {
      console.warn("[skip] 本地无煤山漫画 — CI 可忽略");
      return;
    }

    const row = await prisma.comic.findUnique({ where: { id }, select: { featured: true, visibility: true } });
    assert.equal(row?.featured, true);
    assert.equal(row?.visibility, "public");
    console.log(`[OK] seeded comic featured id=${id}`);

    const { comics, total } = await queryComicList({
      where: { visibility: "public", featured: true },
      orderBy: [{ featured: "desc" }, { likeCount: "desc" }],
      skip: 0,
      take: 6,
    });
    assert.ok(total >= 1);
    assert.ok(comics.some((c) => c.id === id));
    assert.ok(comics.every((c) => c.featured));
    console.log(`[OK] queryComicList featured=${total} includes ${id}`);

    console.log("\n[OK] qa:comic-featured:offline complete");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
