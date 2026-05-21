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
  novelLlmTimeoutMs,
  novelMinAcceptChars,
  parseNovelLengthTier,
} from "@/lib/novel-generate-config";
import { extractNovelTitleFromContent, validateNovelTitleInput } from "@/lib/novel-display";
import { generateNovelSynopsis } from "@/lib/novel-synopsis";
import { parseChildrenTargetAge } from "@/lib/children-age-length";
import { finalizeChildrenNovelContent } from "@/lib/children-novel-postprocess";
import { persistChildrenNovelMeta } from "@/lib/children-novel-meta-db";
import {
  isChildrenNovelTier,
  novelGenerationEtaHint,
  novelLengthConfig,
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
import { persistNovelLengthTier } from "@/lib/novel-length-tier-db";
import { persistNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import { getOwnerKey } from "@/lib/owner";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { prisma } from "@/lib/prisma";
import { resolveMediaCreativeBrief } from "@/lib/creative-brief/resolve-media-brief";
import { parseNovelCreativeBrief, type NovelBriefUserRevision } from "@/lib/literary-brief";
import {
  saveNovelCreativeBriefJson,
  serializeNovelCreativeBrief,
} from "@/lib/novel-creative-brief-db";
import {
  buildNovelBriefSeed,
  buildNovelStoredPrompt,
  getNovelGenreTag,
} from "@/lib/novel-genre-tags";
import { PRODUCT } from "@/lib/product-config";

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

  const {
    prompt,
    title,
    lengthTier: lengthTierRaw,
    polish: polishRaw,
    creativeBrief: creativeBriefRaw,
    briefRevision: briefRevisionRaw,
    novelGenreTag,
    childrenTargetAge: childrenTargetAgeRaw,
  } = json.body as {
    prompt?: string;
    title?: string;
    lengthTier?: string;
    polish?: boolean;
    creativeBrief?: unknown;
      briefRevision?: NovelBriefUserRevision;
      novelGenreTag?: string;
      childrenTargetAge?: number;
  };
  const genreTag = getNovelGenreTag(novelGenreTag);
  const lengthTier = resolveNovelLengthTier({
    genreTagId: novelGenreTag,
    lengthTierPick: lengthTierRaw,
  });
  const lengthOpts: NovelLengthOptions | undefined = isChildrenNovelTier(lengthTier)
    ? { childrenTargetAge: parseChildrenTargetAge(childrenTargetAgeRaw) }
    : undefined;
  const titleTrimEarly = title?.trim();
  let promptTrim = typeof prompt === "string" ? prompt.trim() : "";
  if (promptTrim.length < 2 && titleTrimEarly && genreTag) {
    promptTrim = buildNovelStoredPrompt(titleTrimEarly, genreTag);
  }
  if (promptTrim.length < 2) {
    return new Response(JSON.stringify({ error: "请提供书名并选择类型", code: codes.BAD_REQUEST, requestId }), {
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

  const titleTrim = titleTrimEarly;
  let pipelinePrompt = promptTrim;
  const minChars = novelMinAcceptChars(lengthTier, lengthOpts);
  const timeoutMs = novelLlmTimeoutMs(lengthTier);
  const maxTokens = novelLlmMaxOutputTokens(lengthTier, lengthOpts);
  const longPlan = usesSegmentedLongGeneration(lengthTier) ? planLongNovelSegments(lengthTier) : null;
  const longPolish =
    longPlan &&
    polishRaw !== false &&
    (polishRaw === true || PRODUCT.novel.longSegmented.polishAfterSegment);
  const maxCharsLimit = novelMaxChars(lengthTier, lengthOpts);
  const tierLabel = novelLengthConfig(lengthTier, lengthOpts).label;
  const cascade = getNovelStyleTextModelCascade();
  const providerLabel = getActiveProvider();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      const startedAt = Date.now();
      let briefToPersist: import("@/lib/literary-brief").NovelCreativeBrief | null = null;
      try {
        if (PRODUCT.novel.creativeBriefExpand) {
          const preParsed = parseNovelCreativeBrief(creativeBriefRaw);
          const briefSeed =
            titleTrim && genreTag
              ? buildNovelBriefSeed(
                  titleTrim,
                  genreTag,
                  undefined,
                  lengthOpts?.childrenTargetAge ?? undefined,
                )
              : promptTrim;
          const briefResult = await resolveMediaCreativeBrief(briefSeed, "novel", {
            preExpanded: preParsed ?? undefined,
            userRevision: briefRevisionRaw ?? undefined,
            novelGenreId: genreTag?.id,
            title: titleTrim,
            childrenTargetAge: lengthOpts?.childrenTargetAge ?? undefined,
          });
          if (briefResult) {
            briefToPersist = briefResult.brief;
            pipelinePrompt = briefResult.augmentedPrompt;
            send({
              step: "brief",
              summary: briefResult.oneLineSummary,
              brief: briefResult.brief,
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
            ? `长篇流水线：设定圣经 → 章规划 → 分批写作${longPolish ? " → 分批润色" : ""}（${novelGenerationEtaHint(lengthTier)}）…`
            : `已开始生成，正文将逐段推送（${novelGenerationEtaHint(lengthTier)}）…`,
          requestId,
        });

        let saved = false;
        for (const model of cascade) {
          send({ step: "model_start", model });
          let content = "";
          let pipelineMeta: Awaited<ReturnType<typeof streamLongNovelBody>>["pipelineMeta"] | null =
            null;
          const ping = setInterval(() => send({ step: "ping" }), 15_000);
          try {
            if (longPlan) {
              const longResult = await streamLongNovelBody({
                model,
                promptTrim: pipelinePrompt,
                titleTrim,
                plan: longPlan,
                lengthTier,
                polish: Boolean(longPolish),
                emit: send,
              });
              content = longResult.content;
              pipelineMeta = longResult.pipelineMeta;
            } else {
              const { content: accumulated, capped } = await accumulateNovelTextStream({
                maxChars: maxCharsLimit,
                stream: llmNovelTextStream(
                  {
                    model,
                    system: getNovelSystemPrompt(lengthTier, lengthOpts),
                    user: userMsg,
                    temperature: 0.85,
                    maxTokens,
                    timeoutMs,
                  },
                  lengthTier,
                ),
                onDelta: (text) => send({ step: "delta", text }),
              });
              content = accumulated;
              if (capped) {
                send({
                  step: "length_capped",
                  message: `已达${tierLabel}字数上限（约 ${maxCharsLimit.toLocaleString()} 字），已自动收束`,
                  maxChars: maxCharsLimit,
                  length: content.length,
                });
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

          let finalTitle = extractNovelTitleFromContent(content, titleTrim, promptTrim);
          let finalContent = content;
          let parentReadingTip: string | undefined;

          if (isChildrenNovelTier(lengthTier) && lengthOpts?.childrenTargetAge !== undefined) {
            const finalized = finalizeChildrenNovelContent(content, {
              targetAge: parseChildrenTargetAge(lengthOpts.childrenTargetAge),
              fallbackTitle: titleTrim,
            });
            finalTitle = finalized.dbTitle;
            finalContent = finalized.body;
            parentReadingTip = finalized.parentReadingTip || undefined;
          }

          send({ step: "synopsis_start", message: "正在撰写剧情简介…" });
          const summary = await generateNovelSynopsis({
            model,
            title: finalTitle,
            prompt: promptTrim,
            content: finalContent,
            lengthTier,
          });

          const novel = await prisma.novel.create({
            data: {
              ownerKey,
              title: finalTitle,
              prompt: promptTrim,
              content: finalContent,
              summary: parentReadingTip
                ? `${summary ?? ""}\n\n【家长共读】${parentReadingTip}`.trim()
                : summary,
              status: "ready",
            },
          });
          await persistNovelLengthTier(novel.id, lengthTier);
          if (lengthOpts?.childrenTargetAge !== undefined) {
            await persistChildrenNovelMeta(novel.id, {
              kind: "children",
              targetAge: parseChildrenTargetAge(lengthOpts.childrenTargetAge),
              maxChars: maxCharsLimit,
              ...(parentReadingTip ? { parentReadingTip } : {}),
              storyTitle: finalTitle,
            });
          } else if (pipelineMeta) {
            await persistNovelGenerationMeta(novel.id, pipelineMeta);
          }
          if (briefToPersist) {
            await saveNovelCreativeBriefJson(novel.id, serializeNovelCreativeBrief(briefToPersist));
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
            message: "正文已完成，封面将在阅读页后台生成",
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
