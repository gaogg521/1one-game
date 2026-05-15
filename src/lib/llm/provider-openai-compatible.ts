import type OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { safeErrorSummary } from "@/lib/llm/errors";
import { envIntPositive, openAiChatOutputTokenLimits } from "@/lib/llm/openai-token-param";
import type { LlmJsonRequest, LlmJsonResult, LlmMode, LlmProvider } from "@/lib/llm/types";

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

function parseJsonContent(text: string | null | undefined): unknown | null {
  if (!text?.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function llmJsonOpenAICompatible(params: {
  client: OpenAI;
  req: Omit<LlmJsonRequest, "provider"> & { provider: LlmProvider };
}): Promise<LlmJsonResult> {
  const { client, req } = params;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), req.timeoutMs);
  const messages = [
    { role: "system" as const, content: req.system },
    { role: "user" as const, content: req.user },
  ];

  async function run(mode: LlmMode): Promise<{ raw: unknown | null; mode: LlmMode }> {
    const maxOut = envIntPositive("OPENAI_JSON_MAX_OUTPUT_TOKENS", 12_288);
    const tokenField = openAiChatOutputTokenLimits(req.model, maxOut);
    const completionParams: ChatCompletionCreateParamsNonStreaming =
      mode === "json_schema"
        ? ({
            model: req.model,
            temperature: req.temperature,
            messages,
            response_format: { type: "json_schema", json_schema: req.jsonSchema },
            ...tokenField,
          } as ChatCompletionCreateParamsNonStreaming)
        : ({
            model: req.model,
            temperature: req.temperature,
            messages,
            response_format: { type: "json_object" },
            ...tokenField,
          } as ChatCompletionCreateParamsNonStreaming);
    const p = client.chat.completions.create(completionParams, { signal: ac.signal });
    const res = await withTimeout(p, req.timeoutMs + 2500, `llm ${req.provider} ${mode}`);
    return { raw: parseJsonContent(res.choices[0]?.message?.content), mode };
  }

  try {
    try {
      const r = await run(req.mode);
      if (r.raw !== null) return { ok: true, provider: req.provider, model: req.model, mode: r.mode, raw: r.raw };
    } catch {
      // fallthrough
    }
    const fallbackMode: LlmMode = req.mode === "json_schema" ? "json_object" : "json_schema";
    const r2 = await run(fallbackMode);
    if (r2.raw !== null) return { ok: true, provider: req.provider, model: req.model, mode: r2.mode, raw: r2.raw };
    return { ok: false, provider: req.provider, model: req.model, modeTried: fallbackMode, error: "empty json output" };
  } catch (e) {
    return { ok: false, provider: req.provider, model: req.model, modeTried: req.mode, error: safeErrorSummary(e) };
  } finally {
    clearTimeout(timer);
  }
}

