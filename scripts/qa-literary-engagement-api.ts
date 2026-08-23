import { OWNER_COOKIE } from "../src/lib/constants";
import { summarizeLiteraryEngagement } from "../src/lib/literary-engagement";
import { prisma } from "../src/lib/prisma";

const baseUrl = process.env.QA_BASE_URL?.trim() || "http://127.0.0.1:8888";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function event(body: object, cookie?: string) {
  return fetch(`${baseUrl}/api/literary/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

async function main() {
  const owner = `qa-literary-owner-${Date.now()}`;
  let novelId: string | undefined;
  let comicId: string | undefined;
  try {
    const novel = await prisma.novel.create({
      data: {
        ownerKey: owner, visibility: "public", status: "ready", title: "阅读信号 QA", prompt: "测试阅读指标",
        content: "=== 第1章 开端 ===\n\n这是用于匿名阅读进度测试的足够长的正文。\n\n=== 第2章 结尾 ===\n\n旅人完成了旅程。",
      },
    });
    novelId = novel.id;
    const comic = await prisma.comic.create({
      data: {
        ownerKey: owner, visibility: "public", status: "ready", title: "翻页信号 QA", prompt: "测试漫画阅读指标",
        imageUrls: JSON.stringify({ pages: [{ page: 1, panels: [{ caption: "开始", prompt: "雨夜", imageUrl: "/qa.png" }] }, { page: 2, panels: [{ caption: "结尾", prompt: "黎明", imageUrl: "/qa.png" }] }] }),
      },
    });
    comicId = comic.id;
    const novelSession = "qa-literary-novel-session-0001";
    for (const body of [
      { workType: "novel", workId: novel.id, sessionId: novelSession, event: "start" },
      { workType: "novel", workId: novel.id, sessionId: novelSession, event: "start" },
      { workType: "novel", workId: novel.id, sessionId: novelSession, event: "unit_view", unitIndex: 1 },
      { workType: "novel", workId: novel.id, sessionId: novelSession, event: "unit_view", unitIndex: 2 },
      { workType: "novel", workId: novel.id, sessionId: novelSession, event: "complete" },
    ]) {
      const response = await event(body);
      assert(response.status === 202, "public reader event must be accepted");
    }
    const ignoredOwner = await event(
      { workType: "novel", workId: novel.id, sessionId: "qa-literary-owner-session-0001", event: "start" },
      `${OWNER_COOKIE}=${owner}`,
    );
    assert(ignoredOwner.status === 202, "owner reading must be harmlessly ignored");
    const comicResponse = await event({ workType: "comic", workId: comic.id, sessionId: "qa-literary-comic-session-0001", event: "start" });
    assert(comicResponse.status === 202, "public comic reader event must be accepted");

    const novelSummary = await summarizeLiteraryEngagement({ workType: "novel", workId: novel.id, unitCount: 2 });
    assert(novelSummary.starts === 1 && novelSummary.completed === 1, "duplicate start must be idempotent and completion retained");
    assert(novelSummary.completionRate === 100 && novelSummary.averageProgressRate === 100, "chapter progress must aggregate by anonymous session");
    const ownerDetail = await fetch(`${baseUrl}/api/novel/${novel.id}`, { headers: { Cookie: `${OWNER_COOKIE}=${owner}` } });
    const detail = (await ownerDetail.json()) as { novel?: { literaryEngagement?: { starts?: number; completionRate?: number }; quality?: { engagement?: { completionRate?: number } } } };
    assert(ownerDetail.ok && detail.novel?.literaryEngagement?.starts === 1, "owner detail must expose only aggregate reading insight");
    assert(detail.novel?.quality?.engagement?.completionRate === 100, "quality envelope must carry observed completion evidence");
    console.log("[OK] qa-literary-engagement-api");
  } finally {
    if (comicId) await prisma.comic.delete({ where: { id: comicId } }).catch(() => undefined);
    if (novelId) await prisma.novel.delete({ where: { id: novelId } }).catch(() => undefined);
  }
}

void main().finally(() => prisma.$disconnect());
