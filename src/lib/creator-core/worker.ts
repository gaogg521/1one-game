import {
  ArtifactWritePayloadSchema,
  ComicPanelJobPayloadSchema,
  GameAssetJobPayloadSchema,
  GameProductionJobPayloadSchema,
  GamePreflightIterationJobPayloadSchema,
  GameIterationJobPayloadSchema,
  NovelContinueJobPayloadSchema,
} from "@/lib/creator-core/types";
import { createHash, randomUUID } from "node:crypto";
import { validateGameRuntime, runtimeValidationBlockers } from "@/lib/game-runtime-validation";
import {
  createCreativeArtifact,
  writeProductionArtifact,
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
  renewGenerationJobLease,
  assertGenerationJobLease,
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
import { forgeGameIntoSpec, isGameForgeEnabled } from "@/lib/game-forge/bridge";
import { missingRequiredSlots, runForgeAssetAgent } from "@/lib/game-forge/asset-agent";
import { PRODUCT } from "@/lib/product-config";
import { shouldUseAgenticRuntime } from "@/lib/agentic/game-module";
import { patchGameSpecWithLlm } from "@/lib/spec-patch";
import { mirrorGameToCreatorCore } from "@/lib/creator-core/game-bridge";
import { parseStoredCreativeBrief } from "@/lib/project-creative-brief-db";
import { isRefinementStubEnabled, refineSpecWithStub } from "@/lib/refinement-stub";
import { buildGamePreflightRevisionInstruction, buildGameQualityPolishInstruction, selectGameQualityPolishFindings, shouldScheduleGamePreflightIteration, shouldScheduleGameQualityPolish } from "@/lib/game-preflight-iteration";
import { reviewGameVisuals } from "@/lib/game-visual-review";
import { runtimeLocaleGroupForCurrentRequest } from "@/lib/runtime-locale-routing";
import type { GameArtDirection } from "@/lib/game-art-direction";

async function executeGameAssetJob(
  job: { id: string; creativeProjectId: string; creativeRevisionId: string | null; payloadJson: string },
  workerId: string,
  specOverride?: ReturnType<typeof parseGameSpec>,
  artDirectionOverride?: GameArtDirection,
) {
  const payload = GameAssetJobPayloadSchema.parse(JSON.parse(job.payloadJson));
  const [project, coreProject] = await Promise.all([
    prisma.project.findUnique({
      where: { id: payload.projectId },
      select: { id: true, ownerKey: true, coverPath: true, prompt: true },
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
  const artDirection = artDirectionOverride ?? buildGameArtDirection(spec, briefResult.data, project.prompt);
  const result = await runProjectAssetPipeline({
    projectId: project.id,
    spec,
    prompt: project.prompt,
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
  const persistArtifact = (input: Parameters<typeof createCreativeArtifact>[0]) => writeProductionArtifact(input, job.id, workerId);
  const updateDraft = async (projectId: string, nextSpec: ReturnType<typeof parseGameSpec>) => prisma.$transaction(async tx => {
    if (!await tx.generationJob.count({ where: { id: job.id, workerId, status: "running", leaseExpiresAt: { gt: new Date() } } })) throw new Error("generation_job_lease_lost");
    const latest = await tx.creativeRevision.findFirst({ where: { creativeProjectId: job.creativeProjectId }, orderBy: { sequence: "desc" }, select: { id: true } });
    if (latest?.id !== job.creativeRevisionId) throw new Error("production_revision_superseded");
    return tx.project.update({ where: { id: projectId }, data: { specJson: JSON.stringify(nextSpec), title: nextSpec.title } });
  });
  const payload = GameProductionJobPayloadSchema.parse(JSON.parse(job.payloadJson));
  let spec = parseGameSpec(payload.spec);
  const sourceProject = await prisma.project.findUnique({
    where: { id: payload.projectId },
    select: { id: true, prompt: true, ownerKey: true },
  });
  if (!sourceProject || sourceProject.ownerKey !== payload.ownerKey) throw new Error("game_production_project_missing");
  const revisionState = await prisma.creativeRevision.findUniqueOrThrow({ where: { id: job.creativeRevisionId } });
  if (revisionState.status === "ready") {
    const prior = await prisma.creativeArtifact.findMany({ where: { creativeRevisionId: job.creativeRevisionId, kind: { in: ["game_spec", "game_runtime_validation", "game_production_candidate"] } } });
    const savedSpec = prior.find(a => a.kind === "game_spec");
    const validation = prior.find(a => a.kind === "game_runtime_validation");
    const candidate = prior.find(a => a.kind === "game_production_candidate");
    if (savedSpec?.contentJson && validation?.contentJson && candidate && !runtimeValidationBlockers(parseGameSpec(JSON.parse(savedSpec.contentJson)), JSON.parse(validation.contentJson), sourceProject.id).length) return candidate;
    throw new Error("production_revision_sealed_without_runtime_verification");
  }
  spec = { ...spec, agenticPlayRoute: "independent" };
  const briefResult = payload.brief == null ? { success: true as const, data: null } : CREATIVE_BRIEF_SCHEMA.safeParse(payload.brief);
  if (!briefResult.success) throw new Error("game_production_brief_invalid");

  // Never reuse a previous executable: each production round must receive a
  // newly generated game-specific independent runtime.
  const { agenticModule: _previousRuntime, ...withoutPreviousRuntime } = spec;
  spec = withoutPreviousRuntime;
  await assertGenerationJobLease(job.id, workerId);
  await updateDraft(sourceProject.id, spec);

  await markCreativeRevisionGenerating(job.creativeRevisionId);
  // The model-generated runtime is the first deliverable.  Assets and BGM may
  // continue afterwards, but they must never keep a creator from receiving a
  // playable original game.
  await heartbeatGenerationJob(job.id, workerId, { percent: 2, stage: "art_direction", detail: "preparing model context" });
  const artDirection = buildGameArtDirection(spec, briefResult.data, sourceProject.prompt);
  await heartbeatGenerationJob(job.id, workerId, { percent: 12, stage: "runtime_code_agent", detail: "generating an original independent playable runtime" });
  // Runtime generation can legitimately span several provider attempts. Keep
  // the durable lease alive while the model is still working so another worker
  // cannot reclaim the same revision midway through code generation.
  const runtimeHeartbeat = setInterval(() => {
    void heartbeatGenerationJob(job.id, workerId, {
      percent: 60,
      stage: "runtime_code_agent",
      detail: "waiting for independent runtime generation",
    });
  }, 45_000);
  let forgeBuild: Awaited<ReturnType<typeof forgeGameIntoSpec>> | null = null;
  // Held in a box: the assignment happens inside the forge's art callback,
  // which TypeScript's control-flow analysis cannot see running, so a plain
  // `let` would still be narrowed to null at every use below.
  type ForgeArtRecord = { run: Awaited<ReturnType<typeof runForgeAssetAgent>>; design: Parameters<typeof missingRequiredSlots>[0] };
  const artState: { current: ForgeArtRecord | null } = { current: null };
  try {
    if (isGameForgeEnabled()) {
      // Multi-agent build: design doc, parallel module code agents, QA audit
      // and module-scoped repair rounds. Each pass changes a real deliverable.
      forgeBuild = await forgeGameIntoSpec(sourceProject.prompt, spec, {
        brief: briefResult.data ? JSON.stringify(briefResult.data).slice(0, 6000) : null,
        onProgress: async (stage, detail, percent, milestone) => {
          await heartbeatGenerationJob(job.id, workerId, {
            percent: Math.min(80, percent),
            stage: `forge_${stage}`,
            detail,
            milestone,
          });
        },
        // Art depends only on the design, so the forge starts it the moment
        // the design lands and it runs alongside the code agents. Doing it
        // afterwards added its whole duration to the creator's wait.
        generateArt: async (design, onSlotDone) => {
          const run = await runForgeAssetAgent(sourceProject.id, design, {
            onSlotDone: (slot) => onSlotDone({ key: slot.key, kind: slot.kind, url: slot.url, done: slot.done, total: slot.total }),
          });
          artState.current = { run, design };
          return { generated: run.generated, failed: run.failed, durationMs: run.durationMs };
        },
      });
      if (!forgeBuild.ok) throw new Error(forgeBuild.reason);
      spec = forgeBuild.spec;
    } else {
      const legacy = await generateAgenticGameModule(sourceProject.prompt, spec, undefined, { bounded: true });
      if (!legacy.ok) throw new Error(legacy.reason);
      spec = { ...spec, agenticModule: legacy.module, agenticPlayRoute: "independent" };
    }
  } finally {
    clearInterval(runtimeHeartbeat);
  }
  await assertGenerationJobLease(job.id, workerId);
  await updateDraft(sourceProject.id, spec);

  // The art agent already ran in parallel with the code agents inside the
  // forge; only its report is persisted here.
  const artRun = artState.current;
  if (artRun) {
    let run = artRun.run;
    let missing = missingRequiredSlots(artRun.design, run);
    let retried = 0;
    /*
     * A required slot that failed used to stay failed forever: the game shipped
     * serving 404 for its own protagonist, the runtime fell back to a primitive,
     * and the quality report blamed the runtime for "not using the artwork".
     * Image generation is flaky enough that one narrow retry is worth it.
     *
     * But only a flaky failure. Observed in production: every sprite slot failed
     * with "未配置 GEMINI_API_KEY", and retrying spent another 75 seconds per
     * slot to be told the same thing. A missing credential does not differ on a
     * second attempt, so those slots are reported, not retried.
     */
    const deterministicFailure = /未配置|not configured|missing .*key|invalid.*api[_ ]?key|401|403/i;
    const retryable = missing.filter((key) => {
      const failure = run.results.find((slot) => slot.key === key);
      return !failure?.error || !deterministicFailure.test(failure.error);
    });
    if (missing.length && !retryable.length) {
      console.error("[forge_art_retry_skipped]", { jobId: job.id, slots: missing.length, reason: "deterministic_failure" });
    }
    if (retryable.length) {
      await heartbeatGenerationJob(job.id, workerId, { percent: 75, stage: "asset_generation", detail: `retrying ${retryable.length} required art slot(s)` });
      const retryDesign = { ...artRun.design, assets: artRun.design.assets.filter((slot) => retryable.includes(slot.key)) };
      const retry = await runForgeAssetAgent(sourceProject.id, retryDesign, { budgetMs: PRODUCT.gameForge.artBudgetMs }).catch((error) => {
        console.error("[forge_art_retry_failed]", { jobId: job.id, reason: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
        return null;
      });
      if (retry) {
        retried = retry.results.filter((slot) => slot.url).length;
        const recovered = new Map(retry.results.filter((slot) => slot.url).map((slot) => [slot.key, slot]));
        const results = run.results.map((slot) => recovered.get(slot.key) ?? slot);
        run = { ...run, results, generated: results.filter((slot) => slot.url).length, failed: results.filter((slot) => !slot.url).length };
        missing = missingRequiredSlots(artRun.design, run);
      }
    }
    await persistArtifact({
      creativeProjectId: job.creativeProjectId,
      creativeRevisionId: job.creativeRevisionId,
      idempotencyKey: `forge_art_run:${job.creativeRevisionId}`,
      artifact: {
        kind: "game_art_run",
        mediaType: "report",
        content: { slots: run.results, generated: run.generated, failed: run.failed, missingRequired: missing, retriedRequiredSlots: retried },
        metadata: { role: "art_agent", generated: run.generated, failed: run.failed, durationMs: run.durationMs, parallelWithCode: true, retriedRequiredSlots: retried },
      },
    });
  }

  await heartbeatGenerationJob(job.id, workerId, { percent: 76, stage: "asset_generation", detail: "generating optional visual assets" });
  let assetArtifact: Awaited<ReturnType<typeof executeGameAssetJob>> | null = null;
  let assetManifest: unknown = null;
  try {
    assetArtifact = await executeGameAssetJob(job, workerId, spec, artDirection);
    assetManifest = assetArtifact.contentJson ? JSON.parse(assetArtifact.contentJson) : null;
  } catch (error) {
    // Asset availability is an iteration signal, not a gate on the runnable
    // model game. The independent runtime receives its own context and can run
    // without a generated visual pack.
    await heartbeatGenerationJob(job.id, workerId, { percent: 82, stage: "asset_generation", detail: `assets deferred: ${error instanceof Error ? error.message.slice(0, 80) : "unknown"}` });
  }
  await heartbeatGenerationJob(job.id, workerId, { percent: 72, stage: "playable_candidate", detail: "validating independent playable candidate" });
  let deliveredFrame: Buffer | null = null;
  const runtimeValidation = await validateGameRuntime(spec, sourceProject.id, forgeBuild?.ok ? forgeBuild.build.qa : null, (png) => { deliveredFrame = png; });
  // The art director now actually looks at the delivered frame. A review that
  // cannot run returns null and the build is judged exactly as before, so a
  // missing vision route never turns into an invented verdict.
  await heartbeatGenerationJob(job.id, workerId, { percent: 76, stage: "visual_review_agent", detail: "reviewing the delivered frame" });
  const visualReview = await reviewGameVisuals({
    screenshot: deliveredFrame,
    artDirection,
    title: spec.title,
    localeGroup: await runtimeLocaleGroupForCurrentRequest(),
  }).catch(() => null);
  const run = buildGameProductionRun({
    spec,
    prompt: sourceProject.prompt,
    brief: briefResult.data,
    assetManifest,
    projectId: sourceProject.id,
    runtimeValidation,
    productionRound: payload.productionRound,
    realAgentOutputs: { artDirection, ...(visualReview ? { visualReview } : {}) },
  });
  let lastArtifact = assetArtifact;
  for (let index = 0; index < run.artifacts.length; index += 1) {
    const artifact = run.artifacts[index]!;
    await heartbeatGenerationJob(job.id, workerId, {
      percent: 74 + index * 3,
      stage: String(artifact.metadata.role ?? "production"),
      detail: `persisting ${artifact.kind}`,
    });
    lastArtifact = await persistArtifact({
      creativeProjectId: job.creativeProjectId,
      creativeRevisionId: job.creativeRevisionId,
      idempotencyKey: `${artifact.kind}:${job.creativeRevisionId}`,
      artifact,
    });
  }
  await persistArtifact({
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
  const candidateArtifact = await persistArtifact({
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
    await assertGenerationJobLease(job.id, workerId);
    // The revision started with a design-only spec. Seal the actual executable
    // before marking it ready so publishing cannot select that earlier shell.
    await prisma.$transaction(async tx => {
      if (!await tx.generationJob.count({ where: { id: job.id, workerId, status: "running", leaseExpiresAt: { gt: new Date() } } })) throw new Error("generation_job_lease_lost");
      await tx.creativeArtifact.updateMany({
        where: { creativeRevisionId: job.creativeRevisionId, kind: "game_spec" },
        data: { contentJson: JSON.stringify(spec), contentHash: createHash("sha256").update(JSON.stringify(spec)).digest("hex") },
      });
      await tx.creativeRevision.update({ where: { id: job.creativeRevisionId!, status: "generating" }, data: { status: "ready", finalizedAt: new Date(), summary: "runtime verified · ready for observed playtest" } });
    });
    await reconcileGamePlaytestEvidenceForRevision({ projectId: payload.projectId, creativeRevisionId: job.creativeRevisionId }).catch(() => console.error("[game_playtest_reconcile_deferred]", { jobId: job.id }));
    /*
     * The build ships either way -- it is already marked ready above and the
     * player can open it now. But a game that runs is not automatically a game
     * worth playing, and every quality finding here used to die as evidence
     * nobody consumed. Spend exactly one more round on the findings an agent
     * can actually act on, in the background, without gating anything.
     */
    const polishFindings = selectGameQualityPolishFindings(run.candidate.advisories ?? []);
    if (shouldScheduleGameQualityPolish({
      productionRound: payload.productionRound,
      maxProductionRounds: payload.maxProductionRounds,
      findings: polishFindings,
    })) {
      await enqueueGenerationJob({
        creativeProjectId: job.creativeProjectId,
        creativeRevisionId: job.creativeRevisionId,
        type: "game_preflight_iteration",
        idempotencyKey: `game-quality-polish:${job.creativeRevisionId}`,
        payload: {
          projectId: payload.projectId,
          ownerKey: payload.ownerKey,
          sourceRevisionId: job.creativeRevisionId,
          // The round it produces is productionRound + 1, and polish only fires
          // at round 1, so this chain is exactly one round deep by construction.
          productionRound: payload.productionRound,
          maxProductionRounds: payload.maxProductionRounds,
          blockers: polishFindings,
          mode: "quality_polish",
          uiLocale: payload.uiLocale,
        },
      }).catch((error) => console.error("[game_quality_polish_enqueue_failed]", { jobId: job.id, reason: error instanceof Error ? error.message : "unknown" }));
    }
  } else {
    await markCreativeRevisionFailed(job.creativeRevisionId, `production candidate rejected · ${run.candidate.blockers.join(", ")}`);
    /*
     * An iteration replaces the project's live spec before this round is known
     * to work, so a rejected candidate leaves the player holding an unvalidated
     * build. That was harmless while iteration only ran on already-broken games;
     * once a passing game could be picked up for a quality round, the same path
     * could take a working game offline. Put the last accepted build back.
     */
    await restoreLastReadyProjectSpec(job.creativeProjectId, payload.projectId, job.creativeRevisionId);
    if (!run.candidate.blockers.some(blocker => blocker.includes("verification")) && shouldScheduleGamePreflightIteration({
      productionRound: payload.productionRound,
      maxProductionRounds: payload.maxProductionRounds,
      blockers: run.candidate.blockers,
    })) {
      await enqueueGenerationJob({
        creativeProjectId: job.creativeProjectId,
        creativeRevisionId: job.creativeRevisionId,
        type: "game_preflight_iteration",
        idempotencyKey: `game-preflight-iteration:${job.creativeRevisionId}:${payload.productionRound}`,
        payload: {
          projectId: payload.projectId,
          ownerKey: payload.ownerKey,
          sourceRevisionId: job.creativeRevisionId,
          productionRound: payload.productionRound,
          maxProductionRounds: payload.maxProductionRounds,
          blockers: run.candidate.blockers,
          uiLocale: payload.uiLocale,
        },
      });
    }
    throw new GameRuntimeRejectedError(run.candidate.blockers);
  }
  return candidateArtifact ?? lastArtifact;
}

class GameRuntimeRejectedError extends Error {
  constructor(readonly blockers: string[]) { super(blockers.join(", ")); }
}

/**
 * Puts the project back on the newest revision that actually passed, so a
 * failed automatic round never leaves a playable game unplayable. No-op when
 * the project is already serving that spec, or when nothing has ever passed.
 */
async function restoreLastReadyProjectSpec(creativeProjectId: string, projectId: string, failedRevisionId: string | null) {
  try {
    const lastReady = await prisma.creativeRevision.findFirst({
      where: { creativeProjectId, status: "ready", ...(failedRevisionId ? { id: { not: failedRevisionId } } : {}) },
      orderBy: { sequence: "desc" },
      select: { id: true, sequence: true },
    });
    if (!lastReady) return;
    const artifact = await prisma.creativeArtifact.findFirst({
      where: { creativeRevisionId: lastReady.id, kind: "game_spec", status: "ready" },
      orderBy: { createdAt: "asc" },
      select: { contentJson: true },
    });
    if (!artifact?.contentJson) return;
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { specJson: true } });
    if (!project || project.specJson === artifact.contentJson) return;
    const spec = parseGameSpec(JSON.parse(artifact.contentJson));
    await prisma.project.update({ where: { id: projectId }, data: { specJson: JSON.stringify(spec), title: spec.title } });
    console.error("[game_spec_rolled_back]", { projectId, restoredSequence: lastReady.sequence });
  } catch (error) {
    // Never let the rollback mask the rejection that triggered it.
    console.error("[game_spec_rollback_failed]", { projectId, reason: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
  }
}

async function executeGamePreflightIterationJob(
  job: { id: string; creativeProjectId: string; creativeRevisionId: string | null; payloadJson: string },
  workerId: string,
) {
  const payload = GamePreflightIterationJobPayloadSchema.parse(JSON.parse(job.payloadJson));
  if (job.creativeRevisionId !== payload.sourceRevisionId) throw new Error("game_preflight_iteration_revision_mismatch");
  const project = await prisma.project.findUnique({ where: { id: payload.projectId } });
  if (!project || project.ownerKey !== payload.ownerKey) throw new Error("game_preflight_iteration_project_missing");
  const sourceSpecArtifact = await prisma.creativeArtifact.findFirst({
    where: { creativeProjectId: job.creativeProjectId, creativeRevisionId: payload.sourceRevisionId, kind: "game_spec", status: "ready" },
    orderBy: { createdAt: "asc" },
    select: { contentJson: true },
  });
  if (!sourceSpecArtifact?.contentJson) throw new Error("game_preflight_iteration_source_spec_missing");
  const isQualityPolish = payload.mode === "quality_polish";
  const instruction = isQualityPolish
    ? buildGameQualityPolishInstruction(payload.blockers)
    : buildGamePreflightRevisionInstruction(payload);
  await heartbeatGenerationJob(job.id, workerId, { percent: 12, stage: isQualityPolish ? "quality_polish_revision" : "design_agent_revision", detail: `round ${payload.productionRound + 1}/${payload.maxProductionRounds}` });
  const currentSpec = parseGameSpec(JSON.parse(sourceSpecArtifact.contentJson));
  // A polish finding such as a letterboxed stage is a design change, not a
  // rebuild of the same design, so it must go through the spec patch.
  const runtimeRepairOnly = !isQualityPolish && payload.blockers.every((blocker) =>
    blocker.startsWith("runtime_") ||
    blocker.startsWith("browser_") ||
    blocker.startsWith("mechanic_missing:") ||
    blocker === "independent_runtime_missing",
  );
  // Runtime and browser failures require a new executable, not another design
  // report. Preserve the design contract and invalidate the stale module so
  // the next production round is routed straight to the code Agent.
  const patched = runtimeRepairOnly
    ? { ok: true as const, spec: currentSpec }
    : isRefinementStubEnabled()
      ? { ok: true as const, spec: refineSpecWithStub({ mode: "patch", spec: currentSpec, instruction, currentPrompt: project.prompt }).spec }
      : await patchGameSpecWithLlm({ instruction, currentSpec, currentPrompt: project.prompt });
  if (!patched.ok) throw new Error(`game_preflight_iteration_patch_failed:${patched.errorKey}`);
  const { agenticModule: _staleModule, ...withoutStaleModule } = patched.spec;
  const nextSpec = { ...withoutStaleModule, agenticPlayRoute: "independent" as const };
  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { specJson: JSON.stringify(nextSpec), title: nextSpec.title, featured: false },
  });
  await heartbeatGenerationJob(job.id, workerId, { percent: 62, stage: "versioning", detail: "persisting revised immutable candidate" });
  const core = await mirrorGameToCreatorCore({
    project: updated,
    cause: "refine",
    deferFinalization: true,
    parentRevisionId: payload.sourceRevisionId,
    iterationReason: { diagnoses: payload.blockers, targets: ["core_loop", "game_feel"] },
  });
  const nextRound = payload.productionRound + 1;
  const production = await enqueueGenerationJob({
    creativeProjectId: core.creativeProjectId,
    creativeRevisionId: core.creativeRevisionId,
    type: "game_production",
    idempotencyKey: `game-production:${project.id}:${core.creativeRevisionId}:round-${nextRound}`,
    payload: {
      projectId: project.id,
      ownerKey: project.ownerKey,
      spec: nextSpec,
      brief: parseStoredCreativeBrief(project.creativeBriefJson),
      uiLocale: payload.uiLocale,
      productionRound: nextRound,
      maxProductionRounds: payload.maxProductionRounds,
    },
  });
  return createCreativeArtifact({
    creativeProjectId: core.creativeProjectId,
    creativeRevisionId: core.creativeRevisionId,
    idempotencyKey: `game_preflight_iteration:${core.creativeRevisionId}`,
    artifact: {
      kind: "game_preflight_iteration",
      mediaType: "report",
      content: { version: 1, round: nextRound, maxRounds: payload.maxProductionRounds, sourceRevisionId: payload.sourceRevisionId, blockers: payload.blockers, productionJobId: production.id },
      metadata: { role: runtimeRepairOnly ? "runtime_engineer" : "gameplay_designer", round: nextRound, mutates: runtimeRepairOnly ? ["agentic_runtime"] : ["game_spec", "agentic_runtime"] },
    },
  });
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
      { ...nextSpec, agenticPlayRoute: "independent" },
      undefined,
      { bounded: true },
    );
    if (!generated.ok) throw new Error(`game_iteration_runtime_failed:${generated.reason}`);
    nextSpec = { ...nextSpec, agenticPlayRoute: "independent", agenticModule: generated.module };
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
export async function processNextGenerationJob(workerId: string, preferredJobId?: string) {
  workerId = `${workerId.slice(0, 48)}:${randomUUID()}`;
  const job = await claimGenerationJob(workerId, 90_000, preferredJobId);
  if (!job) return null;
  const leaseTimer = setInterval(() => {
    void renewGenerationJobLease(job.id, workerId).catch(() => undefined);
  }, 20_000);
  try {
  return await withGenerationJobContext(
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
          await completeGenerationJob(job.id, artifact.id, workerId);
          return { id: job.id, type: job.type, status: "completed" as const, outputArtifactId: artifact.id };
        }
        if (job.type === "comic_panel") {
          await executeComicPanelJob(job, workerId);
          await completeGenerationJob(job.id, undefined, workerId);
          return { id: job.id, type: job.type, status: "completed" as const };
        }
        if (job.type === "game_asset") {
          const artifact = await executeGameAssetJob(job, workerId);
          await completeGenerationJob(job.id, artifact.id, workerId);
          return { id: job.id, type: job.type, status: "completed" as const, outputArtifactId: artifact.id };
        }
        if (job.type === "game_production") {
          const artifact = await executeGameProductionJob(job, workerId);
          await completeGenerationJob(job.id, artifact.id, workerId);
          return { id: job.id, type: job.type, status: "completed" as const, outputArtifactId: artifact.id };
        }
        if (job.type === "game_preflight_iteration") {
          const artifact = await executeGamePreflightIterationJob(job, workerId);
          await completeGenerationJob(job.id, artifact.id, workerId);
          return { id: job.id, type: job.type, status: "completed" as const, outputArtifactId: artifact.id };
        }
        if (job.type === "game_iteration") {
          const artifact = await executeGameIterationJob(job, workerId);
          await completeGenerationJob(job.id, artifact.id, workerId);
          return { id: job.id, type: job.type, status: "completed" as const, outputArtifactId: artifact.id };
        }
        if (job.type === "novel_continue") {
          const result = await executeNovelContinueJob(job, workerId);
          if (result.status === "conflict") {
            const failed = await failGenerationJob(job.id, new Error("novel_continuation_conflict"), {
              retry: false,
              errorCode: "novel_continuation_conflict",
              workerId,
            });
            return { id: job.id, type: job.type, status: failed.status as "failed" };
          }
          if (result.status !== "completed") throw new Error("novel_continue_all_models_failed");
          await completeGenerationJob(job.id, undefined, workerId);
          return { id: job.id, type: job.type, status: "completed" as const };
        }
        throw new Error(`unsupported_generation_job:${job.type}`);
      } catch (error) {
        if (error instanceof Error && error.message === "generation_job_lease_lost") return { id: job.id, type: job.type, status: "failed" as const };
        const failed = await failGenerationJob(job.id, error, { workerId, ...(error instanceof GameRuntimeRejectedError ? { retry: false, errorCode: error.blockers.some(b => /verification/.test(b)) ? "runtime_verification_unavailable" : "runtime_validation_failed" } : {}) });
        if (job.type === "game_production" && failed.status === "failed" && job.creativeRevisionId) {
          await markCreativeRevisionFailed(job.creativeRevisionId, `production execution failed · ${error instanceof Error ? error.message : String(error)}`);
        }
        return { id: job.id, type: job.type, status: failed.status as "retrying" | "failed" };
      }
    },
    { uiLocale: jobUiLocale(job.payloadJson) },
  );
  } finally {
    clearInterval(leaseTimer);
  }
}
