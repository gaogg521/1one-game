import { generationErrorCodes } from "@/lib/api/json-error-response";
import { logGenerationError } from "@/lib/generation-error-log";
import { localizedApiErrorPayload } from "@/lib/api/localized-error";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { emitGenerateServeLog } from "@/lib/api/generate-serve-log";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { streamMessage } from "@/lib/create-studio-narrative";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { generateGameSpecWithMeta } from "@/lib/generate-spec";
import { createRunTraceRecorder } from "@/lib/orchestration/run-trace";
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

        // The kernel is built before assets/copy.  Streaming remains useful, but
        // no hidden "creative extraction" gets to rewrite the requested game.
        send({ step: "kernel", message: uiLocale.startsWith("zh") ? "正在围绕你的描述生成可玩规格" : "Writing a playable spec around your prompt" });
        const result = await generateGameSpecWithMeta(parsed.prompt, {
          templateHint: parsed.templateHint,
          uiLocale,
          orchestration: orch,
          ...(parsed.assetManifestSummary ? { assetManifestSummary: parsed.assetManifestSummary } : {}),
        });
        send({ step: "verify", message: uiLocale.startsWith("zh") ? "正在检查关卡节奏、声音、混音与移动端运行" : "Checking level pacing, audio, mix and mobile runtime" });
        const plan = result.debug.kernelPlan;
        const recapLines = plan
          ? [
              plan.label,
              plan.coreLoop,
              plan.controls,
              uiLocale.startsWith("zh")
                ? `首局节奏：${plan.production.levelFlow.map((beat) => beat.phase).join(" → ")}`
                : `First-play pacing: ${plan.production.levelFlow.map((beat) => beat.phase).join(" → ")}`,
              uiLocale.startsWith("zh")
                ? `声音：${plan.production.audio.ambience} 环境音 · BGM 分段推进 · 最多 ${plan.production.audio.mobile.maxConcurrentSfx} 个音效并发`
                : `Audio: ${plan.production.audio.ambience} ambience · staged BGM · ${plan.production.audio.mobile.maxConcurrentSfx} SFX voices max`,
              uiLocale.startsWith("zh") ? "已通过可玩性与声音基础检查" : "Playability and audio checks passed",
            ]
          : [];
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
      "X-Accel-Buffering": "no",
    },
  });
}
