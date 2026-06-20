import { generationErrorCodes } from "@/lib/api/json-error-response";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { emitGenerateServeLog } from "@/lib/api/generate-serve-log";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { getActiveProvider, getNovelStyleTextModelCascade } from "@/lib/llm";
import { apiErrorMessage, progressNovelMessage } from "@/lib/i18n/progress-message";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { generateNovelSynopsis } from "@/lib/novel-synopsis";
import { novelMaxChars, parseNovelLengthTier } from "@/lib/novel-length";
import { planLongNovelSegments } from "@/lib/novel-long-config";
import { parseNovelContinueOptions } from "@/lib/novel-continue-options";
import { assessNovelContinuation, streamLongNovelContinue } from "@/lib/novel-long-continue";
import { loadNovelGenerationMeta, persistNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import { saveNovelCheckpointAndContent } from "@/lib/novel-generate-checkpoint";
import { assessNovelCompleteness } from "@/lib/novel-completeness";
import { repairPlannedNovelCompleteness } from "@/lib/novel-completeness-repair";
import { getOwnerKey } from "@/lib/owner";
import { gateGenerationQuota } from "@/lib/commerce/generation-gate";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { prisma } from "@/lib/prisma";

export const maxDuration = 3600;

type RouteContext = { params: Promise<{ id: string }> };

/** SSE：在已有长篇基础上续写剩余/新增章节，完成后 PATCH 正文入库。Body: { maxChapters?: number | "all", polish?: boolean } */
export async function POST(req: Request, ctx: RouteContext) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const uiLocale = resolveRequestLocaleSync(req);
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return new Response(JSON.stringify({ error: apiErrorMessage(uiLocale, "unauthorized"), code: codes.UNAUTHORIZED, requestId }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  const quotaBlock = await gateGenerationQuota("novelContinue", { refId: id, uiLocale });
  if (quotaBlock) return quotaBlock;

  const rl = generateRateLimits();
  const throttleKey = await getThrottleKey("novel_continue_stream", ownerKey);
  if (!rateLimit(throttleKey, rl.streamMax, rl.windowMs)) {
    return new Response(JSON.stringify({ error: apiErrorMessage(uiLocale, "continueRateLimited"), code: codes.RATE_LIMITED, requestId }), {
      status: 429,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  const row = await prisma.novel.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return new Response(JSON.stringify({ error: apiErrorMessage(uiLocale, "notFound"), code: codes.BAD_REQUEST, requestId }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  const lengthTier = parseNovelLengthTier(row.lengthTier);
  const meta = await loadNovelGenerationMeta(id);
  const assessment = assessNovelContinuation({
    lengthTier: row.lengthTier,
    content: row.content,
    meta,
    uiLocale,
  });

  if (!assessment.canContinue) {
    return new Response(
      JSON.stringify({ error: assessment.reason, code: codes.BAD_REQUEST, requestId }),
      { status: 400, headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) } },
    );
  }

  const json = await readLimitedJson(req, requestId);
  const continueOpts = json.ok ? parseNovelContinueOptions(json.body) : parseNovelContinueOptions(null);
  const maxChaptersToWrite =
    continueOpts.maxChapters === null ? null : continueOpts.maxChapters;

  const cascade = getNovelStyleTextModelCascade();
  const providerLabel = getActiveProvider();
  const encoder = new TextEncoder();

  // M1 修复：AbortController——客户端断连时 abort，取消进行中的 LLM fetch
  const abortController = new AbortController();
  const abortSignal = abortController.signal;

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
      try {
        const chapterHint =
          maxChaptersToWrite == null
            ? progressNovelMessage(uiLocale, "continueChapterHintAll")
            : progressNovelMessage(uiLocale, "continueChapterHintMax", { count: maxChaptersToWrite });
        send({
          step: "start",
          message: progressNovelMessage(uiLocale, "continueStart", {
            reason: assessment.reason,
            hint: chapterHint,
            polish: continueOpts.polish ? progressNovelMessage(uiLocale, "continuePolishSuffix") : "",
          }),
          requestId,
          remainingChapterCount: assessment.remainingChapterCount,
          maxChapters: maxChaptersToWrite,
          polish: continueOpts.polish,
        });

        let saved = false;
        for (const model of cascade) {
          send({ step: "model_start", model });
          let pipelineMeta: Awaited<ReturnType<typeof streamLongNovelContinue>>["pipelineMeta"] | null =
            null;
          let newContent = row.content;
          // P2 修复：ping 在 closed 后立即停
          const ping = setInterval(() => { if (!closed) send({ step: "ping" }); }, 15_000);
          // P0 修复：续写路径加 onSegmentCheckpoint，每段 atomic 写 DB 防数据丢失
          const checkpointAt = Date.now();
          const longPlan = planLongNovelSegments(lengthTier);
          try {
            const result = await streamLongNovelContinue({
              model,
              promptTrim: row.prompt,
              titleTrim: row.title,
              existingContent: row.content,
              meta,
              lengthTier,
              maxChaptersToWrite,
              polish: continueOpts.polish,
              uiLocale,
              emit: send,
              signal: abortSignal,
              onSegmentCheckpoint: async ({ index, content: partial, meta: partialMeta }) => {
                try {
                  await saveNovelCheckpointAndContent(id, partial, partialMeta, {
                    completedSegmentIndex: index,
                    partialContent: partial,
                    prompt: row.prompt,
                    title: row.title,
                    lengthTier,
                    polish: Boolean(continueOpts.polish),
                    plan: longPlan,
                    updatedAt: new Date().toISOString(),
                  });
                  send({ step: "checkpoint_saved", at: Date.now() - checkpointAt });
                } catch (e) {
                  send({
                    step: "checkpoint_error",
                    message: e instanceof Error ? e.message : String(e),
                  });
                }
              },
            });
            newContent = result.content;
            pipelineMeta = result.pipelineMeta;
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            send({ step: "model_error", model, message });
            continue;
          } finally {
            clearInterval(ping);
          }

          if (newContent.length <= row.content.length) {
            send({
              step: "model_short",
              model,
              message: progressNovelMessage(uiLocale, "continueNoDelta"),
              length: newContent.length,
              priorLength: row.content.length,
            });
            continue;
          }

          // P1 修复：续写后加完整性校验，不完整则尝试 repair
          try {
            const completeness = assessNovelCompleteness(
              newContent,
              lengthTier,
              undefined,
              row.prompt,
              meta?.chapterPlan,
              uiLocale,
            );
            if (!completeness.ok && meta?.chapterPlan) {
              send({ step: "completeness_repair", message: "正文不完整，自动补章" });
              const repaired = await repairPlannedNovelCompleteness({
                model,
                promptTrim: row.prompt,
                titleTrim: row.title,
                content: newContent,
                lengthTier,
                pipelineMeta: meta,
                uiLocale,
                emit: send,
              });
              newContent = repaired.content;
            }
          } catch (e) {
            send({
              step: "completeness_error",
              message: e instanceof Error ? e.message : String(e),
            });
          }

          send({ step: "synopsis_start", message: progressNovelMessage(uiLocale, "continueSynopsis") });
          const summary = await generateNovelSynopsis({
            model,
            title: row.title,
            prompt: row.prompt,
            content: newContent,
            lengthTier,
            uiLocale,
          });

          // P1 修复：乐观锁防并发覆盖；冲突时回退到无条件更新（保留已生成内容不丢失）
          const priorUpdatedAt = new Date(row.updatedAt).getTime();
          let novel;
          try {
            novel = await prisma.novel.update({
              where: { id, updatedAt: new Date(priorUpdatedAt) },
              data: { content: newContent, summary },
            });
          } catch (updateErr) {
            // 乐观锁冲突（P2025）或精度不匹配 → 回退无条件更新，保留 LLM 已生成内容
            send({ step: "optimistic_lock_fallback", message: "检测到并发更新，回退到无条件写入" });
            novel = await prisma.novel.update({
              where: { id },
              data: { content: newContent, summary },
            });
          }
          if (pipelineMeta) {
            await persistNovelGenerationMeta(id, pipelineMeta);
          }

          emitGenerateServeLog({
            phase: "novel_continue_stream",
            requestId,
            durationMs: Date.now() - startedAt,
            byteLength: 0,
            promptChars: row.prompt.length,
            source: "llm",
            llmProvider: String(providerLabel),
          });

          send({
            step: "done",
            novel,
            model,
            provider: providerLabel,
            message: progressNovelMessage(uiLocale, "continueDone"),
            requestId,
            addedChars: newContent.length - row.content.length,
            maxChars: novelMaxChars(lengthTier),
          });
          saved = true;
          break;
        }

        if (!saved) {
          send({
            step: "error",
            message: progressNovelMessage(uiLocale, "continueFailed"),
            code: codes.LLM_FAILED,
            requestId,
            ok: false,
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : progressNovelMessage(uiLocale, "continueProcessError");
        send({ step: "error", message, ok: false, requestId });
      } finally {
        // P0 修复：controller.close() 加 try-catch，防客户端断连后未捕获异常
        try {
          controller.close();
        } catch {
          // stream already closed by client disconnect
        }
        // M1 修复：finally 中 abort 进行中的 LLM 调用
        if (!abortSignal.aborted) {
          abortController.abort();
        }
      }
    },
    cancel() {
      // M1 修复：ReadableStream cancel（客户端断连）时 abort LLM
      if (!abortSignal.aborted) {
        abortController.abort();
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
