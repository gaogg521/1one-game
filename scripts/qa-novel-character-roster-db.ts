/**
 * 小说角色 roster DB 读写（Prisma 优先 + raw 回退）
 * npm run qa:novel-character-roster-db
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { applyQaOfflineDatabaseUrl } from "@/lib/database-url";

applyQaOfflineDatabaseUrl();

const OWNER = "qa-roster-db";
const NOVEL_ID = "qa-roster-novel-fixture";
const STUCK_MIGRATION = "20260614090000_user_auth_foundation";

function ensureMigrations(): void {
  try {
    execSync("npx prisma migrate deploy", { stdio: "pipe", env: process.env });
  } catch (e) {
    const msg = (e as { stderr?: string; stdout?: string }).stderr
      ?? (e as { stderr?: string; stdout?: string }).stdout
      ?? String(e);
    if (/P3018|P3009|already exists/i.test(msg)) {
      try {
        execSync(`npx prisma migrate resolve --rolled-back ${STUCK_MIGRATION}`, {
          stdio: "pipe",
          env: process.env,
        });
      } catch {
        /* table may already exist */
      }
      execSync(`npx prisma migrate resolve --applied ${STUCK_MIGRATION}`, {
        stdio: "pipe",
        env: process.env,
      });
      return;
    }
    throw e;
  }
}

async function main() {
  ensureMigrations();

  const { prisma } = await import("@/lib/prisma");
  const { loadNovelCharacterRoster, saveNovelCharacterRoster, novelCharacterRosterUsesRawFallback } =
    await import("@/lib/novel-character-roster-db");

  try {
    await prisma.novel.upsert({
      where: { id: NOVEL_ID },
      create: {
        id: NOVEL_ID,
        ownerKey: OWNER,
        title: "roster QA",
        prompt: "test",
        content: "正文",
        lengthTier: "short",
        status: "ready",
        visibility: "private",
      },
      update: { title: "roster QA" },
    });

    const roster = {
      version: 1 as const,
      locked: true,
      characters: [
        {
          id: "char_1",
          name: "测试角色",
          appearanceZh: "青衫",
          outfitZh: "布衣",
        },
      ],
    };

    await saveNovelCharacterRoster(NOVEL_ID, roster);
    const loaded = await loadNovelCharacterRoster(NOVEL_ID);
    assert.ok(loaded);
    assert.equal(loaded.characters.length, 1);
    assert.equal(loaded.characters[0]?.name, "测试角色");

    const reloaded = await loadNovelCharacterRoster(NOVEL_ID);
    assert.equal(reloaded?.characters[0]?.name, "测试角色");

    await saveNovelCharacterRoster(NOVEL_ID, null);
    assert.equal(await loadNovelCharacterRoster(NOVEL_ID), null);

    console.log(
      `qa:novel-character-roster-db: ok (rawFallback=${novelCharacterRosterUsesRawFallback()})`,
    );
  } finally {
    await prisma.novel.deleteMany({ where: { id: NOVEL_ID } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
