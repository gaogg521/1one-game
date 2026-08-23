import { generationErrorCodes } from "@/lib/api/json-error-response";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { apiErrorMessage, progressNovelMessage } from "@/lib/i18n/progress-message";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { parseNovelContinueOptions } from "@/lib/novel-continue-options";
import { assessNovelContinuation } from "@/lib/novel-long-continue";
import { loadNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import { executeNovelContinuation } from "@/lib/novel-continuation-executor";
import { mirrorNovelToCreatorCore } from "@/lib/creator-core/novel-bridge";
import { enqueueGenerationJob } from "@/lib/creator-core/jobs";
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

  if (continueOpts.durable) {
    try {
      const core = await mirrorNovelToCreatorCore({ novel: row, meta, cause: "refine" });
      const job = await enqueueGenerationJob({
        creativeProjectId: core.creativeProjectId,
        creativeRevisionId: core.creativeRevisionId,
        type: "novel_continue",
        payload: {
          novelId: row.id,
          ownerKey,
          maxChapters: maxChaptersToWrite,
          polish: continueOpts.polish,
          uiLocale,
        },
        idempotencyKey: `novel-continue:${row.id}:${row.updatedAt.getTime()}:${maxChaptersToWrite ?? "all"}:${continueOpts.polish}`,
        maxAttempts: 3,
      });
      return new Response(JSON.stringify({ ok: true, queued: true, job: { id: job.id, status: job.status }, core, requestId }), {
        status: 202,
        headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
      });
    } catch (error) {
      console.error("[novel-continue-job-enqueue]", { novelId: id, error });
      return new Response(JSON.stringify({ error: progressNovelMessage(uiLocale, "continueProcessError"), code: codes.BAD_REQUEST, requestId }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
      });
    }
  }

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

        const ping = setInterval(() => { if (!closed) send({ step: "ping" }); }, 15_000);
        let result: Awaited<ReturnType<typeof executeNovelContinuation>>;
        try {
          result = await executeNovelContinuation({
            novel: row,
            meta,
            maxChaptersToWrite,
            polish: continueOpts.polish,
            uiLocale,
            requestId,
            phase: "novel_continue_stream",
            emit: send,
            signal: abortSignal,
          });
        } finally {
          clearInterval(ping);
        }
        if (result.status === "conflict") {
          send({ step: "conflict", code: codes.BAD_REQUEST, message: progressNovelMessage(uiLocale, "continueConflict"), requestId });
          return;
        }
        if (result.status !== "completed") {
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
