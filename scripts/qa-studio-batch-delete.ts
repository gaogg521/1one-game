/**
 * Studio 批量删除 API 冒烟（需 8888，DATABASE_URL 与服务一致）
 * npm run qa:studio-batch-delete
 */
import { execSync } from "node:child_process";
import { prisma } from "@/lib/prisma";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "file:./prisma/ci.sqlite";

const base = process.env.BENCHMARK_BASE_URL ?? "http://127.0.0.1:8888";
const ownerKey = "qa-batch-del";
const cookie = `gcreator_owner=${ownerKey}`;

async function batchDelete(body: unknown) {
  const res = await fetch(`${base}/api/studio/batch-delete`, {
    method: "DELETE",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    deletedCount?: number;
    errors?: string[];
    error?: string;
  };
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  try {
    execSync("npx prisma migrate deploy", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
  } catch {
    console.error("[FAIL] prisma migrate deploy");
    process.exit(1);
  }

  const health = await fetch(`${base}/api/health`);
  if (!health.ok) {
    console.error("[FAIL] health", health.status, "— start dev @8888 or set BENCHMARK_BASE_URL");
    process.exit(1);
  }

  const empty = await batchDelete({ items: [] });
  if (!empty.ok || empty.data.deletedCount !== 0) {
    console.error("[FAIL] empty items", empty.status, empty.data);
    process.exit(1);
  }
  console.log("[OK] empty items → deletedCount 0");

  const bad = await batchDelete({ items: [{ id: "x", type: "game" }] });
  if (bad.status !== 400) {
    console.error("[FAIL] invalid type should 400", bad.status, bad.data);
    process.exit(1);
  }
  console.log("[OK] invalid type → 400");

  const novel = await prisma.novel.create({
    data: {
      ownerKey,
      title: "批量删除测试小说",
      prompt: "测试",
      content: "正文".repeat(20),
      summary: "摘要",
      status: "ready",
    },
  });

  const comic = await prisma.comic.create({
    data: {
      ownerKey,
      novelId: novel.id,
      title: "批量删除测试漫画",
      prompt: "测试",
      imageUrls: JSON.stringify({ formatVersion: 2, pageCount: 1, pages: [{ page: 1, panels: [] }] }),
      status: "ready",
    },
  });

  const project = await prisma.project.create({
    data: {
      ownerKey,
      title: "批量删除测试游戏",
      prompt: "测试",
      specJson: JSON.stringify({ version: 1, templateId: "avoider", title: "t", theme: {}, gameplay: {}, labels: {} }),
      status: "ready",
    },
  });

  const del = await batchDelete({
    items: [
      { id: project.id, type: "project" },
      { id: novel.id, type: "novel" },
    ],
  });
  if (!del.ok || del.data.deletedCount !== 2) {
    console.error("[FAIL] batch delete project+novel", del.status, del.data);
    process.exit(1);
  }

  const comicRow = await prisma.comic.findUnique({ where: { id: comic.id } });
  if (comicRow) {
    console.error("[FAIL] novel cascade should remove comic", comic.id);
    process.exit(1);
  }

  const projectRow = await prisma.project.findUnique({ where: { id: project.id } });
  if (projectRow) {
    console.error("[FAIL] project should be deleted", project.id);
    process.exit(1);
  }

  console.log("[OK] batch delete project+novel (cascade comic)");
  console.log("[OK] qa-studio-batch-delete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
