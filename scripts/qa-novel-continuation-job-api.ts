import { prisma } from "../src/lib/prisma";
import { OWNER_COOKIE } from "../src/lib/constants";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const baseUrl = process.env.QA_BASE_URL?.trim() || "http://127.0.0.1:8888";

async function main() {
  const ownerKey = `qa-novel-continue-job-${Date.now()}`;
  let novelId: string | undefined;
  let coreProjectId: string | undefined;
  try {
    const novel = await prisma.novel.create({
      data: {
        ownerKey,
        title: "可恢复续写 QA",
        prompt: "暴雨中的旧城与一盏会说话的灯",
        content: "=== 第1章 灯火 ===\n\n旅人走入暴雨中的旧城，找到一盏会说话的灯。",
        lengthTier: "long",
        status: "ready",
        visibility: "hidden",
        generationMetaJson: JSON.stringify({
          version: 1,
          bible: {
            title: "可恢复续写 QA",
            worldSetting: "旧城永远下雨，钟楼保管着最后一束灯火",
            characters: [
              { name: "旅人", role: "主角", traits: "执着而克制" },
              { name: "灯灵", role: "引路者", traits: "温柔且警觉" },
            ],
            coreConflict: "旅人必须在洪水淹没钟楼前找回最后的灯火",
            endingDirection: "旅人与灯灵一起穿过风暴离开旧城",
          },
          chapterPlan: {
            chapters: [
              { num: 1, title: "灯火", summary: "旅人冒雨进入旧城并遇见会说话的灯灵", phase: "opening" },
              { num: 2, title: "钟楼", summary: "旅人与灯灵前往被洪水包围的钟楼", phase: "rising" },
              { num: 3, title: "远行", summary: "旅人找回灯火并带着灯灵离开旧城", phase: "resolution" },
            ],
          },
          segmentCount: 1,
          createdAt: new Date().toISOString(),
        }),
      },
    });
    novelId = novel.id;
    const headers = { "Content-Type": "application/json", Cookie: `${OWNER_COOKIE}=${ownerKey}`, "x-ui-locale": "zh-Hans" };
    const queuedResponse = await fetch(`${baseUrl}/api/novel/${novel.id}/continue/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ maxChapters: 1, polish: false, durable: true }),
    });
    const queued = (await queuedResponse.json()) as {
      job?: { id?: string; status?: string };
      core?: { creativeProjectId?: string };
    };
    assert(queuedResponse.status === 202 && queued.job?.id && queued.job.status === "queued", "owner must enqueue a recoverable continuation job");
    assert(queued.core?.creativeProjectId, "durable continuation must create an immutable Core request revision");
    coreProjectId = queued.core.creativeProjectId;

    const detailResponse = await fetch(`${baseUrl}/api/novel/${novel.id}`, { headers: { Cookie: `${OWNER_COOKIE}=${ownerKey}` } });
    const detail = (await detailResponse.json()) as { novel?: { continueJob?: { id?: string; status?: string } | null } };
    assert(detailResponse.ok && detail.novel?.continueJob?.id === queued.job.id, "owner detail must expose only its active continuation job");
    assert(detail.novel?.continueJob?.status === "queued", "owner detail must preserve queued status for recovery UI");
    console.log("[OK] qa-novel-continuation-job-api");
  } finally {
    if (coreProjectId) await prisma.creativeProject.delete({ where: { id: coreProjectId } }).catch(() => undefined);
    if (novelId) await prisma.novel.delete({ where: { id: novelId } }).catch(() => undefined);
  }
}

void main().finally(() => prisma.$disconnect());
