/**
 * Studio 复制 API 冒烟（需 8888，DATABASE_URL 与服务一致）
 * DATABASE_URL=file:./prisma/ci.sqlite npx tsx scripts/qa-studio-duplicate.ts
 */
import { prisma } from "@/lib/prisma";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "file:./prisma/ci.sqlite";

const base = process.env.BENCHMARK_BASE_URL ?? "http://127.0.0.1:8888";
const ownerKey = "qa-dup-test";
const cookie = `gcreator_owner=${ownerKey}`;

async function postDup(path: string) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  const body = (await res.json().catch(() => ({}))) as {
    novel?: { id: string };
    comic?: { id: string };
    error?: string;
  };
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const health = await fetch(`${base}/api/health`);
  if (!health.ok) {
    console.error("[FAIL] health", health.status);
    process.exit(1);
  }

  const novel = await prisma.novel.create({
    data: {
      ownerKey,
      title: "复制测试小说",
      prompt: "测试",
      content: "正文".repeat(50),
      summary: "摘要",
      status: "ready",
    },
  });

  const mine = await fetch(`${base}/api/novel?mine=1`, { headers: { Cookie: cookie } });
  const mineBody = (await mine.json()) as { novels?: { id: string }[] };
  if (!mineBody.novels?.some((n) => n.id === novel.id)) {
    console.error("[FAIL] 服务端 mine=1 未见到刚写入的小说（DATABASE_URL 与 8888 不一致？）", process.env.DATABASE_URL);
    process.exit(1);
  }

  const dupN = await postDup(`/api/novel/${novel.id}/duplicate`);
  if (!dupN.ok || !dupN.body.novel?.id) {
    console.error("[FAIL] novel duplicate", dupN.status, dupN.body);
    process.exit(1);
  }
  console.log("[OK] novel duplicate →", dupN.body.novel.id);

  const comic = await prisma.comic.create({
    data: {
      ownerKey,
      novelId: novel.id,
      title: "复制测试漫画",
      prompt: "测试",
      imageUrls: JSON.stringify({ formatVersion: 2, pageCount: 1, pages: [{ page: 1, panels: [] }] }),
      status: "ready",
    },
  });

  const dupC = await postDup(`/api/comic/${comic.id}/duplicate`);
  if (!dupC.ok || !dupC.body.comic?.id) {
    console.error("[FAIL] comic duplicate", dupC.status, dupC.body);
    process.exit(1);
  }
  console.log("[OK] comic duplicate →", dupC.body.comic.id);
  console.log("[OK] qa-studio-duplicate");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
