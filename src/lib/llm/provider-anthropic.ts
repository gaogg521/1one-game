import { safeErrorSummary } from "@/lib/llm/errors";
import type { LlmJsonRequest, LlmJsonResult } from "@/lib/llm/types";

type AnthropicContentBlock = { text?: unknown };
type AnthropicMessagesBody = { content?: AnthropicContentBlock[] };

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  const ms = Math.max(1_000, Math.min(90_000, Math.floor(timeoutMs)));
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`${label} timeout after ${ms}ms`));
      }, ms);
    }),
  ]);
}

export async function llmJsonAnthropic(req: LlmJsonRequest): Promise<LlmJsonResult> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return { ok: false, provider: "anthropic", model: req.model, modeTried: req.mode, error: "missing ANTHROPIC_API_KEY" };
  }
  const base = (process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com").replace(/\/+$/, "");
  const url = `${base}/v1/messages`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), req.timeoutMs);
  try {
    // Anthropic 官方：用 prompt 约束 JSON 输出（不做强 schema），让上层 coerce/overlay 兜底。
    const content = [
      "你必须只输出一个 JSON 对象（不要 markdown，不要代码块）。",
      "若无法严格满足 schema，也必须输出尽量接近的 JSON（后续会自动纠错）。",
      "",
      req.user,
    ].join("\n");
    const body = {
      model: req.model,
      max_tokens: 1600,
      temperature: req.temperature,
      system: req.system,
      messages: [{ role: "user", content }],
    };
    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        signal: ac.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": process.env.ANTHROPIC_VERSION?.trim() || "2023-06-01",
        },
        body: JSON.stringify(body),
      }),
      req.timeoutMs + 2500,
      "anthropic messages",
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, provider: "anthropic", model: req.model, modeTried: req.mode, error: `HTTP ${res.status} ${t}`.slice(0, 800) };
    }
    const json = (await res.json()) as AnthropicMessagesBody;
    const blocks = Array.isArray(json.content) ? json.content : [];
    const text = blocks
      .map((b: AnthropicContentBlock) => (typeof b.text === "string" ? b.text : ""))
      .join("\n")
      .trim();
    const raw = text ? (JSON.parse(text) as unknown) : null;
    if (raw === null) {
      return { ok: false, provider: "anthropic", model: req.model, modeTried: req.mode, error: "empty output" };
    }
    return { ok: true, provider: "anthropic", model: req.model, mode: req.mode, raw };
  } catch (e) {
    return { ok: false, provider: "anthropic", model: req.model, modeTried: req.mode, error: safeErrorSummary(e) };
  } finally {
    clearTimeout(timer);
  }
}

