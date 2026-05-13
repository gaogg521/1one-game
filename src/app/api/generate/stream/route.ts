import { generateGameSpecWithMeta } from "@/lib/generate-spec";
import { getOwnerKey } from "@/lib/owner";
import { parseGeneratePayload } from "@/lib/parse-generate-request";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";

/** SSE：推送生成阶段，最后一帧携带完整 spec（便于创作台展示进度）。 */
export async function POST(req: Request) {
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("gen_stream", ownerKey);
  if (!rateLimit(throttleKey, 20, 60_000)) {
    return new Response(JSON.stringify({ error: "生成次数过多，请一分钟后再试" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "无效的 JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = parseGeneratePayload(body);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: parsed.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        send({ step: "start", message: "已接收创意，准备生成…" });
        if (parsed.searchEnhance) {
          send({ step: "search", message: "联网检索同类玩法与风格…" });
        }
        send({ step: "model", message: "生成初稿规格…" });
        if (parsed.enhancePass) {
          send({ step: "enhance", message: "二次强化：提升系统深度与成品感…" });
        }
        const result = await generateGameSpecWithMeta(parsed.prompt, {
          searchEnhance: parsed.searchEnhance,
          templateHint: parsed.templateHint,
          enhancePass: parsed.enhancePass,
        });
        send({ step: "finalize", message: "校验、纠错与规格收敛…" });
        send({
          step: "done",
          spec: result.spec,
          source: result.source,
          web: result.web,
          debug: result.debug,
          message: "完成",
        });
      } catch {
        send({ step: "error", message: "生成过程异常", ok: false });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
