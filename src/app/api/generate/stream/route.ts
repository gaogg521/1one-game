import { generationErrorCodes } from "@/lib/api/json-error-response";
import { logGenerationError } from "@/lib/generation-error-log";
import { localizedApiErrorPayload } from "@/lib/api/localized-error";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { emitGenerateServeLog } from "@/lib/api/generate-serve-log";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { expandCreativeBrief } from "@/lib/creative-brief";
import { buildStudioBriefBullets } from "@/lib/creative-brief/format-prompt";
import { buildGenerateRecapLines, buildServerPrepLines, streamMessage } from "@/lib/create-studio-narrative";
import { buildOpenGameRecapFromTrace, buildGameModelRecapFromTrace } from "@/lib/opengame-skills/generation-trace";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { generateGameSpecWithMeta } from "@/lib/generate-spec";
import { createRunTraceRecorder } from "@/lib/orchestration/run-trace";
import { PRODUCT } from "@/lib/product-config";
import { getOwnerKey } from "@/lib/owner";
import { parseGeneratePayload } from "@/lib/parse-generate-request";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { gateGenerationQuota } from "@/lib/commerce/generation-gate";

/** SSE：推送生成阶段，最后一帧携带完整 spec（便于创作台展示进度）。 */
export async function POST(req: Request) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const uiLocale = resolveRequestLocaleSync(req);
  const rl = generateRateLimits();
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("gen_stream", ownerKey);
  if (!rateLimit(throttleKey, rl.streamMax, rl.windowMs)) {
    return new Response(
      JSON.stringify(
        localizedApiErrorPayload(req, "generateRateLimited", {
          code: codes.RATE_LIMITED,
          requestId,
        }),
      ),
      {
      status: 429,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  const quotaBlock = await gateGenerationQuota("game");
  if (quotaBlock) return quotaBlock;

  const json = await readLimitedJson(req, requestId);
  if (!json.ok) {
    return new Response(JSON.stringify(json.payload), {
      status: json.status,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  const parsed = parseGeneratePayload(json.body);
  if (!parsed.ok) {
    return new Response(
      JSON.stringify(
        localizedApiErrorPayload(req, parsed.errorKey, {
          code: codes.BAD_REQUEST,
          requestId,
        }),
      ),
      {
      status: parsed.status,
      headers: { "Content-Type": "application/json; charset=utf-8", ...ridHeaders(requestId) },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      const startedAt = Date.now();
      try {
        send({ step: "start", message: streamMessage(uiLocale, "start") });
        const orch = createRunTraceRecorder();

        let creativeBriefPreExpanded: Awaited<ReturnType<typeof expandCreativeBrief>> | undefined;
        if (PRODUCT.game.creativeBriefExpand) {
          creativeBriefPreExpanded = await orch.span("creative_brief_expand", () =>
            expandCreativeBrief({
              prompt: parsed.prompt,
              templateHint: parsed.templateHint,
              orchestration: orch,
            }),
          );
          send({
            step: "brief",
            summary: creativeBriefPreExpanded.oneLineSummary,
            lines: buildStudioBriefBullets(creativeBriefPreExpanded.brief, "game", uiLocale),
            brief: creativeBriefPreExpanded.brief,
          });
        }

        send({
          step: "prep",
          lines: buildServerPrepLines(parsed.prompt, {
            searchEnhance: parsed.searchEnhance,
            templateHint: parsed.templateHint,
            enhancePass: parsed.enhancePass,
          }, uiLocale),
        });
        // 进度：LLM 开始生成规格
        send({ step: "spec_draft", message: streamMessage(uiLocale, "spec_draft") });
        const result = await generateGameSpecWithMeta(parsed.prompt, {
          searchEnhance: parsed.searchEnhance,
          templateHint: parsed.templateHint,
          enhancePass: parsed.enhancePass,
          uiLocale,
          orchestration: orch,
          creativeBriefPreExpanded,
          ...(parsed.assetManifestSummary ? { assetManifestSummary: parsed.assetManifestSummary } : {}),
        });
        const spec = result.spec;
        // 进度：规格生成完成，进入资产丰富化
        send({ step: "enriching", message: streamMessage(uiLocale, "enriching") });
        const recapLines = [
          ...buildGenerateRecapLines(
            uiLocale,
            spec,
            result.web ?? undefined,
            parsed.searchEnhance,
          ),
          ...buildOpenGameRecapFromTrace(uiLocale, result.debug.orchestrationTrace, {
            agenticPlayRoute: spec.agenticPlayRoute,
          }),
          ...buildGameModelRecapFromTrace(uiLocale, result.debug.orchestrationTrace),
        ];
        send({ step: "recap", lines: recapLines });
        emitGenerateServeLog({
          phase: "generate_stream_done",
          requestId,
          durationMs: Date.now() - startedAt,
          byteLength: json.byteLength,
          promptChars: parsed.prompt.length,
          source: result.source,
          llmProvider:
            typeof result.debug.provider === "string" ? result.debug.provider : String(result.debug.provider ?? ""),
        });
        send({
          step: "done",
          spec: result.spec,
          source: result.source,
          web: result.web,
          debug: result.debug,
          message: streamMessage(uiLocale, "done"),
        });
      } catch (err) {
        emitGenerateServeLog({
          phase: "generate_stream_done",
          requestId,
          durationMs: Date.now() - startedAt,
          byteLength: json.byteLength,
          promptChars: parsed.prompt.length,
        });
        void logGenerationError({ contentType: "game", prompt: parsed.prompt, error: err, ownerKey });
        send({ step: "error", message: streamMessage(uiLocale, "error"), ok: false });
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
