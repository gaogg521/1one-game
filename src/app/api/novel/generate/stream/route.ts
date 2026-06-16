import { defaultWorkVisibility } from "@/lib/auth/work-visibility";
import { generationErrorCodes } from "@/lib/api/json-error-response";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { emitGenerateServeLog } from "@/lib/api/generate-serve-log";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { getActiveProvider, getNovelStyleTextModelCascade, llmNovelTextStream } from "@/lib/llm";
import { ensureNovelCoverAfterCreate } from "@/lib/cover-generation";
import { resolveNovelCoverGenre } from "@/lib/cover-genre";
import {
  getNovelSystemPrompt,
  buildNovelUserMessage,
  novelLlmMaxOutputTokens,
  novelLlmTemperature,
  novelLlmTimeoutMs,
  novelMinAcceptChars,
} from "@/lib/novel-generate-config";
import { extractNovelTitleFromContent, validateNovelTitleInput } from "@/lib/novel-display";
import { localizedApiErrorPayload } from "@/lib/api/localized-error";
import { generateNovelSynopsis } from "@/lib/novel-synopsis";
import { getChildrenAgeTier, parseChildrenTargetAge } from "@/lib/children-age-length";
import { finalizeChildrenNovelContent } from "@/lib/children-novel-postprocess";
import { persistChildrenNovelMeta } from "@/lib/children-novel-meta-db";
import {
  isChildrenNovelTier,
  novelGenerationEtaHint,
  novelMaxChars,
  resolveNovelLengthTier,
  type NovelLengthOptions,
} from "@/lib/novel-length";
import { accumulateNovelTextStream } from "@/lib/novel-stream-accumulate";
import {
  planLongNovelSegments,
  streamLongNovelBody,
  usesSegmentedLongGeneration,
} from "@/lib/novel-long-generate";
import { streamPlannedNovelBody } from "@/lib/novel-planned-generate";
import { persistNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import { getOwnerKey } from "@/lib/owner";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { prisma } from "@/lib/prisma";
import { resolveMediaCreativeBrief } from "@/lib/creative-brief/resolve-media-brief";
import { detectBriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import {
  parseChildrenCreativeBrief,
  parseNovelCreativeBrief,
  type ChildrenBriefUserRevision,
  type NovelBriefUserRevision,
} from "@/lib/literary-brief";
import { buildChildrenBriefSeed } from "@/lib/literary-brief/children-brief-types";
import {
  saveNovelCreativeBriefJson,
  serializeChildrenCreativeBrief,
  serializeNovelCreativeBrief,
} from "@/lib/novel-creative-brief-db";
import {
  buildNovelBriefSeed,
  buildNovelStoredPrompt,
  getNovelGenreTag,
  isChildrenGenreTag,
} from "@/lib/novel-genre-tags";
import { PRODUCT } from "@/lib/product-config";
import { assessNovelCompleteness } from "@/lib/novel-completeness";
import {
  generateChildrenNovelRaw,
} from "@/lib/novel-completeness-repair";
import {
  createDraftGeneratingNovel,
  finalizeDraftNovel,
  loadNovelGenerationResumeState,
  NOVEL_STATUS_DRAFT_GENERATING,
  saveNovelGenerateCheckpoint,
  updateDraftNovelContent,
} from "@/lib/novel-generate-checkpoint";
import { persistNovelLengthTier } from "@/lib/novel-length-tier-db";
import { gateGenerationQuota } from "@/lib/commerce/generation-gate";
import { shouldChargeNovelStreamQuota } from "@/lib/literary-safety";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { apiErrorMessage, progressNovelMessage } from "@/lib/i18n/progress-message";

/** 长篇流式可跑 20–45+ 分钟；自托管 next start 生效，Serverless 受平台上限约束 */
export const maxDuration = 3600;

/** SSE：增量推送正文 token，完成后写入 DB 并发送 `done`（含完整 novel）。 */
export async function POST(req: Request) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const uiLocale = resolveRequestLocaleSync(req);
  const rl = generateRateLimits();
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("novel_gen_stream", ownerKey);
  if (!rateLimit(throttleKey, rl.streamMax, rl.windowMs)) {
    return new Response(JSON.stringify({ error: apiErrorMessage(uiLocale, "rateLimited"), code: codes.RATE_LIMITED, requestId }), {
      status: 429,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  const json = await readLimitedJson(req, requestId);
  if (!json.ok) {
    return new Response(JSON.stringify(json.payload), {
      status: json.status,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  const {
    prompt,
    title,
    lengthTier: lengthTierRaw,
    polish: polishRaw,
    creativeBrief: creativeBriefRaw,
    briefRevision: briefRevisionRaw,
    novelGenreTag,
    genreId,
    childrenTargetAge: childrenTargetAgeRaw,
    resumeNovelId: resumeNovelIdRaw,
  } = json.body as {
    prompt?: string;
    title?: string;
    lengthTier?: string;
    polish?: boolean;
    creativeBrief?: unknown;
    briefRevision?: NovelBriefUserRevision | ChildrenBriefUserRevision;
    novelGenreTag?: string;
    genreId?: string;
    childrenTargetAge?: number;
    resumeNovelId?: string;
  };
  const normalizedGenreTag = (novelGenreTag ?? genreId)?.trim() || undefined;
  const resumeNovelId = resumeNovelIdRaw?.trim() || undefined;
  const genreTag = getNovelGenreTag(normalizedGenreTag);
  let lengthTier = resolveNovelLengthTier({
    genreTagId: normalizedGenreTag,
    lengthTierPick: lengthTierRaw,
  });
  const titleTrimEarly = title?.trim();
  let promptTrim = typeof prompt === "string" ? prompt.trim() : "";
  if (promptTrim.length < 2 && titleTrimEarly && genreTag) {
    promptTrim = buildNovelStoredPrompt(titleTrimEarly, genreTag);
  }
  if (!resumeNovelId && promptTrim.length < 2) {
    return new Response(JSON.stringify({ error: apiErrorMessage(uiLocale, "needTitleGenre"), code: codes.BAD_REQUEST, requestId }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  let resumeState: Awaited<ReturnType<typeof loadNovelGenerationResumeState>> = null;
  if (resumeNovelId) {
    const draftRow = await prisma.novel.findUnique({ where: { id: resumeNovelId } });
    if (!draftRow || draftRow.ownerKey !== ownerKey || draftRow.status !== NOVEL_STATUS_DRAFT_GENERATING) {
      return new Response(JSON.stringify({ error: apiErrorMessage(uiLocale, "resumeNotFound"), code: codes.BAD_REQUEST, requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
      });
    }
    resumeState = await loadNovelGenerationResumeState(resumeNovelId);
    if (!resumeState) {
      return new Response(JSON.stringify({ error: apiErrorMessage(uiLocale, "resumeCheckpointMissing"), code: codes.BAD_REQUEST, requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
      });
    }
    promptTrim = resumeState.checkpoint.prompt;
    lengthTier = resumeState.checkpoint.lengthTier;
  }

  if (shouldChargeNovelStreamQuota(resumeNovelId)) {
    const quotaBlock = await gateGenerationQuota("novel", {
      long: usesSegmentedLongGeneration(lengthTier),
      uiLocale,
    });
    if (quotaBlock) return quotaBlock;
  }

  const lengthOpts: NovelLengthOptions | undefined = isChildrenNovelTier(lengthTier)
    ? {
        childrenTargetAge: parseChildrenTargetAge(childrenTargetAgeRaw),
        childrenUserPrompt: promptTrim,
      }
    : undefined;

  if (title?.trim()) {
    const tv = validateNovelTitleInput(title.trim());
    if (!tv.ok) {
      return new Response(
        JSON.stringify(
          localizedApiErrorPayload(req, tv.errorKey, {
            code: codes.BAD_REQUEST,
            requestId,
            params: { max: 15 },
          }),
        ),
        {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
      });
    }
  }

  const titleTrim = titleTrimEarly;
  let pipelinePrompt = promptTrim;
  const minChars = novelMinAcceptChars(lengthTier, lengthOpts);
  const timeoutMs = novelLlmTimeoutMs(lengthTier);
  const maxTokens = novelLlmMaxOutputTokens(lengthTier, lengthOpts);
  const longPlan =
    usesSegmentedLongGeneration(lengthTier)
      ? resumeState?.checkpoint.plan ?? planLongNovelSegments(lengthTier)
      : null;
  const longPolish =
    longPlan &&
    (resumeState
      ? resumeState.checkpoint.polish
      : polishRaw !== false && (polishRaw === true || PRODUCT.novel.longSegmented.polishAfterSegment));
  const maxCharsLimit = novelMaxChars(lengthTier, lengthOpts);
  const cascade = getNovelStyleTextModelCascade();
  const providerLabel = getActiveProvider();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (obj: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const startedAt = Date.now();
      let briefJsonToPersist: string | null = null;
      try {
        if (PRODUCT.novel.creativeBriefExpand && !resumeNovelId) {
          const preExpanded =
            parseChildrenCreativeBrief(creativeBriefRaw) ??
            parseNovelCreativeBrief(creativeBriefRaw) ??
            undefined;
          const isChild = isChildrenGenreTag(genreTag?.id) || isChildrenNovelTier(lengthTier);
          const inputLocale = detectBriefInputLocale(promptTrim);
          const briefSeed =
            titleTrim && genreTag && isChild
              ? buildChildrenBriefSeed(
                  titleTrim,
                  promptTrim,
                  parseChildrenTargetAge(lengthOpts?.childrenTargetAge),
                )
              : titleTrim && genreTag
                ? buildNovelBriefSeed(
                    titleTrim,
                    genreTag,
                    "",
                    undefined,
                    inputLocale,
                  )
                : promptTrim;
          const briefResult = await resolveMediaCreativeBrief(briefSeed, "novel", {
            preExpanded,
            userRevision: briefRevisionRaw ?? undefined,
            novelGenreId: genreTag?.id,
            title: titleTrim,
            childrenTargetAge: lengthOpts?.childrenTargetAge ?? undefined,
            inputLocale,
          });
          if (briefResult) {
            pipelinePrompt = briefResult.augmentedPrompt;
            briefJsonToPersist =
              briefResult.kind === "children"
                ? serializeChildrenCreativeBrief(briefResult.brief)
                : serializeNovelCreativeBrief(briefResult.brief);
            send({
              step: "brief",
              summary: briefResult.oneLineSummary,
              brief: briefResult.brief,
              briefKind: briefResult.kind,
            });
          }
        }

        const userMsg = buildNovelUserMessage(
          promptTrim,
          titleTrim,
          lengthTier,
          pipelinePrompt,
          lengthOpts,
        );

        send({
          step: "start",
          message: longPlan
            ? progressNovelMessage(uiLocale, "startLong", {
                polish: longPolish ? progressNovelMessage(uiLocale, "polishSegment") : "",
                eta: novelGenerationEtaHint(lengthTier, uiLocale),
              })
            : progressNovelMessage(uiLocale, "startShort", {
                eta: novelGenerationEtaHint(lengthTier, uiLocale),
              }),
          requestId,
        });

        let saved = false;
        let draftNovelId: string | null = resumeNovelId ?? null;
        if (longPlan && !draftNovelId) {
          const draft = await createDraftGeneratingNovel({
            ownerKey,
            title: titleTrim || progressNovelMessage(uiLocale, "draftTitle"),
            prompt: promptTrim,
          });
          draftNovelId = draft.id;
          await persistNovelLengthTier(draft.id, lengthTier);
          send({ step: "checkpoint_novel", novelId: draft.id, message: progressNovelMessage(uiLocale, "checkpointCreated") });
        } else if (longPlan && draftNovelId) {
          send({ step: "resume_start", novelId: draftNovelId, message: progressNovelMessage(uiLocale, "resumeStart") });
        }

        for (const model of cascade) {
          send({ step: "model_start", model });
          let content = "";
          let pipelineMeta: Awaited<ReturnType<typeof streamLongNovelBody>>["pipelineMeta"] | null =
            null;
          let pipelineCompleteness:
            | Awaited<ReturnType<typeof streamPlannedNovelBody>>["completeness"]
            | undefined;
          const ping = setInterval(() => send({ step: "ping" }), 15_000);
          try {
            if (longPlan && draftNovelId) {
              const longResult = await streamLongNovelBody({
                model,
                promptTrim: pipelinePrompt,
                titleTrim: resumeState?.checkpoint.title ?? titleTrim,
                plan: longPlan,
                lengthTier,
                lengthOpts,
                uiLocale,
                polish: Boolean(longPolish),
                emit: send,
                resume: resumeState
                  ? {
                      bible: resumeState.bible,
                      chapterPlan: resumeState.chapterPlan,
                      plan: resumeState.checkpoint.plan,
                      previousContent: resumeState.checkpoint.partialContent,
                      completedSegmentIndex: resumeState.checkpoint.completedSegmentIndex,
                      promptTrim: resumeState.checkpoint.prompt,
                      titleTrim: resumeState.checkpoint.title,
                      polish: resumeState.checkpoint.polish,
                    }
                  : undefined,
                onPipelineReady: async (meta) => {
                  await persistNovelGenerationMeta(draftNovelId!, meta);
                },
                onSegmentCheckpoint: async ({ index, content: partial, meta }) => {
                  await updateDraftNovelContent(draftNovelId!, partial);
                  await saveNovelGenerateCheckpoint(draftNovelId!, meta, {
                    completedSegmentIndex: index,
                    partialContent: partial,
                    prompt: promptTrim,
                    title: titleTrim,
                    lengthTier,
                    polish: Boolean(longPolish),
                    plan: longPlan,
                    updatedAt: new Date().toISOString(),
                  });
                  send({
                    step: "checkpoint_saved",
                    index: index + 1,
                    length: partial.length,
                    novelId: draftNovelId,
                    message: progressNovelMessage(uiLocale, "batchSaved", { index: index + 1 }),
                  });
                },
              });
              content = longResult.content;
              pipelineMeta = longResult.pipelineMeta;

              if (!longResult.completeness.ok) {
                send({
                  step: "model_short",
                  model,
                  length: content.length,
                  minChars: minChars,
                  message: progressNovelMessage(uiLocale, "completenessFail", {
                    reason: longResult.completeness.reason,
                  }),
                });
                continue;
              }

              send({ step: "synopsis_start", message: progressNovelMessage(uiLocale, "synopsisStart") });
              const summary = await generateNovelSynopsis({
                model,
                title: extractNovelTitleFromContent(content, titleTrim, promptTrim, uiLocale),
                prompt: promptTrim,
                content,
                lengthTier,
                uiLocale,
              });
              const finalTitle = extractNovelTitleFromContent(content, titleTrim, promptTrim, uiLocale);
              await finalizeDraftNovel(draftNovelId, {
                title: finalTitle,
                content,
                summary,
                pipelineMeta,
              });
              if (briefJsonToPersist) {
                await saveNovelCreativeBriefJson(draftNovelId, briefJsonToPersist);
              }
              const novel = await prisma.novel.findUnique({ where: { id: draftNovelId } });
              emitGenerateServeLog({
                phase: resumeNovelId ? "novel_generate_resume_stream" : "novel_generate_stream",
                requestId,
                durationMs: Date.now() - startedAt,
                byteLength: json.byteLength,
                promptChars: promptTrim.length,
                source: "llm",
                llmProvider: String(providerLabel),
              });
              send({
                step: "done",
                novel,
                coverPath: null,
                model,
                provider: providerLabel,
                message: progressNovelMessage(uiLocale, "coverPending"),
                requestId,
              });
              saved = true;
              const coverGenre = resolveNovelCoverGenre({
                genreTagCoverGenre: genreTag?.coverGenre,
                title: finalTitle,
                summary,
                prompt: promptTrim,
                contentSnippet: content.slice(0, 1200),
              });
              void ensureNovelCoverAfterCreate(
                draftNovelId,
                finalTitle,
                summary,
                [promptTrim, content.slice(0, 600)].filter(Boolean).join(" "),
                600_000,
                coverGenre,
                uiLocale,
              ).catch(() => {});
              break;
            } else if (lengthTier === "short" || lengthTier === "medium") {
              const planned = await streamPlannedNovelBody({
                model,
                promptTrim: pipelinePrompt,
                titleTrim,
                lengthTier,
                lengthOpts,
                uiLocale,
                emit: send,
              });
              content = planned.content;
              pipelineMeta = planned.pipelineMeta;
              pipelineCompleteness = planned.completeness;
            } else if (isChildrenNovelTier(lengthTier)) {
              content = await generateChildrenNovelRaw({
                model,
                promptTrim: pipelinePrompt,
                titleTrim,
                lengthOpts,
                uiLocale,
                emit: send,
              });
              pipelineMeta = null;
            } else {
              const { content: accumulated } = await accumulateNovelTextStream({
                maxChars: maxCharsLimit,
                stream: llmNovelTextStream(
                  {
                    model,
                    system: getNovelSystemPrompt(lengthTier, lengthOpts, promptTrim),
                    user: userMsg,
                    temperature: novelLlmTemperature(lengthTier),
                    maxTokens,
                    timeoutMs,
                  },
                  lengthTier,
                ),
                onDelta: (text) => send({ step: "delta", text }),
              });
              content = accumulated;
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            send({ step: "model_error", model, message });
            continue;
          } finally {
            clearInterval(ping);
          }

          if (longPlan) continue;

          let finalTitle = extractNovelTitleFromContent(content, titleTrim, promptTrim, uiLocale);
          let finalContent = content;
          let parentReadingTip: string | undefined;
          let childrenSynopsisBody: string | undefined;
          let childrenInterpretation: string | undefined;
          let completeness: Awaited<ReturnType<typeof assessNovelCompleteness>> | undefined =
            pipelineCompleteness;

          if (isChildrenNovelTier(lengthTier) && lengthOpts?.childrenTargetAge !== undefined) {
            const finalized = finalizeChildrenNovelContent(finalContent, {
              targetAge: parseChildrenTargetAge(lengthOpts.childrenTargetAge),
              fallbackTitle: titleTrim,
              userPrompt: promptTrim,
              uiLocale,
            });
            finalTitle = finalized.dbTitle;
            finalContent = finalized.publishedContent;
            parentReadingTip = finalized.parentReadingTip || undefined;
            childrenSynopsisBody = finalized.body;
            childrenInterpretation = finalized.interpretation || undefined;
          }

          const acceptChars = minChars;
          if (!isChildrenNovelTier(lengthTier) && finalContent.length < acceptChars) {
            send({ step: "model_short", model, length: finalContent.length, minChars: acceptChars });
            continue;
          }

          completeness ??= assessNovelCompleteness(
            finalContent,
            lengthTier,
            lengthOpts,
            promptTrim,
            isChildrenNovelTier(lengthTier) ? null : pipelineMeta?.chapterPlan,
            uiLocale,
          );
          if (!completeness.ok) {
            send({
              step: "model_short",
              model,
              length: finalContent.length,
              minChars: acceptChars,
              message: progressNovelMessage(uiLocale, "completenessFail", { reason: completeness.reason }),
            });
            continue;
          }

          send({ step: "synopsis_start", message: progressNovelMessage(uiLocale, "synopsisStart") });
          const summary = await generateNovelSynopsis({
            model,
            title: finalTitle,
            prompt: promptTrim,
            content: childrenSynopsisBody ?? finalContent,
            lengthTier,
            uiLocale,
          });

          const novel = await prisma.novel.create({
            data: {
              ownerKey,
              title: finalTitle,
              prompt: promptTrim,
              content: finalContent,
              summary:
                parentReadingTip && lengthOpts?.childrenTargetAge !== undefined
                  ? `${summary ?? ""}\n\n${getChildrenAgeTier(parseChildrenTargetAge(lengthOpts.childrenTargetAge)).closingMark}\n${parentReadingTip}`.trim()
                  : summary,
              status: "ready",
              visibility: defaultWorkVisibility(),
            },
          });
          await persistNovelLengthTier(novel.id, lengthTier);
          if (lengthOpts?.childrenTargetAge !== undefined) {
            await persistChildrenNovelMeta(novel.id, {
              kind: "children",
              targetAge: parseChildrenTargetAge(lengthOpts.childrenTargetAge),
              maxChars: maxCharsLimit,
              ...(childrenInterpretation ? { sourceInterpretation: childrenInterpretation } : {}),
              ...(parentReadingTip ? { parentReadingTip } : {}),
              storyTitle: finalTitle,
            });
          } else if (pipelineMeta) {
            await persistNovelGenerationMeta(novel.id, pipelineMeta);
          }
          if (briefJsonToPersist) {
            await saveNovelCreativeBriefJson(novel.id, briefJsonToPersist);
          }

          emitGenerateServeLog({
            phase: "novel_generate_stream",
            requestId,
            durationMs: Date.now() - startedAt,
            byteLength: json.byteLength,
            promptChars: promptTrim.length,
            source: "llm",
            llmProvider: String(providerLabel),
          });

          send({
            step: "done",
            novel,
            coverPath: null,
            model,
            provider: providerLabel,
            message: progressNovelMessage(uiLocale, "coverPending"),
            requestId,
          });
          saved = true;

          const coverGenre = resolveNovelCoverGenre({
            genreTagCoverGenre: genreTag?.coverGenre,
            title: finalTitle,
            summary,
            prompt: promptTrim,
            contentSnippet: finalContent.slice(0, 1200),
          });
          void ensureNovelCoverAfterCreate(
            novel.id,
            finalTitle,
            summary,
            [promptTrim, finalContent.slice(0, 600)].filter(Boolean).join(" "),
            600_000,
            coverGenre,
            uiLocale,
          ).catch(() => {});

          break;
        }

        if (!saved) {
          send({
            step: "error",
            message: progressNovelMessage(uiLocale, "generateFailed"),
            code: codes.LLM_FAILED,
            requestId,
            ok: false,
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : progressNovelMessage(uiLocale, "processError");
        send({ step: "error", message, ok: false, requestId });
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* stream already closed by client */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...ridHeaders(requestId),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
