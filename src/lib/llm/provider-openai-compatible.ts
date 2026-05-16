import type OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";
import { safeErrorSummary } from "@/lib/llm/errors";
import { withTimeout } from "@/lib/llm/utils";
import { envIntPositive, openAiChatOutputTokenLimits } from "@/lib/llm/openai-token-param";
import type { LlmJsonRequest, LlmJsonResult, LlmMode, LlmProvider, LlmTextRequest, LlmTextResult } from "@/lib/llm/types";

function parseJsonContent(text: string | null | undefined): unknown | null {
  if (!text?.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function llmTextOpenAICompatible(params: {
  client: OpenAI;
  req: LlmTextRequest & { provider: LlmProvider };
}): Promise<LlmTextResult> {
  const { client, req } = params;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), req.timeoutMs);
  const messages = [
    { role: "system" as const, content: req.system },
    { role: "user" as const, content: req.user },
  ];
  try {
    const maxOut = req.maxTokens ?? envIntPositive("OPENAI_TEXT_MAX_OUTPUT_TOKENS", 16_000);
    const tokenField = openAiChatOutputTokenLimits(req.model, maxOut);
    const p = client.chat.completions.create(
      {
        model: req.model,
        temperature: req.temperature,
        messages,
        ...tokenField,
      } as ChatCompletionCreateParamsNonStreaming,
      { signal: ac.signal },
    );
    const res = await withTimeout(p, req.timeoutMs + 2500, `llm-text ${req.provider}`);
    const text = res.choices[0]?.message?.content ?? "";
    if (!text || text.length < 10) {
      return { ok: false, provider: req.provider, model: req.model, error: "empty text output" };
    }
    return { ok: true, provider: req.provider, model: req.model, text };
  } catch (e) {
    return { ok: false, provider: req.provider, model: req.model, error: safeErrorSummary(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OpenAI 兼容网关流式输出（SSE 上游）；用于长篇小说等场景。
 * 在 `timeoutMs` 到达时 abort；不按 chunk 做额外 Promise.race（避免误截断）。
 */
export async function* llmTextStreamOpenAICompatible(params: {
  client: OpenAI;
  req: LlmTextRequest & { provider: LlmProvider };
}): AsyncGenerator<string, void, unknown> {
  const { client, req } = params;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), req.timeoutMs);
  const messages = [
    { role: "system" as const, content: req.system },
    { role: "user" as const, content: req.user },
  ];
  try {
    const maxOut = req.maxTokens ?? envIntPositive("OPENAI_TEXT_MAX_OUTPUT_TOKENS", 16_000);
    const tokenField = openAiChatOutputTokenLimits(req.model, maxOut);
    const body = {
      model: req.model,
      temperature: req.temperature,
      messages,
      stream: true as const,
      ...tokenField,
    } satisfies ChatCompletionCreateParamsStreaming;
    const stream = await client.chat.completions.create(body, { signal: ac.signal });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) yield delta;
    }
  } finally {
    clearTimeout(timer);
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

