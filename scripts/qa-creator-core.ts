import { prisma } from "../src/lib/prisma";
import {
  createCreativeProject,
  createCreativeRevision,
  getLegacyCreativeProjectSnapshot,
} from "../src/lib/creator-core/repository";
import { enqueueGenerationJob } from "../src/lib/creator-core/jobs";
import { processNextGenerationJob } from "../src/lib/creator-core/worker";
import { mirrorNovelToCreatorCore } from "../src/lib/creator-core/novel-bridge";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const marker = `qa-core-${Date.now()}`;
  const project = await createCreativeProject({ ownerKey: marker, kind: "novel", title: "QA 创作内核" });
  try {
    const first = await createCreativeRevision(project.id, { cause: "user_prompt", intent: { prompt: "一盏灯" } });
    const second = await createCreativeRevision(project.id, { cause: "refine", summary: "补充世界观" });
    assert(first.sequence === 1 && second.sequence === 2, "revisions must be ordered and immutable");
    assert(second.parentRevisionId === first.id, "revision must retain parent lineage");

    const job = await enqueueGenerationJob({
      creativeProjectId: project.id,
      creativeRevisionId: second.id,
      type: "artifact_write",
      idempotencyKey: `${marker}:story-bible`,
      payload: { artifact: { kind: "story_bible", mediaType: "json", content: { characters: [{ name: "灯灵" }] } } },
    });
    const duplicate = await enqueueGenerationJob({
      creativeProjectId: project.id,
      creativeRevisionId: second.id,
      type: "artifact_write",
      idempotencyKey: `${marker}:story-bible`,
      payload: { artifact: { kind: "story_bible", mediaType: "json", content: { ignored: true } } },
    });
    assert(job.id === duplicate.id, "idempotency key must return the original job");

    const processed = await processNextGenerationJob("qa-worker");
    assert(processed?.status === "completed", "artifact job must execute, not merely acknowledge");
    const saved = await prisma.creativeArtifact.findUnique({ where: { id: processed.outputArtifactId } });
    assert(saved?.kind === "story_bible" && saved.creativeRevisionId === second.id, "artifact must preserve revision lineage");

    const novel = await prisma.novel.create({
      data: {
        ownerKey: marker,
        title: "Core 小说镜像",
        prompt: "一盏灯照亮旧城",
        content: "=== 第1章 灯火 ===\n\n旧城的灯火在雨里亮起。\n\n=== 第2章 回声 ===\n\n旅人沿着回声找到答案。",
        status: "ready",
        visibility: "hidden",
      },
    });
    let mirroredProjectId: string | null = null;
    try {
      const mirrored = await mirrorNovelToCreatorCore({
        novel,
        meta: {
          version: 1,
          bible: {
            title: novel.title,
            worldSetting: "一座被长雨包围的旧城",
            characters: [{ name: "旅人", role: "主角", traits: "执着" }, { name: "灯灵", role: "引路者", traits: "沉静" }],
            coreConflict: "旅人必须在灯火熄灭前找到出路",
            endingDirection: "旅人带灯灵离开旧城",
          },
          chapterPlan: { chapters: [
            { num: 1, title: "灯火", summary: "旅人进入旧城", phase: "opening" },
            { num: 2, title: "回声", summary: "旅人找到答案", phase: "resolution" },
            { num: 3, title: "远行", summary: "旅人离开旧城", phase: "resolution" },
          ] },
          segmentCount: 1,
          createdAt: new Date().toISOString(),
        },
      });
      mirroredProjectId = mirrored.creativeProjectId;
      const artifacts = await prisma.creativeArtifact.findMany({ where: { creativeRevisionId: mirrored.creativeRevisionId } });
      assert(artifacts.some((artifact) => artifact.kind === "story_bible"), "novel mirror must retain story bible");
      assert(artifacts.filter((artifact) => artifact.kind === "scene").length === 2, "novel mirror must split chapters into scenes");

      const edited = await prisma.novel.update({
        where: { id: novel.id },
        data: { content: "=== 第1章 新灯火 ===\n\n旅人让灯火重新点亮旧城。" },
      });
      const refined = await mirrorNovelToCreatorCore({ novel: edited, cause: "refine" });
      const snapshot = await getLegacyCreativeProjectSnapshot({
        ownerKey: marker,
        legacyType: "novel",
        legacyId: novel.id,
      });
      assert(snapshot?.revision?.id === refined.creativeRevisionId, "snapshot must select the latest saved revision");
      const manuscript = snapshot?.revision?.artifacts.find((artifact) => artifact.kind === "manuscript");
      assert(manuscript?.textContent?.includes("新灯火"), "latest snapshot must expose the edited manuscript");
    } finally {
      await prisma.novel.delete({ where: { id: novel.id } });
      if (mirroredProjectId) await prisma.creativeProject.delete({ where: { id: mirroredProjectId } });
    }
    console.log("[OK] qa-creator-core");
  } finally {
    await prisma.creativeProject.delete({ where: { id: project.id } });
  }
}

void main().finally(() => prisma.$disconnect());
