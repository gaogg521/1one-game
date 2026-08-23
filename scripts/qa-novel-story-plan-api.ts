import { prisma } from "../src/lib/prisma";
import { getLegacyCreativeProjectSnapshot } from "../src/lib/creator-core/repository";
import { OWNER_COOKIE } from "../src/lib/constants";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const marker = `qa-story-plan-${Date.now()}`;
  const novel = await prisma.novel.create({
    data: {
      ownerKey: marker,
      title: "Story Plan API QA",
      prompt: "暴雨中的旧城与一盏会说话的灯",
      content: "=== 第1章 灯火 ===\n\n旅人走入暴雨中的旧城，找到一盏会说话的灯。",
      status: "ready",
      visibility: "hidden",
      generationMetaJson: JSON.stringify({
        version: 1,
        bible: {
          title: "Story Plan API QA",
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
  try {
    const response = await fetch(`http://127.0.0.1:8888/api/novel/${novel.id}/story-plan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: `${OWNER_COOKIE}=${marker}` },
      body: JSON.stringify({
        bible: {
          title: novel.title,
          worldSetting: "旧城永远下雨，钟楼保管着最后一束灯火",
          characters: [
            { name: "旅人", role: "主角", traits: "执着而克制" },
            { name: "灯灵", role: "引路者", traits: "温柔且警觉" },
          ],
          coreConflict: "旅人必须在洪水淹没钟楼前找回最后的灯火，并决定是否留下",
          endingDirection: "旅人与灯灵一起穿过风暴离开旧城",
          taboos: ["不要让灯灵无故失忆"],
        },
        chapterPlan: {
          chapters: [
            { num: 1, title: "灯火", summary: "旅人冒雨进入旧城并遇见会说话的灯灵", phase: "opening" },
            { num: 2, title: "钟楼", summary: "旅人与灯灵前往被洪水包围的钟楼", phase: "rising" },
            { num: 3, title: "远行", summary: "旅人找回灯火并带着灯灵离开旧城", phase: "resolution" },
          ],
        },
      }),
    });
    const payload = (await response.json()) as { core?: { creativeRevisionId?: string }; storyPlan?: { bible?: { coreConflict?: string } } };
    assert(response.ok, `story-plan API failed with ${response.status}`);
    assert(payload.core?.creativeRevisionId, "story-plan API must return a core revision");
    assert(payload.storyPlan?.bible?.coreConflict?.includes("是否留下"), "story-plan API must return saved facts");
    const snapshot = await getLegacyCreativeProjectSnapshot({ ownerKey: marker, legacyType: "novel", legacyId: novel.id });
    assert(snapshot?.revision?.id === payload.core.creativeRevisionId, "story-plan API must point to the latest revision");
    console.log("[OK] qa-novel-story-plan-api");
  } finally {
    await prisma.novel.delete({ where: { id: novel.id } });
  }
}

void main().finally(() => prisma.$disconnect());
