import type { Novel } from "@prisma/client";
import type { AppLocale } from "@/i18n/routing";
import { emitGenerateServeLog } from "@/lib/api/generate-serve-log";
import { getActiveProvider, getNovelStyleTextModelCascade } from "@/lib/llm";
import { mirrorNovelToCreatorCore } from "@/lib/creator-core/novel-bridge";
import { progressNovelMessage } from "@/lib/i18n/progress-message";
import { generateNovelSynopsis } from "@/lib/novel-synopsis";
import { novelMaxChars, parseNovelLengthTier } from "@/lib/novel-length";
import { planLongNovelSegments } from "@/lib/novel-long-config";
import { streamLongNovelContinue } from "@/lib/novel-long-continue";
import { assessNovelCompleteness } from "@/lib/novel-completeness";
import { repairPlannedNovelCompleteness } from "@/lib/novel-completeness-repair";
import { saveNovelCheckpointAndContent } from "@/lib/novel-generate-checkpoint";
import { persistNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import type { NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import { prisma } from "@/lib/prisma";

type ContinuationNovel = Pick<Novel, "id" | "ownerKey" | "title" | "prompt" | "content" | "summary" | "lengthTier" | "updatedAt">;
export type NovelContinuationEvent = Record<string, unknown>;

export type NovelContinuationResult =
  | { status: "completed"; novel: Novel; model: string; provider: string; core: { creativeProjectId: string; creativeRevisionId: string } | { status: "degraded" } }
  | { status: "conflict" }
  | { status: "failed" };

type ExecutorDependencies = {
  models?: readonly string[];
  providerLabel?: string;
  continueLong?: typeof streamLongNovelContinue;
  assessCompleteness?: typeof assessNovelCompleteness;
  repairCompleteness?: typeof repairPlannedNovelCompleteness;
  generateSynopsis?: typeof generateNovelSynopsis;
  saveCheckpoint?: typeof saveNovelCheckpointAndContent;
  persistMeta?: typeof persistNovelGenerationMeta;
  updateNovel?: (input: { novelId: string; expectedUpdatedAt: Date; content: string; summary: string | null }) => Promise<Novel>;
  mirror?: typeof mirrorNovelToCreatorCore;
  log?: typeof emitGenerateServeLog;
};

/**
 * Shared completion boundary for SSE and the durable worker.  Checkpoints move
 * the expected version forward, while a user edit after the latest checkpoint
 * still prevents the final manuscript overwrite.
 */
export async function executeNovelContinuation(input: {
  novel: ContinuationNovel;
  meta: NovelGenerationMeta | null;
  maxChaptersToWrite: number | null;
  polish: boolean;
  uiLocale: AppLocale;
  requestId: string;
  phase: "novel_continue_stream" | "novel_continue_job";
  emit?: (event: NovelContinuationEvent) => void;
  signal?: AbortSignal;
  onCheckpointSaved?: (info: { index: number; contentLength: number }) => Promise<void> | void;
  dependencies?: ExecutorDependencies;
}): Promise<NovelContinuationResult> {
  const { novel, meta, uiLocale } = input;
  const emit = input.emit ?? (() => undefined);
  const dependencies = input.dependencies ?? {};
  const models = dependencies.models ?? getNovelStyleTextModelCascade();
  const providerLabel = dependencies.providerLabel ?? getActiveProvider();
  const continueLong = dependencies.continueLong ?? streamLongNovelContinue;
  const assessCompleteness = dependencies.assessCompleteness ?? assessNovelCompleteness;
  const repairCompleteness = dependencies.repairCompleteness ?? repairPlannedNovelCompleteness;
  const synopsis = dependencies.generateSynopsis ?? generateNovelSynopsis;
  const checkpoint = dependencies.saveCheckpoint ?? saveNovelCheckpointAndContent;
  const persistMeta = dependencies.persistMeta ?? persistNovelGenerationMeta;
  const mirror = dependencies.mirror ?? mirrorNovelToCreatorCore;
  const log = dependencies.log ?? emitGenerateServeLog;
  const lengthTier = parseNovelLengthTier(novel.lengthTier);
  const longPlan = planLongNovelSegments(lengthTier);
  const startedAt = Date.now();
  let expectedUpdatedAt = new Date(novel.updatedAt);

  const updateNovel = dependencies.updateNovel ?? ((data) =>
    prisma.novel.update({
      where: { id: data.novelId, updatedAt: data.expectedUpdatedAt },
      data: { content: data.content, summary: data.summary },
    }));

  for (const model of models) {
    emit({ step: "model_start", model });
    let result: Awaited<ReturnType<typeof streamLongNovelContinue>>;
    try {
      result = await continueLong({
        model,
        promptTrim: novel.prompt,
        titleTrim: novel.title,
        existingContent: novel.content,
        meta,
        lengthTier,
        maxChaptersToWrite: input.maxChaptersToWrite,
        polish: input.polish,
        uiLocale,
        emit,
        signal: input.signal,
        onSegmentCheckpoint: async ({ index, content, meta: partialMeta }) => {
          try {
            const saved = await checkpoint(novel.id, content, partialMeta, {
              completedSegmentIndex: index,
              partialContent: content,
              prompt: novel.prompt,
              title: novel.title,
              lengthTier,
              polish: input.polish,
              plan: longPlan,
              updatedAt: new Date().toISOString(),
            });
            expectedUpdatedAt = saved.updatedAt;
            await input.onCheckpointSaved?.({ index, contentLength: content.length });
            emit({ step: "checkpoint_saved", index });
          } catch (error) {
            emit({ step: "checkpoint_error", message: error instanceof Error ? error.message : String(error) });
          }
        },
      });
    } catch (error) {
      emit({ step: "model_error", model, message: error instanceof Error ? error.message : String(error) });
      continue;
    }

    let content = result.content;
    if (content.length <= novel.content.length) {
      emit({ step: "model_short", model, message: progressNovelMessage(uiLocale, "continueNoDelta"), length: content.length, priorLength: novel.content.length });
      continue;
    }

    try {
      const completeness = assessCompleteness(content, lengthTier, undefined, novel.prompt, result.pipelineMeta.chapterPlan, uiLocale);
      if (!completeness.ok && result.pipelineMeta.chapterPlan) {
        emit({ step: "completeness_repair", message: "正文不完整，自动补章" });
        content = (await repairCompleteness({
          model,
          promptTrim: novel.prompt,
          titleTrim: novel.title,
          content,
          lengthTier,
          pipelineMeta: result.pipelineMeta,
          uiLocale,
          emit,
        })).content;
      }
    } catch (error) {
      emit({ step: "completeness_error", message: error instanceof Error ? error.message : String(error) });
    }

    emit({ step: "synopsis_start", message: progressNovelMessage(uiLocale, "continueSynopsis") });
    let summary: string | null;
    try {
      summary = await synopsis({ model, title: novel.title, prompt: novel.prompt, content, lengthTier, uiLocale });
    } catch (error) {
      emit({ step: "synopsis_error", message: error instanceof Error ? error.message : String(error) });
      summary = novel.summary;
    }

    let saved: Novel;
    try {
      saved = await updateNovel({ novelId: novel.id, expectedUpdatedAt, content, summary });
    } catch {
      return { status: "conflict" };
    }
    let core: { creativeProjectId: string; creativeRevisionId: string } | { status: "degraded" };
    try {
      await persistMeta(novel.id, result.pipelineMeta);
      core = await mirror({ novel: saved, meta: result.pipelineMeta, cause: "refine" });
    } catch (error) {
      // The guarded manuscript save already succeeded. Retrying the whole job
      // here could append another chapter, so surface a degraded Core mirror
      // instead of re-running paid generation against new author state.
      console.error("[novel-core-finalize]", { novelId: novel.id, error });
      core = { status: "degraded" };
    }
    log({
      phase: input.phase,
      requestId: input.requestId,
      durationMs: Date.now() - startedAt,
      byteLength: 0,
      promptChars: novel.prompt.length,
      source: "llm",
      llmProvider: String(providerLabel),
    });
    emit({ step: "done", novel: saved, model, provider: providerLabel, message: progressNovelMessage(uiLocale, "continueDone"), requestId: input.requestId, addedChars: content.length - novel.content.length, maxChars: novelMaxChars(lengthTier) });
    return { status: "completed", novel: saved, model, provider: String(providerLabel), core };
  }
  return { status: "failed" };
}
