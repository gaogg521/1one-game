import type OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";
import { safeErrorSummary } from "@/lib/llm/errors";
import { runWithAbortTimeout } from "@/lib/llm/utils";
import { PRODUCT } from "@/lib/product-config";
import { openAiChatOutputTokenLimits } from "@/lib/llm/openai-token-param";
import type { LlmJsonRequest, LlmJsonResult, LlmMode, LlmProvider, LlmTextRequest, LlmTextResult } from "@/lib/llm/types";

/**
 * Parses a model's JSON reply, tolerating the wrappers models actually emit.
 *
 * Verified 2026-09-06 on minimax-2-7 and glm-latest: even in
 * `response_format: json_schema` mode both routinely wrap the object in a
 * ```json fence, and sometimes prefix a sentence. A bare `JSON.parse` throws
 * on those, returned null, and the whole pipeline reported it as "empty json
 * output" — so a model that had answered correctly looked like a model that
 * had said nothing, and every caller burned its retry budget re-asking.
 */
export function parseJsonContent(text: string | null | undefined): unknown | null {
  const raw = text?.trim();
  if (!raw) return null;

  const attempt = (candidate: string): unknown | null => {
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  };

  const direct = attempt(raw);
  if (direct !== null) return direct;

  // ```json … ``` or a bare ``` … ``` fence, possibly with prose around it.
  const fenced = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(raw);
  if (fenced?.[1]) {
    const fromFence = attempt(fenced[1]);
    if (fromFence !== null) return fromFence;
  }

  // Last resort: the outermost balanced object or array in the reply, which
  // covers "Here is the JSON: { … }" and trailing commentary.
  //
  // This must only fire when the delimiters actually balance. A completion cut
  // off by the token budget looks like `{"a":1,"b":{"c":2}` — slicing to the
  // last `}` yields a *nested* fragment that parses cleanly, and the caller
  // then sees a well-formed object with most top-level fields missing rather
  // than the truncation it actually was.
  for (const [open, close] of [["{", "}"], ["[", "]"]] as const) {
    const start = raw.indexOf(open);
    const end = raw.lastIndexOf(close);
    if (start === -1 || end <= start) continue;
    const sliced = raw.slice(start, end + 1);
    if (!isBalanced(sliced, open, close)) continue;
    const parsed = attempt(sliced);
    if (parsed !== null) return parsed;
  }

  return null;
}

/** Delimiter balance ignoring anything inside string literals. */
function isBalanced(source: string, open: string, close: string): boolean {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const ch of source) {
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

export async function llmTextOpenAICompatible(params: {
  client: OpenAI;
  req: LlmTextRequest & { provider: LlmProvider };
}): Promise<LlmTextResult> {
  const { client, req } = params;
  const messages = [
    { role: "system" as const, content: req.system },
    { role: "user" as const, content: req.user },
  ];
  try {
    const maxOut = req.maxTokens ?? PRODUCT.llm.textMaxOutputTokens;
    const tokenField = openAiChatOutputTokenLimits(req.model, maxOut);
    const res = await runWithAbortTimeout(req.timeoutMs, `llm-text ${req.provider}`, (signal) =>
      client.chat.completions.create(
        {
          model: req.model,
          temperature: req.temperature,
          messages,
          ...tokenField,
        } as ChatCompletionCreateParamsNonStreaming,
        { signal },
      ),
      req.signal,
    );
    const text = res.choices[0]?.message?.content ?? "";
    if (!text || text.length < 10) {
      return { ok: false, provider: req.provider, model: req.model, error: "empty text output" };
    }
    return { ok: true, provider: req.provider, model: req.model, text };
  } catch (e) {
    return { ok: false, provider: req.provider, model: req.model, error: safeErrorSummary(e) };
  }
}

/**
 * OpenAI 兼容网关流式输出（SSE 上游）；用于长篇小说等场景。
 * 超时通过独立 AbortSignal 取消，不按 chunk 做额外 Promise.race。
 */
export async function* llmTextStreamOpenAICompatible(params: {
  client: OpenAI;
  req: LlmTextRequest & { provider: LlmProvider };
}): AsyncGenerator<string, void, unknown> {
  const { client, req } = params;
  const messages = [
    { role: "system" as const, content: req.system },
    { role: "user" as const, content: req.user },
  ];
  const maxOut = req.maxTokens ?? PRODUCT.llm.textMaxOutputTokens;
  const tokenField = openAiChatOutputTokenLimits(req.model, maxOut);
  const body = {
    model: req.model,
    temperature: req.temperature,
    messages,
    stream: true as const,
    ...tokenField,
  } satisfies ChatCompletionCreateParamsStreaming;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), req.timeoutMs);
  // P1 修复：外部 signal（客户端断连）联动 abort
  let onExternalAbort: (() => void) | null = null;
  if (req.signal) {
    if (req.signal.aborted) {
      ac.abort();
    } else {
      onExternalAbort = () => ac.abort();
      req.signal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }
  try {
    const stream = await client.chat.completions.create(body, { signal: ac.signal });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) yield delta;
    }
  } finally {
    clearTimeout(timer);
    if (onExternalAbort && req.signal) {
      req.signal.removeEventListener("abort", onExternalAbort);
    }
  }
}

