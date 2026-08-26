/**
 * 作品生成出处：规范化 + 落库字段
 * npm run qa:work-generation-meta
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { applyQaOfflineDatabaseUrl } from "@/lib/database-url";
import { prisma } from "@/lib/prisma";
import {
  formatWorkGenerationLabel,
  isMockGenerationModel,
  normalizeWorkGenerationProvenance,
  parseWorkGenerationFromUnknown,
} from "@/lib/work-generation-meta";

const databaseUrl = applyQaOfflineDatabaseUrl();
execSync("npx prisma migrate deploy", {
  stdio: "pipe",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});

const OWNER = "qa-work-generation-meta";

function testHelpers() {
  const fromDebug = parseWorkGenerationFromUnknown({
    debug: { provider: "ark", model: "doubao-seed-2-pro", fallback: false },
  });
  assert.equal(fromDebug.generationProvider, "ark");
  assert.equal(fromDebug.generationModel, "doubao-seed-2-pro");
  assert.equal(
    formatWorkGenerationLabel(fromDebug.generationProvider, fromDebug.generationModel),
    "ark · doubao-seed-2-pro",
  );

  const mock = parseWorkGenerationFromUnknown({ debug: { fallback: true } });
  assert.equal(mock.generationModel, "mock");
  assert.equal(isMockGenerationModel(mock.generationModel), true);

  const fromDraftModel = parseWorkGenerationFromUnknown({
    debug: { draftModel: "ep-xxx", provider: "litellm" },
  });
  assert.equal(fromDraftModel.generationModel, "ep-xxx");
  assert.equal(fromDraftModel.generationProvider, "litellm");

  const empty = normalizeWorkGenerationProvenance({});
  assert.equal(empty.generationProvider, null);
  assert.equal(empty.generationModel, null);
  assert.equal(formatWorkGenerationLabel(null, null), "");

  const trimmed = normalizeWorkGenerationProvenance({ provider: "  volc  ", model: "  ep-xxx  " });
  assert.equal(trimmed.generationProvider, "volc");
  assert.equal(trimmed.generationModel, "ep-xxx");
}

async function testPersistence() {
  const provenance = normalizeWorkGenerationProvenance({ provider: "ark", model: "doubao-seed-2-pro" });
  const game = await prisma.project.create({
    data: {
      ownerKey: OWNER,
      title: "QA 生成模型游戏",
      prompt: "qa",
      specJson: "{}",
      status: "ready",
      visibility: "pending_review",
      ...provenance,
    },
  });
  const novel = await prisma.novel.create({
    data: {
      ownerKey: OWNER,
      title: "QA 生成模型小说",
      prompt: "qa",
      content: "正文".repeat(20),
      status: "ready",
      visibility: "pending_review",
      ...provenance,
    },
  });
  const comic = await prisma.comic.create({
    data: {
      ownerKey: OWNER,
      title: "QA 生成模型漫画",
      prompt: "qa",
      imageUrls: "[]",
      status: "ready",
      visibility: "pending_review",
      ...provenance,
    },
  });

  const loadedGame = await prisma.project.findUniqueOrThrow({
    where: { id: game.id },
    select: { generationProvider: true, generationModel: true, createdAt: true },
  });
  const loadedNovel = await prisma.novel.findUniqueOrThrow({
    where: { id: novel.id },
    select: { generationProvider: true, generationModel: true, createdAt: true },
  });
  const loadedComic = await prisma.comic.findUniqueOrThrow({
    where: { id: comic.id },
    select: { generationProvider: true, generationModel: true, createdAt: true },
  });

  assert.equal(loadedGame.generationModel, "doubao-seed-2-pro");
  assert.equal(loadedNovel.generationProvider, "ark");
  assert.equal(loadedComic.generationModel, "doubao-seed-2-pro");
  assert.ok(loadedGame.createdAt instanceof Date);
  assert.ok(loadedNovel.createdAt instanceof Date);
  assert.ok(loadedComic.createdAt instanceof Date);

  await prisma.comic.delete({ where: { id: comic.id } });
  await prisma.novel.delete({ where: { id: novel.id } });
  await prisma.project.delete({ where: { id: game.id } });
}

async function main() {
  testHelpers();
  await testPersistence();
  console.log("qa-work-generation-meta: ok");
}

main().finally(() => prisma.$disconnect());
