import {
  ArtifactWritePayloadSchema,
  ComicPanelJobPayloadSchema,
  GameAssetJobPayloadSchema,
  NovelContinueJobPayloadSchema,
} from "@/lib/creator-core/types";
import { createCreativeArtifact } from "@/lib/creator-core/repository";
import { mirrorComicToCreatorCore } from "@/lib/creator-core/comic-bridge";
import { generateComicCover } from "@/lib/cover-generation";
import {
  claimGenerationJob,
  completeGenerationJob,
  failGenerationJob,
  heartbeatGenerationJob,
} from "@/lib/creator-core/jobs";
import { prisma } from "@/lib/prisma";
import { withGenerationJobContext } from "@/lib/generation-job-context";
import {
  clearComicPanelImages,
  countPanelsWithImages,
  parseComicDocument,
  renderComicPanels,
  resolveComicRenderStatus,
  serializeComicPanels,
} from "@/lib/comic-panel-render";
import { resolveComicStoryContext } from "@/lib/comic-story-genre";
import { CREATIVE_BRIEF_SCHEMA } from "@/lib/creative-brief/types";
import { parseGameSpec } from "@/lib/game-spec";
import { runProjectAssetPipeline } from "@/lib/game-asset-pipeline";
import { ensureProjectBgm } from "@/lib/game-bgm-pipeline";
import { executeNovelContinuation } from "@/lib/novel-continuation-executor";
import { loadNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import { assessNovelContinuation } from "@/lib/novel-long-continue";

async function executeGameAssetJob(
  job: { id: string; creativeProjectId: string; creativeRevisionId: string | null; payloadJson: string },
  workerId: string,
) {
  const payload = GameAssetJobPayloadSchema.parse(JSON.parse(job.payloadJson));
  const [project, coreProject] = await Promise.all([
    prisma.project.findUnique({
      where: { id: payload.projectId },
      select: { id: true, ownerKey: true, coverPath: true },
    }),
    prisma.creativeProject.findUnique({
      where: { id: job.creativeProjectId },
      select: { ownerKey: true, kind: true, legacyType: true, legacyId: true },
    }),
  ]);
  if (
    !project ||
    project.ownerKey !== payload.ownerKey ||
    !coreProject ||
    coreProject.ownerKey !== payload.ownerKey ||
    coreProject.kind !== "game" ||
    coreProject.legacyType !== "project" ||
    coreProject.legacyId !== project.id
  ) {
    throw new Error("game_asset_owner_or_resource_missing");
  }

  const spec = parseGameSpec(payload.spec);
  const briefResult = payload.brief == null ? { success: true as const, data: null } : CREATIVE_BRIEF_SCHEMA.safeParse(payload.brief);
  if (!briefResult.success) throw new Error("game_asset_brief_invalid");

  await heartbeatGenerationJob(job.id, workerId, { percent: 4, stage: "generating_audio", detail: "generating project BGM" });
  const bgm = await ensureProjectBgm(project.id, spec);
  await heartbeatGenerationJob(job.id, workerId, {
    percent: 8,
    stage: "generating",
    detail: bgm.source === "audio_model" ? "audio-model BGM ready" : bgm.source === "llm_notes" ? "LLM BGM fallback ready" : "BGM unavailable; continuing assets",
  });
  const result = await runProjectAssetPipeline({
    projectId: project.id,
    spec,
    brief: briefResult.data,
    uiLocale: payload.uiLocale as import("@/i18n/routing").AppLocale,
    existingCoverPath: project.coverPath,
  });
  await heartbeatGenerationJob(job.id, workerId, { percent: 95, stage: "persisting", detail: "saving asset manifest" });
  const assetManifest = await createCreativeArtifact({
    creativeProjectId: job.creativeProjectId,
    creativeRevisionId: job.creativeRevisionId ?? undefined,
    artifact: {
      kind: "asset_manifest",
      mediaType: "json",
      content: {
        backgroundUrl: result.backgroundUrl,
        sprites: result.sprites,
        manifest: result.assetManifest,
        coverPath: result.coverPath,
        coverSource: result.coverSource,
        bgm: bgm.source === "audio_model"
          ? { source: bgm.source, url: bgm.audio.url, mimeType: bgm.audio.mimeType, model: bgm.audio.model }
          : bgm.source === "llm_notes"
            ? { source: bgm.source, bpm: bgm.notes.bpm, noteCount: bgm.notes.notes.length }
            : { source: bgm.source },
      },
      metadata: { projectId: project.id, templateId: spec.templateId },
    },
  });
  if (bgm.source === "audio_model") {
    await createCreativeArtifact({
      creativeProjectId: job.creativeProjectId,
      creativeRevisionId: job.creativeRevisionId ?? undefined,
      artifact: {
        kind: "bgm",
        mediaType: "audio",
        storageUri: bgm.audio.url,
        provider: bgm.audio.providerId,
        metadata: { projectId: project.id, model: bgm.audio.model, mimeType: bgm.audio.mimeType, source: bgm.source },
      },
    });
  } else if (bgm.source === "llm_notes") {
    await createCreativeArtifact({
      creativeProjectId: job.creativeProjectId,
      creativeRevisionId: job.creativeRevisionId ?? undefined,
      artifact: {
        kind: "bgm_notes",
        mediaType: "json",
        content: bgm.notes,
        metadata: { projectId: project.id, source: bgm.source },
      },
    });
  }
  return assetManifest;
}

async function executeComicPanelJob(job: { id: string; payloadJson: string }, workerId: string) {
  const payload = ComicPanelJobPayloadSchema.parse(JSON.parse(job.payloadJson));
  const comic = await prisma.comic.findUnique({ where: { id: payload.comicId } });
  if (!comic || comic.ownerKey !== payload.ownerKey) throw new Error("comic_panel_owner_or_resource_missing");
  const doc = parseComicDocument(comic.imageUrls);
  if (!doc.pages.length) throw new Error("comic_panel_storyboard_missing");

  if (payload.regenerate) {
    const scope = payload.page ? { pageNumber: payload.page, ...(payload.panel ? { panelNumber: payload.panel } : {}) } : "all";
    clearComicPanelImages(doc, scope);
    await prisma.comic.update({ where: { id: comic.id }, data: { imageUrls: serializeComicPanels(doc) } });
  }
  const context = await resolveComicStoryContext(comic, payload.uiLocale as import("@/i18n/routing").AppLocale);
  const fullRegenerate = payload.regenerate && !payload.page;
  let coverPath = comic.coverPath;
  if (fullRegenerate && comic.novelId) {
    const novel = await prisma.novel.findUnique({
      where: { id: comic.novelId },
      select: { summary: true, content: true },
    });
    const regeneratedCover = await generateComicCover(
      comic.id,
      comic.title,
      novel?.summary ?? "",
      novel?.content?.slice(0, 800) ?? comic.prompt ?? "",
      context.genre,
    );
    if (regeneratedCover) coverPath = regeneratedCover;
  }
  const timer = setInterval(() => {
    void heartbeatGenerationJob(job.id, workerId, { percent: 5, stage: "rendering", detail: "waiting for image provider" });
  }, 25_000);
  try {
    const result = await renderComicPanels(doc, {
      onlyMissing: true,
      coverPath,
      storyGenre: context.genre,
      storyContext: { title: context.title, summary: context.summary },
      skipStyleRefs: fullRegenerate && !doc.characterSheetUrls?.length,
      director: doc.director,
      characterSheetUrls: doc.characterSheetUrls,
      comicId: comic.id,
      uiLocale: payload.uiLocale as import("@/i18n/routing").AppLocale,
      onProgress: (event) => {
        if (event.type !== "panel_done") return;
        const percent = event.total > 0 ? 5 + (event.withImage / event.total) * 90 : 95;
        void prisma.comic.update({
          where: { id: comic.id },
          data: { imageUrls: event.imageUrls, status: resolveComicRenderStatus({ withImage: event.withImage, total: event.total }) },
        });
        void heartbeatGenerationJob(job.id, workerId, { percent, stage: "rendering", detail: `${event.withImage}/${event.total}` });
      },
    });
    const imageUrls = serializeComicPanels(result.doc);
    const stats = countPanelsWithImages(result.doc);
    const updated = await prisma.comic.update({
      where: { id: comic.id },
      data: { imageUrls, status: resolveComicRenderStatus(stats) },
    });
    await mirrorComicToCreatorCore({ comic: updated, cause: "refine" });
  } finally {
    clearInterval(timer);
  }
}

async function executeNovelContinueJob(
  job: { id: string; creativeProjectId: string; payloadJson: string },
  workerId: string,
) {
  const payload = NovelContinueJobPayloadSchema.parse(JSON.parse(job.payloadJson));
  const [novel, coreProject] = await Promise.all([
    prisma.novel.findUnique({ where: { id: payload.novelId } }),
    prisma.creativeProject.findUnique({
      where: { id: job.creativeProjectId },
      select: { ownerKey: true, kind: true, legacyType: true, legacyId: true },
    }),
  ]);
  if (
    !novel ||
    novel.ownerKey !== payload.ownerKey ||
    !coreProject ||
    coreProject.ownerKey !== payload.ownerKey ||
    coreProject.kind !== "novel" ||
    coreProject.legacyType !== "novel" ||
    coreProject.legacyId !== novel.id
  ) {
    throw new Error("novel_continue_owner_or_resource_missing");
  }
  const uiLocale = payload.uiLocale as import("@/i18n/routing").AppLocale;
  const meta = await loadNovelGenerationMeta(novel.id);
  const continuation = assessNovelContinuation({
    lengthTier: novel.lengthTier,
    content: novel.content,
    meta,
    uiLocale,
  });
  if (!continuation.canContinue) throw new Error("novel_continue_not_available");

  const timer = setInterval(() => {
    void heartbeatGenerationJob(job.id, workerId, { percent: 5, stage: "generating", detail: "continuing manuscript" });
  }, 25_000);
  try {
    return await executeNovelContinuation({
      novel,
      meta,
      maxChaptersToWrite: payload.maxChapters,
      polish: payload.polish,
      uiLocale,
      requestId: `job:${job.id}`,
      phase: "novel_continue_job",
      onCheckpointSaved: async ({ index, contentLength }) => {
        await heartbeatGenerationJob(job.id, workerId, {
          percent: Math.min(90, 20 + index * 15),
          stage: "checkpoint_saved",
          detail: `${contentLength.toLocaleString()} chars`,
        });
      },
    });
  } finally {
    clearInterval(timer);
  }
}

/**
 * Durable-job execution boundary. New job types are added here only after
 * their payload schema and idempotency behavior have an integration test.
 */
export async function processNextGenerationJob(workerId: string) {
  const job = await claimGenerationJob(workerId);
  if (!job) return null;
  return withGenerationJobContext(job.id, async () => {
    try {
      if (job.type === "artifact_write") {
        const payload = ArtifactWritePayloadSchema.parse(JSON.parse(job.payloadJson));
        const artifact = await createCreativeArtifact({
          creativeProjectId: job.creativeProjectId,
          creativeRevisionId: job.creativeRevisionId ?? undefined,
          artifact: payload.artifact,
        });
        await completeGenerationJob(job.id, artifact.id);
        return { id: job.id, type: job.type, status: "completed" as const, outputArtifactId: artifact.id };
      }
      if (job.type === "comic_panel") {
        await executeComicPanelJob(job, workerId);
        await completeGenerationJob(job.id);
        return { id: job.id, type: job.type, status: "completed" as const };
      }
      if (job.type === "game_asset") {
        const artifact = await executeGameAssetJob(job, workerId);
        await completeGenerationJob(job.id, artifact.id);
        return { id: job.id, type: job.type, status: "completed" as const, outputArtifactId: artifact.id };
      }
      if (job.type === "novel_continue") {
        const result = await executeNovelContinueJob(job, workerId);
        if (result.status === "conflict") {
          const failed = await failGenerationJob(job.id, new Error("novel_continuation_conflict"), {
            retry: false,
            errorCode: "novel_continuation_conflict",
          });
          return { id: job.id, type: job.type, status: failed.status as "failed" };
        }
        if (result.status !== "completed") throw new Error("novel_continue_all_models_failed");
        await completeGenerationJob(job.id);
        return { id: job.id, type: job.type, status: "completed" as const };
      }
      throw new Error(`unsupported_generation_job:${job.type}`);
    } catch (error) {
      const failed = await failGenerationJob(job.id, error);
      return { id: job.id, type: job.type, status: failed.status as "retrying" | "failed" };
    }
  });
}
