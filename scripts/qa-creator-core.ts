import { prisma } from "../src/lib/prisma";
import {
  createCreativeProject,
  createCreativeRevision,
  getLegacyCreativeProjectSnapshot,
} from "../src/lib/creator-core/repository";
import { enqueueGenerationJob } from "../src/lib/creator-core/jobs";
import { processNextGenerationJob } from "../src/lib/creator-core/worker";
import { mirrorNovelToCreatorCore } from "../src/lib/creator-core/novel-bridge";
import { reviseNovelStoryPlan } from "../src/lib/novel-story-plan";
import { mirrorComicToCreatorCore } from "../src/lib/creator-core/comic-bridge";
import { mirrorGameToCreatorCore } from "../src/lib/creator-core/game-bridge";
import { prepareGameSpecForPersist } from "../src/lib/spec-patch";

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
      const novelEvaluation = await prisma.creativeEvaluation.findFirst({ where: { creativeRevisionId: mirrored.creativeRevisionId } });
      assert(artifacts.some((artifact) => artifact.kind === "story_bible"), "novel mirror must retain story bible");
      assert(artifacts.filter((artifact) => artifact.kind === "scene").length === 2, "novel mirror must split chapters into scenes");
      assert(novelEvaluation?.evaluator === "deterministic_quality", "novel mirror must persist its quality evaluation");

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

      await prisma.novel.update({
        where: { id: novel.id },
        data: { generationMetaJson: JSON.stringify({
          version: 1,
          bible: {
            title: novel.title,
            worldSetting: "一座被长雨包围的旧城",
            characters: [{ name: "旅人", role: "主角", traits: "执着" }, { name: "灯灵", role: "引路者", traits: "沉静" }],
            coreConflict: "旅人必须在灯火熄灭前找到出路",
            endingDirection: "旅人带灯灵离开旧城",
          },
          chapterPlan: { chapters: [
            { num: 1, title: "灯火", summary: "旅人冒雨进入被长雨包围的旧城", phase: "opening" },
            { num: 2, title: "回声", summary: "旅人循着回声找到沉默的灯灵", phase: "rising" },
            { num: 3, title: "远行", summary: "旅人带着灯灵穿过雨幕离开旧城", phase: "resolution" },
          ] },
          segmentCount: 1,
          createdAt: new Date().toISOString(),
        }) },
      });
      const current = await prisma.novel.findUniqueOrThrow({ where: { id: novel.id } });
      const revisedPlan = await reviseNovelStoryPlan({
        novel: current,
        bible: { ...JSON.parse(current.generationMetaJson!).bible, coreConflict: "旅人必须在暴雨吞没旧城前找回灯火" },
        chapterPlan: { chapters: [
          { num: 1, title: "新灯火", summary: "旅人从雨幕进入被暴雨吞没的旧城", phase: "opening" },
          { num: 2, title: "钟楼", summary: "旅人追随灯灵前往藏着真相的钟楼", phase: "rising" },
          { num: 3, title: "远行", summary: "旅人带着灯灵穿过风暴离开旧城", phase: "resolution" },
        ] },
      });
      const revisedSnapshot = await getLegacyCreativeProjectSnapshot({ ownerKey: marker, legacyType: "novel", legacyId: novel.id });
      const revisedBible = revisedSnapshot?.revision?.artifacts.find((artifact) => artifact.kind === "story_bible");
      assert(revisedSnapshot?.revision?.id === revisedPlan.core.creativeRevisionId, "story plan edit must create a new core revision");
      assert(
        (revisedBible?.content as { coreConflict?: string } | null)?.coreConflict?.includes("暴雨"),
        "story plan edit must preserve the revised bible in the latest revision",
      );
    } finally {
      await prisma.novel.delete({ where: { id: novel.id } });
      if (mirroredProjectId) await prisma.creativeProject.delete({ where: { id: mirroredProjectId } });
    }

    const comic = await prisma.comic.create({
      data: {
        ownerKey: marker,
        title: "Core 漫画镜像",
        prompt: "旧城与灯灵",
        status: "ready",
        visibility: "hidden",
        imageUrls: JSON.stringify({
          formatVersion: 3,
          pageCount: 1,
          stylePreset: "manga",
          characterSheetUrls: ["/covers/lamp-spirit.png"],
          pages: [{ page: 1, panels: [{ scene: 1, caption: "雨中的旧城", prompt: "rainy old city", imageUrl: "/covers/panel.png" }] }],
        }),
      },
    });
    let mirroredComicProjectId: string | null = null;
    try {
      const mirroredComic = await mirrorComicToCreatorCore({ comic });
      mirroredComicProjectId = mirroredComic.creativeProjectId;
      const comicArtifacts = await prisma.creativeArtifact.findMany({ where: { creativeRevisionId: mirroredComic.creativeRevisionId } });
      const comicEvaluation = await prisma.creativeEvaluation.findFirst({ where: { creativeRevisionId: mirroredComic.creativeRevisionId } });
      assert(comicArtifacts.some((artifact) => artifact.kind === "comic_document"), "comic mirror must retain its document");
      assert(comicArtifacts.some((artifact) => artifact.kind === "style_lock"), "comic mirror must retain style and character locks");
      assert(comicArtifacts.some((artifact) => artifact.kind === "storyboard_page"), "comic mirror must retain storyboard pages");
      assert(comicEvaluation?.evaluator === "deterministic_quality", "comic mirror must persist its quality evaluation");
      const panelJob = await enqueueGenerationJob({
        creativeProjectId: mirroredComic.creativeProjectId,
        creativeRevisionId: mirroredComic.creativeRevisionId,
        type: "comic_panel",
        idempotencyKey: `${marker}:comic-panel`,
        payload: { comicId: comic.id, ownerKey: marker, regenerate: false, uiLocale: "zh-Hans" },
      });
      const processedPanel = await processNextGenerationJob("qa-worker");
      assert(processedPanel?.id === panelJob.id && processedPanel.status === "completed", "comic panel worker must execute durable work");
    } finally {
      await prisma.comic.delete({ where: { id: comic.id } });
      if (mirroredComicProjectId) await prisma.creativeProject.delete({ where: { id: mirroredComicProjectId } });
    }

    const gameSpec = prepareGameSpecForPersist(undefined, "霓虹街机飞船突破机械舰队");
    const game = await prisma.project.create({
      data: { ownerKey: marker, title: gameSpec.title, prompt: "霓虹街机飞船突破机械舰队", specJson: JSON.stringify(gameSpec), status: "ready", visibility: "hidden" },
    });
    let mirroredGameProjectId: string | null = null;
    try {
      const mirroredGame = await mirrorGameToCreatorCore({ project: game });
      mirroredGameProjectId = mirroredGame.creativeProjectId;
      const gameArtifacts = await prisma.creativeArtifact.findMany({ where: { creativeRevisionId: mirroredGame.creativeRevisionId } });
      const gameEvaluation = await prisma.creativeEvaluation.findFirst({ where: { creativeRevisionId: mirroredGame.creativeRevisionId } });
      assert(gameArtifacts.some((artifact) => artifact.kind === "game_spec"), "game mirror must retain the executable spec");
      assert(gameArtifacts.some((artifact) => artifact.kind === "evaluation"), "game mirror must retain creator quality evidence");
      assert(gameEvaluation?.evaluator === "deterministic_quality", "game mirror must persist its quality evaluation");
      const sceneGraph = gameArtifacts.find((artifact) => artifact.kind === "scene_graph");
      const behaviorGraph = gameArtifacts.find((artifact) => artifact.kind === "behavior_graph");
      assert(sceneGraph && behaviorGraph, "game mirror must retain inspectable scene and behavior graphs");
      const parsedBehavior = JSON.parse(behaviorGraph.contentJson ?? "{}") as { nodes?: unknown[]; edges?: unknown[] };
      assert((parsedBehavior.nodes?.length ?? 0) >= 6 && (parsedBehavior.edges?.length ?? 0) >= 6, "behavior graph must preserve executable control flow");
      const edited = await prisma.project.update({ where: { id: game.id }, data: { prompt: "霓虹飞船穿越机械舰队的终局" } });
      const refinedGame = await mirrorGameToCreatorCore({ project: edited, cause: "refine" });
      const gameSnapshot = await getLegacyCreativeProjectSnapshot({ ownerKey: marker, legacyType: "project", legacyId: game.id });
      assert(gameSnapshot?.revision?.id === refinedGame.creativeRevisionId, "game snapshot must select its latest editable revision");
      assert(gameSnapshot?.project.evaluation?.verdict, "owner snapshot must expose the latest Core evaluation");
    } finally {
      await prisma.project.delete({ where: { id: game.id } });
      if (mirroredGameProjectId) await prisma.creativeProject.delete({ where: { id: mirroredGameProjectId } });
    }
    console.log("[OK] qa-creator-core");
  } finally {
    await prisma.creativeProject.delete({ where: { id: project.id } });
  }
}

void main().finally(() => prisma.$disconnect());
