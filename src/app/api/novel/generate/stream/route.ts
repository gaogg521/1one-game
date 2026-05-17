import { generationErrorCodes } from "@/lib/api/json-error-response";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { emitGenerateServeLog } from "@/lib/api/generate-serve-log";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { getActiveProvider, getNovelStyleTextModelCascade, llmNovelTextStream } from "@/lib/llm";
import { ensureNovelCoverAfterCreate } from "@/lib/cover-generation";
import {
  getNovelSystemPrompt,
  buildNovelUserMessage,
  novelLlmMaxOutputTokens,
  novelLlmTimeoutMs,
  novelMinAcceptChars,
  parseNovelLengthTier,
} from "@/lib/novel-generate-config";
import { extractNovelTitleFromContent, validateNovelTitleInput } from "@/lib/novel-display";
import { novelGenerationEtaHint } from "@/lib/novel-length";
import {
  planLongNovelSegments,
  streamLongNovelBody,
  usesSegmentedLongGeneration,
} from "@/lib/novel-long-generate";
import { persistNovelLengthTier } from "@/lib/novel-length-tier-db";
import { getOwnerKey } from "@/lib/owner";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { prisma } from "@/lib/prisma";

/** 长篇流式可跑 20–45+ 分钟；自托管 next start 生效，Serverless 受平台上限约束 */
export const maxDuration = 3600;

/** SSE：增量推送正文 token，完成后写入 DB 并发送 `done`（含完整 novel）。 */
export async function POST(req: Request) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const rl = generateRateLimits();
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("novel_gen_stream", ownerKey);
  if (!rateLimit(throttleKey, rl.streamMax, rl.windowMs)) {
    return new Response(JSON.stringify({ error: "生成次数过多，请稍后再试", code: codes.RATE_LIMITED, requestId }), {
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

  const { prompt, title, lengthTier: lengthTierRaw } = json.body as {
    prompt?: string;
    title?: string;
    lengthTier?: string;
  };
  const lengthTier = parseNovelLengthTier(lengthTierRaw);
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
    return new Response(JSON.stringify({ error: "请提供小说创意描述（至少 2 个字符）", code: codes.BAD_REQUEST, requestId }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  if (title?.trim()) {
    const tv = validateNovelTitleInput(title.trim());
    if (!tv.ok) {
      return new Response(JSON.stringify({ error: tv.error, code: codes.BAD_REQUEST, requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
      });
    }
  }

  const promptTrim = prompt.trim();
  const titleTrim = title?.trim();
  const minChars = novelMinAcceptChars(lengthTier);
  const timeoutMs = novelLlmTimeoutMs(lengthTier);
  const maxTokens = novelLlmMaxOutputTokens(lengthTier);
  const userMsg = buildNovelUserMessage(promptTrim, titleTrim, lengthTier);
  const longPlan = usesSegmentedLongGeneration(lengthTier) ? planLongNovelSegments(lengthTier) : null;
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
        send({
          step: "start",
          message: longPlan
            ? `长篇将先定大纲再分 ${longPlan.totalSegments} 段续写（${novelGenerationEtaHint(lengthTier)}）…`
            : `已开始生成，正文将逐段推送（${novelGenerationEtaHint(lengthTier)}）…`,
          requestId,
        });

        let saved = false;
        for (const model of cascade) {
          send({ step: "model_start", model });
          let content = "";
          const ping = setInterval(() => send({ step: "ping" }), 15_000);
          try {
            if (longPlan) {
              content = await streamLongNovelBody({
                model,
                promptTrim,
                titleTrim,
                plan: longPlan,
                lengthTier,
                emit: send,
              });
            } else {
              for await (const delta of llmNovelTextStream(
                {
                  model,
                  system: getNovelSystemPrompt(lengthTier),
                  user: userMsg,
                  temperature: 0.85,
                  maxTokens,
                  timeoutMs,
                },
                lengthTier,
              )) {
                content += delta;
                send({ step: "delta", text: delta });
              }
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            send({ step: "model_error", model, message });
            continue;
          } finally {
            clearInterval(ping);
          }

          const acceptChars = longPlan?.minAcceptChars ?? minChars;
          if (content.length < acceptChars) {
            send({ step: "model_short", model, length: content.length, minChars: acceptChars });
            continue;
          }

          const extractedTitle = extractNovelTitleFromContent(content, titleTrim, promptTrim);
          const summary = content.slice(0, 300).replace(/\n/g, " ").slice(0, 200) + "…";

          const novel = await prisma.novel.create({
            data: {
              ownerKey,
              title: extractedTitle,
              prompt: promptTrim,
              content,
              summary,
              status: "ready",
            },
          });
          await persistNovelLengthTier(novel.id, lengthTier);

          emitGenerateServeLog({
            phase: "novel_generate_stream",
            requestId,
            durationMs: Date.now() - startedAt,
            byteLength: json.byteLength,
            promptChars: prompt.length,
            source: "llm",
            llmProvider: String(providerLabel),
          });

          send({
            step: "done",
            novel,
            coverPath: null,
            model,
            provider: providerLabel,
            message: "正文已完成，封面将在阅读页后台生成",
            requestId,
          });
          saved = true;

          void ensureNovelCoverAfterCreate(
            novel.id,
            extractedTitle,
            summary,
            promptTrim,
            600_000,
          ).catch(() => {});

          break;
        }

        if (!saved) {
          send({
            step: "error",
            message: "小说生成失败：模型未返回足够内容或全部出错，可尝试改选中篇/短篇或稍后重试",
            code: codes.LLM_FAILED,
            requestId,
            ok: false,
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "生成过程异常";
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
