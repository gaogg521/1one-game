import { generationErrorCodes } from "@/lib/api/json-error-response";
import { z } from "zod";
import { localizedApiErrorPayload } from "@/lib/api/localized-error";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { runComicGeneration, resolveComicPipelineMode, resolveComicRunErrorMessage } from "@/lib/comic-generate-run";
import { validateComicPipelineRequest } from "@/lib/comic-pipeline-mode";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { parseNovelCreativeBrief, type NovelBriefUserRevision } from "@/lib/literary-brief";
import { getOwnerKey } from "@/lib/owner";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { gateGenerationQuota } from "@/lib/commerce/generation-gate";
import { apiErrorMessage, progressComicMessage } from "@/lib/i18n/progress-message";

export const maxDuration = 3600;

/** SSE：漫画改编进度（导演包 / 分镜批 / 镜头 / 配图 / 入库）。 */
export async function POST(req: Request) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const uiLocale = resolveRequestLocaleSync(req);
  const rl = generateRateLimits();
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("comic_gen_stream", ownerKey);
  if (!rateLimit(throttleKey, rl.streamMax, rl.windowMs)) {
    return new Response(JSON.stringify({ error: apiErrorMessage(uiLocale, "rateLimited"), code: codes.RATE_LIMITED, requestId }), {
      status: 429,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  const quotaBlock = await gateGenerationQuota("comic", { uiLocale });
  if (quotaBlock) return quotaBlock;

  const json = await readLimitedJson(req, requestId);
  if (!json.ok) {
    return new Response(JSON.stringify(json.payload), {
      status: json.status,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  // P2 修复：Zod schema 替代裸 as 断言
  const ComicRequestBodySchema = z.object({
    novelId: z.string().optional(),
    sourceMode: z.enum(["standalone", "from_novel"]).optional(),
    content: z.string().max(200_000).optional(),
    creativePrompt: z.string().max(10_000).optional(),
    creativeBrief: z.unknown().optional(),
    briefRevision: z.unknown().optional(),
    title: z.string().max(200).optional(),
    pageCount: z.number().int().min(1).max(120).optional(),
    layoutId: z.string().optional(),
    lengthTier: z.string().optional(),
    stylePreset: z.string().optional(),
    readMode: z.string().optional(),
    chapterScope: z.object({
      fromChapter: z.number().int(),
      toChapter: z.number().int(),
      label: z.string().optional(),
    }).optional(),
    characterRoster: z.unknown().optional(),
    resumeComicId: z.string().optional(),
    forceLightStoryboard: z.boolean().optional(),
  });
  const bodyParsed = ComicRequestBodySchema.safeParse(json.body);
  if (!bodyParsed.success) {
    return new Response(
      JSON.stringify({ ok: false, error: "invalid_body", details: bodyParsed.error.issues.slice(0, 3) }),
      { status: 400, headers: { "Content-Type": "application/json", ...ridHeaders(requestId) } },
    );
  }
  const body = bodyParsed.data;

  const pipelineError = validateComicPipelineRequest({
    sourceMode: body.sourceMode,
    novelId: body.novelId,
    content: body.content,
    creativePrompt: body.creativePrompt,
  });
  if (pipelineError) {
    return new Response(
      JSON.stringify(
        localizedApiErrorPayload(req, pipelineError, { code: codes.LLM_FAILED, requestId }),
      ),
      {
        status: pipelineError === "novelNotFound" ? 404 : 400,
        headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
      },
    );
  }

  const encoder = new TextEncoder();
  // P1 修复：AbortController——客户端断连时取消进行中的生成
  const abortController = new AbortController();
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

      // P2 修复：ping 在 closed 后立即停
      const ping = setInterval(() => { if (!closed) send({ step: "ping" }); }, 15_000);

      try {
        const result = await runComicGeneration(
          {
            ownerKey,
            novelId: body.novelId,
            sourceMode: resolveComicPipelineMode({ sourceMode: body.sourceMode, novelId: body.novelId }),
            content: body.content,
            creativePrompt: body.creativePrompt,
            creativeBrief: body.creativeBrief
              ? (parseNovelCreativeBrief(body.creativeBrief) ?? undefined)
              : undefined,
            briefRevision: body.briefRevision as NovelBriefUserRevision | undefined,
            title: body.title,
            pageCount: body.pageCount,
            layoutId: body.layoutId,
            lengthTier: body.lengthTier,
            stylePreset: body.stylePreset,
            readMode: body.readMode === "full" ? "full" : "segment",
            chapterScope: body.chapterScope
              ? {
                  fromChapter: body.chapterScope.fromChapter,
                  toChapter: body.chapterScope.toChapter,
                  label: body.chapterScope.label ?? "",
                }
              : null,
            characterRoster: body.characterRoster as import("@/lib/comic-character-roster").ComicCharacterRoster | null,
            resumeComicId: body.resumeComicId?.trim() || undefined,
            forceLightStoryboard: body.forceLightStoryboard === true,
            uiLocale,
          },
          send,
        );

        send({
          step: "done",
          message: progressComicMessage(uiLocale, "comicDone"),
          requestId,
          comic: { id: result.comicId },
          pageCount: result.pageCount,
          panelCount: result.panelCount,
          panelsRendered: result.panelsRendered,
          pipeline: result.pipeline,
          storyboardSource: result.storyboardSource,
          needsPanelRender: result.needsPanelRender,
          imagesWarning: result.imagesWarning,
          consistencyWarnings: result.consistencyWarnings,
          provider: result.provider,
          model: result.model,
        });
      } catch (err) {
        const message = resolveComicRunErrorMessage(uiLocale, err);
        send({ step: "error", message, ok: false, requestId });
      } finally {
        clearInterval(ping);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // stream already closed
          }
        }
        if (!abortController.signal.aborted) {
          abortController.abort();
        }
      }
    },
    cancel() {
      if (!abortController.signal.aborted) {
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
