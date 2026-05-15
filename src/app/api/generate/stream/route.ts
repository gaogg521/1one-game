import { generationErrorCodes } from "@/lib/api/json-error-response";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { emitGenerateServeLog } from "@/lib/api/generate-serve-log";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { buildServerPrepLines } from "@/lib/create-studio-narrative";
import { generateGameSpecWithMeta } from "@/lib/generate-spec";
import { createRunTraceRecorder } from "@/lib/orchestration/run-trace";
import { getOwnerKey } from "@/lib/owner";
import { parseGeneratePayload } from "@/lib/parse-generate-request";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";

/** SSE：推送生成阶段，最后一帧携带完整 spec（便于创作台展示进度）。 */
export async function POST(req: Request) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const rl = generateRateLimits();
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("gen_stream", ownerKey);
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

  const parsed = parseGeneratePayload(json.body);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.error, code: codes.BAD_REQUEST, requestId }), {
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
        send({ step: "start", message: "已接收创意，准备生成…" });
        send({
          step: "prep",
          lines: buildServerPrepLines(parsed.prompt, {
            searchEnhance: parsed.searchEnhance,
            templateHint: parsed.templateHint,
            enhancePass: parsed.enhancePass,
          }),
        });
        const orch = createRunTraceRecorder();
        const result = await generateGameSpecWithMeta(parsed.prompt, {
          searchEnhance: parsed.searchEnhance,
          templateHint: parsed.templateHint,
          enhancePass: parsed.enhancePass,
          orchestration: orch,
          ...(parsed.assetManifestSummary ? { assetManifestSummary: parsed.assetManifestSummary } : {}),
        });
        const spec = result.spec;
        const recapLines: string[] = [];
        recapLines.push(`**选定模板**：${spec.templateId}`);
        recapLines.push(`**成品标题**：${spec.title}`);
        if (spec.labels?.subtitle?.trim()) {
          recapLines.push(`**氛围副标题**：${spec.labels.subtitle.trim()}`);
        }
        if (spec.templateId === "towerDefense") {
          const bh = Math.round(spec.gameplay.baseHealth ?? 0);
          const sc = Math.round(spec.gameplay.startingCoins ?? 0);
          const ws = Math.round(spec.gameplay.winScore ?? 0);
          recapLines.push(`**塔防概览**：基地生命约 **${bh}** · 开局金币 **${sc}** · 总波次数 **${ws}**（可到右侧快速调试微调）。`);
          const ne = spec.towerDefense?.enemies?.length ?? 0;
          if (ne > 0) recapLines.push(`**敌军种类**：蓝图内登记 **${ne}** 种敌人模型。`);
        } else {
          recapLines.push(
            `**通用玩法数值**：主角移速 ${Math.round(spec.gameplay.playerSpeed)} · 威胁移速 ${Math.round(spec.gameplay.hazardSpeed)} · 取胜目标(winScore) ${Math.round(spec.gameplay.winScore ?? 0)}。`,
          );
        }
        if (result.web?.used) {
          recapLines.push("**联网检索**：已并入摘要片段；来源列表可在生成完成后于页内查看（若有）。");
        } else if (parsed.searchEnhance) {
          recapLines.push(
            `**联网检索**：本轮未得到有效摘要（密钥/配额/无命中等皆可），已退回纯文本管线。${result.web?.warning ? ` 提示：${result.web.warning}` : ""}`,
          );
        }
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
          message: "完成",
        });
      } catch {
        emitGenerateServeLog({
          phase: "generate_stream_done",
          requestId,
          durationMs: Date.now() - startedAt,
          byteLength: json.byteLength,
          promptChars: parsed.prompt.length,
        });
        send({ step: "error", message: "生成过程异常", ok: false });
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
