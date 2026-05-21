import { generationErrorCodes } from "@/lib/api/json-error-response";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { runComicGeneration } from "@/lib/comic-generate-run";
import { parseNovelCreativeBrief, type NovelBriefUserRevision } from "@/lib/literary-brief";
import { getOwnerKey } from "@/lib/owner";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";

export const maxDuration = 3600;

/** SSE：漫画改编进度（导演包 / 分镜批 / 镜头 / 配图 / 入库）。 */
export async function POST(req: Request) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const rl = generateRateLimits();
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("comic_gen_stream", ownerKey);
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

  const body = json.body as {
    novelId?: string;
    content?: string;
    creativePrompt?: string;
    creativeBrief?: unknown;
    briefRevision?: NovelBriefUserRevision;
    title?: string;
    pageCount?: number;
    lengthTier?: string;
    stylePreset?: string;
    readMode?: string;
    chapterScope?: { fromChapter: number; toChapter: number; label?: string };
    characterRoster?: unknown;
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      const ping = setInterval(() => send({ step: "ping" }), 15_000);

      try {
        const result = await runComicGeneration(
          {
            ownerKey,
            novelId: body.novelId,
            content: body.content,
            creativePrompt: body.creativePrompt,
            creativeBrief: body.creativeBrief
              ? (parseNovelCreativeBrief(body.creativeBrief) ?? undefined)
              : undefined,
            briefRevision: body.briefRevision,
            title: body.title,
            pageCount: body.pageCount,
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
          },
          send,
        );

        send({
          step: "done",
          message: "漫画生成完成",
          requestId,
          comic: { id: result.comicId },
          pageCount: result.pageCount,
          panelCount: result.panelCount,
          panelsRendered: result.panelsRendered,
          pipeline: result.pipeline,
          needsPanelRender: result.needsPanelRender,
          imagesWarning: result.imagesWarning,
          consistencyWarnings: result.consistencyWarnings,
          provider: result.provider,
          model: result.model,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "漫画生成失败";
        send({ step: "error", message, ok: false, requestId });
      } finally {
        clearInterval(ping);
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
