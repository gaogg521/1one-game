import { generationErrorCodes } from "@/lib/api/json-error-response";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { emitGenerateServeLog } from "@/lib/api/generate-serve-log";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { getActiveProvider, getNovelStyleTextModelCascade } from "@/lib/llm";
import { generateNovelSynopsis } from "@/lib/novel-synopsis";
import { novelMaxChars, parseNovelLengthTier } from "@/lib/novel-length";
import { parseNovelContinueOptions } from "@/lib/novel-continue-options";
import { assessNovelContinuation, streamLongNovelContinue } from "@/lib/novel-long-continue";
import { loadNovelGenerationMeta, persistNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import { getOwnerKey } from "@/lib/owner";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { prisma } from "@/lib/prisma";

export const maxDuration = 3600;

type RouteContext = { params: Promise<{ id: string }> };

/** SSE：在已有长篇基础上续写剩余/新增章节，完成后 PATCH 正文入库。Body: { maxChapters?: number | "all", polish?: boolean } */
export async function POST(req: Request, ctx: RouteContext) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const { id } = await ctx.params;
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return new Response(JSON.stringify({ error: "未授权", code: codes.UNAUTHORIZED, requestId }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  const rl = generateRateLimits();
  const throttleKey = await getThrottleKey("novel_continue_stream", ownerKey);
  if (!rateLimit(throttleKey, rl.streamMax, rl.windowMs)) {
    return new Response(JSON.stringify({ error: "续写次数过多，请稍后再试", code: codes.RATE_LIMITED, requestId }), {
      status: 429,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  const row = await prisma.novel.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return new Response(JSON.stringify({ error: "未找到", code: codes.BAD_REQUEST, requestId }), {
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
            ? "全部待写章"
            : `本次最多 ${maxChaptersToWrite} 章`;
        send({
          step: "start",
          message: `${assessment.reason}，${chapterHint}${continueOpts.polish ? "，含润色" : ""}（请勿关闭页面）…`,
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
              message: "续写未增加正文长度",
              length: newContent.length,
              priorLength: row.content.length,
            });
            continue;
          }

          send({ step: "synopsis_start", message: "正在更新剧情简介…" });
          const summary = await generateNovelSynopsis({
            model,
            title: row.title,
            prompt: row.prompt,
            content: newContent,
            lengthTier,
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
            message: "续写完成",
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
            message: "续写失败：模型未返回有效增量，请稍后重试",
            code: codes.LLM_FAILED,
            requestId,
            ok: false,
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "续写过程异常";
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