export async function llmJsonOpenAICompatible(params: {
  client: OpenAI;
  req: Omit<LlmJsonRequest, "provider"> & { provider: LlmProvider };
  gatewayBaseUrl?: string | null;
}): Promise<LlmJsonResult> {
  const { client, req, gatewayBaseUrl } = params;
  const messages = [
    { role: "system" as const, content: req.system },
    { role: "user" as const, content: req.user },
  ];

  async function run(mode: LlmMode): Promise<{ raw: unknown | null; mode: LlmMode; hadContent: boolean }> {
    const maxOut = req.maxTokens ?? PRODUCT.llm.jsonMaxOutputTokens;
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

    const res = await runWithAbortTimeout(req.timeoutMs, `llm ${req.provider} ${mode}`, (signal) =>
      client.chat.completions.create(completionParams, { signal }),
      req.signal,
    );
    const content = res.choices[0]?.message?.content;
    return { raw: parseJsonContent(content), mode, hadContent: Boolean(content?.trim()) };
  }

  try {
    try {
      const r = await run(req.mode);
      if (r.raw !== null) return { ok: true, provider: req.provider, model: req.model, mode: r.mode, raw: r.raw };
    } catch (error) {
      // Retrying JSON Object is only useful when the gateway explicitly does
      // not support JSON Schema. A timeout/network/auth failure must return
      // immediately instead of doubling every runtime-generation wait.
      const summary = safeErrorSummary(error, { gatewayBaseUrl });
      if (!/response[_ ]format|json[_ ]schema|unsupported.*schema|schema.*unsupported/i.test(summary)) {
        return { ok: false, provider: req.provider, model: req.model, modeTried: req.mode, error: summary };
      }
      // fallthrough — each run uses an independent AbortController
    }
    const fallbackMode: LlmMode = req.mode === "json_schema" ? "json_object" : "json_schema";
    const r2 = await run(fallbackMode);
    if (r2.raw !== null) return { ok: true, provider: req.provider, model: req.model, mode: r2.mode, raw: r2.raw };
    // "empty" is only one of the ways this lands; say which so a caller can
    // tell "the model said nothing" from "the model answered unparseably".
    return {
      ok: false,
      provider: req.provider,
      model: req.model,
      modeTried: fallbackMode,
      error: r2.hadContent ? "model reply was not parseable as JSON" : "empty json output",
    };
  } catch (e) {
    return {
      ok: false,
      provider: req.provider,
      model: req.model,
      modeTried: req.mode,
      error: safeErrorSummary(e, { gatewayBaseUrl }),
    };
  }
}
