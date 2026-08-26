/**
 * Admin 删除小说/漫画/游戏：落库与级联清理（离线，不启 HTTP）
 * npm run qa:admin-works-delete
 */
import { execSync } from "node:child_process";
import { applyQaOfflineDatabaseUrl } from "@/lib/database-url";
import { deleteAdminWork } from "@/lib/admin/delete-work";
import { prisma } from "@/lib/prisma";

const databaseUrl = applyQaOfflineDatabaseUrl();
execSync("npx prisma migrate deploy", {
  stdio: "pipe",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});

const OWNER = "qa-admin-works-delete";

async function main() {
  const novel = await prisma.novel.create({
    data: {
      ownerKey: OWNER,
      title: "QA 后台删除小说",
      prompt: "qa",
      content: "正文".repeat(12),
      summary: "摘要",
      status: "ready",
      visibility: "public",
    },
  });
  const comic = await prisma.comic.create({
    data: {
      ownerKey: OWNER,
      novelId: novel.id,
      title: "QA 后台删除漫画",
      prompt: "qa",
      imageUrls: "[]",
      status: "ready",
      visibility: "public",
    },
  });
  await prisma.comment.create({
    data: {
      workType: "novel",
      workId: novel.id,
      ownerKey: OWNER,
      nickname: "qa",
      content: "to be deleted",
    },
  });
  const game = await prisma.project.create({
    data: {
      ownerKey: OWNER,
      title: "QA 后台删除游戏",
      prompt: "qa",
      specJson: "{}",
      status: "ready",
      visibility: "public",
    },
  });

  const novelOk = await deleteAdminWork("novel", novel.id);
  if (!novelOk) throw new Error("novel delete returned false");

  const leftoverNovel = await prisma.novel.findUnique({ where: { id: novel.id } });
  const leftoverComic = await prisma.comic.findUnique({ where: { id: comic.id } });
  const leftoverComments = await prisma.comment.count({ where: { workId: novel.id } });
  if (leftoverNovel || leftoverComic || leftoverComments !== 0) {
    throw new Error(
      `cascade incomplete novel=${Boolean(leftoverNovel)} comic=${Boolean(leftoverComic)} comments=${leftoverComments}`,
    );
  }

  const gameOk = await deleteAdminWork("game", game.id);
  if (!gameOk) throw new Error("game delete returned false");
  const leftoverGame = await prisma.project.findUnique({ where: { id: game.id } });
  if (leftoverGame) throw new Error("game delete left a row");

  const missing = await deleteAdminWork("comic", "does-not-exist");
  if (missing) throw new Error("missing comic should return false");

  console.log("qa-admin-works-delete: ok");
}

main()
  .catch((error) => {
    console.error("qa-admin-works-delete: fail", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
