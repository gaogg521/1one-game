import {
  ArtifactWritePayloadSchema,
  ComicPanelJobPayloadSchema,
  GameAssetJobPayloadSchema,
  GameProductionJobPayloadSchema,
  GameIterationJobPayloadSchema,
  NovelContinueJobPayloadSchema,
} from "@/lib/creator-core/types";
import {
  createCreativeArtifact,
  finalizeCreativeRevision,
  markCreativeRevisionFailed,
  markCreativeRevisionGenerating,
} from "@/lib/creator-core/repository";
import { mirrorComicToCreatorCore } from "@/lib/creator-core/comic-bridge";
import { generateComicCover } from "@/lib/cover-generation";
import {
  claimGenerationJob,
  completeGenerationJob,
  enqueueGenerationJob,
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
import { buildGameProductionRun } from "@/lib/game-production-orchestrator";
import { buildGameArtDirection } from "@/lib/game-art-direction";
import { reconcileGamePlaytestEvidenceForRevision } from "@/lib/game-playtest-evidence";
import { generateAgenticGameModule } from "@/lib/agentic/generate-game-module";
import { shouldUseAgenticRuntime } from "@/lib/agentic/game-module";
import { requiresBespokeRuntime } from "@/lib/game-runtime-policy";
import { patchGameSpecWithLlm } from "@/lib/spec-patch";
import { mirrorGameToCreatorCore } from "@/lib/creator-core/game-bridge";
import { parseStoredCreativeBrief } from "@/lib/project-creative-brief-db";
import { isRefinementStubEnabled, refineSpecWithStub } from "@/lib/refinement-stub";

async function executeGameAssetJob(
  job: { id: string; creativeProjectId: string; creativeRevisionId: string | null; payloadJson: string },
  workerId: string,
  specOverride?: ReturnType<typeof parseGameSpec>,
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

  const spec = specOverride ?? parseGameSpec(payload.spec);
  const briefResult = payload.brief == null ? { success: true as const, data: null } : CREATIVE_BRIEF_SCHEMA.safeParse(payload.brief);
  if (!briefResult.success) throw new Error("game_asset_brief_invalid");

  const [existingManifest, existingAudio] = job.creativeRevisionId
    ? await Promise.all([
        prisma.creativeArtifact.findFirst({
          where: { creativeRevisionId: job.creativeRevisionId, kind: "asset_manifest", status: "ready" },
          orderBy: { createdAt: "desc" },
        }),
        prisma.creativeArtifact.findFirst({
          where: { creativeRevisionId: job.creativeRevisionId, kind: { in: ["bgm", "bgm_notes"] }, status: "ready" },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [null, null];
  if (existingManifest && existingAudio) return existingManifest;

  await heartbeatGenerationJob(job.id, workerId, { percent: 4, stage: "generating_audio", detail: "generating project BGM" });
  const bgm = await ensureProjectBgm(project.id, spec);
  await heartbeatGenerationJob(job.id, workerId, {
    percent: 8,
    stage: "generating",
    detail: bgm.source === "audio_model" ? "audio-model BGM ready" : bgm.source === "llm_notes" ? "LLM BGM fallback ready" : "procedural BGM fallback ready",
  });
  const artDirection = buildGameArtDirection(spec, briefResult.data);
  const result = await runProjectAssetPipeline({
    projectId: project.id,
    spec,
    brief: briefResult.data,
    uiLocale: payload.uiLocale as import("@/i18n/routing").AppLocale,
    existingCoverPath: project.coverPath,
    artDirection,
  });
  await createCreativeArtifact({
    creativeProjectId: job.creativeProjectId,
    creativeRevisionId: job.creativeRevisionId ?? undefined,
    idempotencyKey: job.creativeRevisionId ? `game_art_direction:${job.creativeRevisionId}` : undefined,
    artifact: {
      kind: "game_art_direction",
      mediaType: "json",
      content: artDirection,
      metadata: { projectId: project.id, templateId: spec.templateId },
    },
  });
  await heartbeatGenerationJob(job.id, workerId, { percent: 95, stage: "persisting", detail: "saving asset manifest" });
  const assetManifest = await createCreativeArtifact({
    creativeProjectId: job.creativeProjectId,
    creativeRevisionId: job.creativeRevisionId ?? undefined,
    idempotencyKey: job.creativeRevisionId ? `asset_manifest:${job.creativeRevisionId}` : undefined,
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
          : { source: bgm.source, bpm: bgm.notes.bpm, noteCount: bgm.notes.notes.length },
        artDirection: result.artDirection,
      },
      metadata: { projectId: project.id, templateId: spec.templateId },
    },
  });
  if (bgm.source === "audio_model") {
    await createCreativeArtifact({
      creativeProjectId: job.creativeProjectId,
      creativeRevisionId: job.creativeRevisionId ?? undefined,
      idempotencyKey: job.creativeRevisionId ? `bgm:${job.creativeRevisionId}` : undefined,
      artifact: {
        kind: "bgm",
        mediaType: "audio",
        storageUri: bgm.audio.url,
        provider: bgm.audio.providerId,
        metadata: { projectId: project.id, model: bgm.audio.model, mimeType: bgm.audio.mimeType, source: bgm.source },
      },
    });
  } else {
    await createCreativeArtifact({
      creativeProjectId: job.creativeProjectId,
      creativeRevisionId: job.creativeRevisionId ?? undefined,
      idempotencyKey: job.creativeRevisionId ? `bgm_notes:${job.creativeRevisionId}` : undefined,
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

async function executeGameProductionJob(
  job: { id: string; creativeProjectId: string; creativeRevisionId: string | null; payloadJson: string },
  workerId: string,
) {
  if (!job.creativeRevisionId) throw new Error("game_production_revision_missing");
  const payload = GameProductionJobPayloadSchema.parse(JSON.parse(job.payloadJson));
  let spec = parseGameSpec(payload.spec);
  const sourceProject = await prisma.project.findUnique({
    where: { id: payload.projectId },
    select: { id: true, prompt: true, ownerKey: true },
  });
  if (!sourceProject || sourceProject.ownerKey !== payload.ownerKey) throw new Error("game_production_project_missing");
  const briefResult = payload.brief == null ? { success: true as const, data: null } : CREATIVE_BRIEF_SCHEMA.safeParse(payload.brief);
  if (!briefResult.success) throw new Error("game_production_brief_invalid");

  if (requiresBespokeRuntime(spec) && !shouldUseAgenticRuntime(spec)) {
    await heartbeatGenerationJob(job.id, workerId, { percent: 2, stage: "runtime_generation", detail: "building bespoke game runtime" });
    const generated = await generateAgenticGameModule(
      sourceProject.prompt,
      { ...spec, agenticPlayRoute: "agentic" },
      undefined,
      { bounded: true },
    );
    if (!generated.ok) throw new Error(`game_runtime_generation_failed:${generated.reason}`);
    spec = { ...spec, agenticPlayRoute: "agentic", agenticModule: generated.module };
    await prisma.project.update({ where: { id: sourceProject.id }, data: { specJson: JSON.stringify(spec), title: spec.title } });
  }

  await markCreativeRevisionGenerating(job.creativeRevisionId);
  await heartbeatGenerationJob(job.id, workerId, { percent: 3, stage: "design_director", detail: "locking player fantasy and first-minute contract" });
  const assetArtifact = await executeGameAssetJob(job, workerId, spec);
  let assetManifest: unknown = null;
  try { assetManifest = assetArtifact.contentJson ? JSON.parse(assetArtifact.contentJson) : null; } catch { /* rejected below */ }

  await heartbeatGenerationJob(job.id, workerId, { percent: 72, stage: "gameplay_and_art_review", detail: "reviewing gameplay, art and interaction deliverables" });
  const run = buildGameProductionRun({ spec, prompt: sourceProject.prompt, brief: briefResult.data, assetManifest });
  let lastArtifact = assetArtifact;
  for (let index = 0; index < run.artifacts.length; index += 1) {
    const artifact = run.artifacts[index]!;
    await heartbeatGenerationJob(job.id, workerId, {
      percent: 74 + index * 3,
      stage: String(artifact.metadata.role ?? "production"),
      detail: `persisting ${artifact.kind}`,
    });
    lastArtifact = await createCreativeArtifact({
      creativeProjectId: job.creativeProjectId,
      creativeRevisionId: job.creativeRevisionId,
      idempotencyKey: `${artifact.kind}:${job.creativeRevisionId}`,
      artifact,
    });
  }
  await createCreativeArtifact({
    creativeProjectId: job.creativeProjectId,
    creativeRevisionId: job.creativeRevisionId,
    idempotencyKey: `game_production_run:${job.creativeRevisionId}`,
    artifact: {
      kind: "game_production_run",
      mediaType: "report",
      content: { version: run.version, kind: run.kind, status: run.status, passes: run.passes },
      metadata: { status: run.status, passes: run.passes.length },
    },
  });
  const candidateArtifact = await createCreativeArtifact({
    creativeProjectId: job.creativeProjectId,
    creativeRevisionId: job.creativeRevisionId,
    idempotencyKey: `game_production_candidate:${job.creativeRevisionId}`,
    artifact: {
      kind: "game_production_candidate",
      mediaType: "report",
      content: run.candidate,
      metadata: { decision: run.candidate.decision, score: run.candidate.score },
    },
  });
  if (run.candidate.decision === "ready_for_playtest") {
    await finalizeCreativeRevision(job.creativeRevisionId, `production candidate ${run.candidate.score}/100 · ready for observed playtest`);
    await reconcileGamePlaytestEvidenceForRevision({ projectId: payload.projectId, creativeRevisionId: job.creativeRevisionId });
  } else {
    await markCreativeRevisionFailed(job.creativeRevisionId, `production candidate rejected · ${run.candidate.blockers.join(", ")}`);
  }
  return candidateArtifact ?? lastArtifact;
}

async function executeGameIterationJob(
  job: { id: string; creativeProjectId: string; creativeRevisionId: string | null; payloadJson: string },
  workerId: string,
) {
  const payload = GameIterationJobPayloadSchema.parse(JSON.parse(job.payloadJson));
  if (job.creativeRevisionId !== payload.sourceRevisionId) throw new Error("game_iteration_source_revision_mismatch");
  const project = await prisma.project.findUnique({ where: { id: payload.projectId } });
  if (!project || project.ownerKey !== payload.ownerKey) throw new Error("game_iteration_project_missing");
  const sourceRevision = await prisma.creativeRevision.findFirst({
    where: { id: payload.sourceRevisionId, creativeProjectId: job.creativeProjectId, status: "ready" },
    select: { id: true },
  });
  if (!sourceRevision) throw new Error("game_iteration_source_not_ready");
  const currentSpec = parseGameSpec(JSON.parse(project.specJson));
  const instruction = [
    "根据真实匿名试玩数据做一次小步质量修订。保留游戏身份、主题和核心规则，只修改被点名的问题；必须保持手机 H5 可完成。",
    `失败诊断：${payload.diagnoses.join("、") || "未分类"}`,
    `修订目标：${payload.revisionTargets.join("、") || "game_feel"}`,
    "优先缩短首次有效反馈、澄清操作、调整早期难度，并增加两分钟内可感知的成长；不要只改文案。",
  ].join("\n");
  await heartbeatGenerationJob(job.id, workerId, { percent: 15, stage: "automatic_iteration", detail: instruction });
  const patched = isRefinementStubEnabled()
    ? { ok: true as const, spec: refineSpecWithStub({ mode: "patch", spec: currentSpec, instruction, currentPrompt: project.prompt }).spec }
    : await patchGameSpecWithLlm({ instruction, currentSpec, currentPrompt: project.prompt });
  if (!patched.ok) throw new Error(`game_iteration_llm_failed:${patched.errorKey}`);
  let nextSpec = patched.spec;
  if (shouldUseAgenticRuntime(currentSpec)) {
    const generated = await generateAgenticGameModule(
      project.prompt,
      { ...nextSpec, agenticPlayRoute: "agentic" },
      undefined,
      { bounded: true },
    );
    if (!generated.ok) throw new Error(`game_iteration_runtime_failed:${generated.reason}`);
    nextSpec = { ...nextSpec, agenticPlayRoute: "agentic", agenticModule: generated.module };
  }
  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { specJson: JSON.stringify(nextSpec), title: nextSpec.title, featured: false },
  });
  await heartbeatGenerationJob(job.id, workerId, { percent: 70, stage: "revision", detail: "creating immutable revised candidate" });
  const core = await mirrorGameToCreatorCore({
    project: updated,
    cause: "refine",
    deferFinalization: true,
    parentRevisionId: payload.sourceRevisionId,
    iterationReason: { diagnoses: payload.diagnoses, targets: payload.revisionTargets },
  });
  const production = await enqueueGenerationJob({
    creativeProjectId: core.creativeProjectId,
    creativeRevisionId: core.creativeRevisionId,
    type: "game_production",
    idempotencyKey: `game-production:${project.id}:${core.creativeRevisionId}`,
    payload: {
      projectId: project.id,
      ownerKey: project.ownerKey,
      spec: nextSpec,
      brief: parseStoredCreativeBrief(project.creativeBriefJson),
      uiLocale: payload.uiLocale,
    },
  });
  return createCreativeArtifact({
    creativeProjectId: core.creativeProjectId,
    creativeRevisionId: core.creativeRevisionId,
    idempotencyKey: `game_iteration_result:${core.creativeRevisionId}`,
    artifact: {
      kind: "game_iteration_result",
      mediaType: "report",
      content: { version: 1, sourceRevisionId: payload.sourceRevisionId, revisionId: core.creativeRevisionId, productionJobId: production.id, diagnoses: payload.diagnoses, revisionTargets: payload.revisionTargets },
      metadata: { role: "iteration_agent", sourceRevisionId: payload.sourceRevisionId },
    },
  });
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

function jobUiLocale(payloadJson: string): string | undefined {
  try {
    const payload = JSON.parse(payloadJson) as { uiLocale?: unknown };
    return typeof payload.uiLocale === "string" && payload.uiLocale.trim()
      ? payload.uiLocale.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Durable-job execution boundary. New job types are added here only after
 * their payload schema and idempotency behavior have an integration test.
 */
export async function processNextGenerationJob(workerId: string) {
  const job = await claimGenerationJob(workerId);
  if (!job) return null;
  return withGenerationJobContext(
    job.id,
    async () => {
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
        if (job.type === "game_production") {
          const artifact = await executeGameProductionJob(job, workerId);
          await completeGenerationJob(job.id, artifact.id);
          return { id: job.id, type: job.type, status: "completed" as const, outputArtifactId: artifact.id };
        }
        if (job.type === "game_iteration") {
          const artifact = await executeGameIterationJob(job, workerId);
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
        if (job.type === "game_production" && failed.status === "failed" && job.creativeRevisionId) {
          await markCreativeRevisionFailed(job.creativeRevisionId, `production execution failed · ${error instanceof Error ? error.message : String(error)}`);
        }
        return { id: job.id, type: job.type, status: failed.status as "retrying" | "failed" };
      }
    },
    { uiLocale: jobUiLocale(job.payloadJson) },
  );
}
