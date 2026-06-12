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
import { parseNovelContinueOptions } from "@/lib/novel-continue-options";
import { assessNovelContinuation, streamLongNovelContinue } from "@/lib/novel-long-continue";
import { loadNovelGenerationMeta, persistNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
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

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
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
          const ping = setInterval(() => send({ step: "ping" }), 15_000);
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

          send({ step: "synopsis_start", message: progressNovelMessage(uiLocale, "continueSynopsis") });
          const summary = await generateNovelSynopsis({
            model,
            title: row.title,
            prompt: row.prompt,
            content: newContent,
            lengthTier,
            uiLocale,
          });

          const novel = await prisma.novel.update({
            where: { id },
            data: { content: newContent, summary },
          });
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
        controller.close();
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
