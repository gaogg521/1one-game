import { OWNER_COOKIE } from "../src/lib/constants";
import { summarizeLiteraryEngagement } from "../src/lib/literary-engagement";
import { prisma } from "../src/lib/prisma";
import { mirrorNovelToCreatorCore } from "../src/lib/creator-core/novel-bridge";
import { mirrorComicToCreatorCore } from "../src/lib/creator-core/comic-bridge";

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
  let novelCoreId: string | undefined;
  let comicCoreId: string | undefined;
  try {
    const novel = await prisma.novel.create({
      data: {
        ownerKey: owner, visibility: "public", status: "ready", title: "阅读信号 QA", prompt: "测试阅读指标",
        content: "=== 第1章 开端 ===\n\n这是用于匿名阅读进度测试的足够长的正文。\n\n=== 第2章 结尾 ===\n\n旅人完成了旅程。",
      },
    });
    novelId = novel.id;
    const acceptedNovel = await mirrorNovelToCreatorCore({ novel });
    novelCoreId = acceptedNovel.creativeProjectId;
    await prisma.creativeProject.update({
      where: { id: acceptedNovel.creativeProjectId },
      data: { acceptedRevisionId: acceptedNovel.creativeRevisionId },
    });
    await prisma.novel.update({
      where: { id: novel.id },
      data: { content: "=== 第1章 新稿 ===\n\n这是作者正在修改、尚未确认发布的新正文。" },
    });
    const comic = await prisma.comic.create({
      data: {
        ownerKey: owner, visibility: "public", status: "ready", title: "翻页信号 QA", prompt: "测试漫画阅读指标",
        imageUrls: JSON.stringify({ pages: [{ page: 1, panels: [{ caption: "开始", prompt: "雨夜", imageUrl: "/qa.png" }] }, { page: 2, panels: [{ caption: "结尾", prompt: "黎明", imageUrl: "/qa.png" }] }] }),
      },
    });
    comicId = comic.id;
    const acceptedComic = await mirrorComicToCreatorCore({ comic });
    comicCoreId = acceptedComic.creativeProjectId;
    await prisma.creativeProject.update({
      where: { id: acceptedComic.creativeProjectId },
      data: { acceptedRevisionId: acceptedComic.creativeRevisionId },
    });
    await prisma.comic.update({
      where: { id: comic.id },
      data: { imageUrls: JSON.stringify({ pages: [{ page: 1, panels: [{ caption: "尚未确认的新分镜", prompt: "storm", imageUrl: "/qa-new.png" }] }] }) },
    });
    const publicNovel = await (await fetch(`${baseUrl}/api/novel/${novel.id}`)).json() as { novel?: { content?: string } };
    assert(publicNovel.novel?.content?.includes("匿名阅读进度测试"), "public novel must stay on the author-confirmed manuscript");
    assert(!publicNovel.novel?.content?.includes("尚未确认发布"), "public novel must not leak an unconfirmed draft");
    const ownerNovel = await (await fetch(`${baseUrl}/api/novel/${novel.id}`, { headers: { Cookie: `${OWNER_COOKIE}=${owner}` } })).json() as { novel?: { content?: string } };
    assert(ownerNovel.novel?.content?.includes("尚未确认发布"), "owner must keep access to the editable novel draft");
    const publicComic = await (await fetch(`${baseUrl}/api/comic/${comic.id}`)).json() as { comic?: { imageUrls?: string } };
    assert(publicComic.comic?.imageUrls?.includes("开始"), "public comic must stay on the author-confirmed storyboard");
    assert(!publicComic.comic?.imageUrls?.includes("尚未确认的新分镜"), "public comic must not leak an unconfirmed storyboard");
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
    const detail = (await ownerDetail.json()) as {
      novel?: {
        literaryEngagement?: { starts?: number; completionRate?: number; health?: { status?: string; minSamples?: number } };
        quality?: { engagement?: { completionRate?: number; literaryHealth?: string } };
        creatorCore?: { project?: { acceptedRevision?: { id?: string } | null } | null } | null;
      };
    };
    assert(ownerDetail.ok && detail.novel?.literaryEngagement?.starts === 1, "owner detail must expose only aggregate reading insight");
    assert(detail.novel?.quality?.engagement?.completionRate === 100, "quality envelope must carry observed completion evidence");
    assert(detail.novel?.literaryEngagement?.health?.status === "insufficient_sample" && detail.novel.literaryEngagement.health.minSamples === 10, "owner insight must expose the safe sample threshold");
    assert(detail.novel?.quality?.engagement?.literaryHealth === "insufficient_sample", "quality envelope must carry the advisory health state");
    assert(detail.novel?.creatorCore?.project?.acceptedRevision?.id === acceptedNovel.creativeRevisionId, "owner novel response must expose the confirmed revision for version UI");
    const ownerComicDetail = await fetch(`${baseUrl}/api/comic/${comic.id}`, { headers: { Cookie: `${OWNER_COOKIE}=${owner}` } });
    const ownerComicBody = (await ownerComicDetail.json()) as { comic?: { creatorCore?: { project?: { acceptedRevision?: { id?: string } | null } | null } | null } };
    assert(ownerComicDetail.ok && ownerComicBody.comic?.creatorCore?.project?.acceptedRevision?.id === acceptedComic.creativeRevisionId, "owner comic response must expose the confirmed revision for version UI");
    console.log("[OK] qa-literary-engagement-api");
  } finally {
    if (comicId) await prisma.comic.delete({ where: { id: comicId } }).catch(() => undefined);
    if (novelId) await prisma.novel.delete({ where: { id: novelId } }).catch(() => undefined);
    if (comicCoreId) await prisma.creativeProject.delete({ where: { id: comicCoreId } }).catch(() => undefined);
    if (novelCoreId) await prisma.creativeProject.delete({ where: { id: novelCoreId } }).catch(() => undefined);
  }
}

void main().finally(() => prisma.$disconnect());
