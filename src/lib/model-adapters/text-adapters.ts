import { postJson } from "@/lib/model-adapters/http";
import type { AdapterInput, AdapterOutcome, ModalityAdapter } from "@/lib/model-adapters/types";

/**
 * Text adapter with reasoning-model awareness.
 *
 * Probed 2026-09-05: `minimax-2-7` and `glm-latest` both return an extra
 * `reasoning_content` field and spend the output budget on it first. With a
 * small `max_tokens` the call returns HTTP 200, `finish_reason: "length"` and
 * an EMPTY `content` — which the JSON pipeline then reported as the useless
 * "empty json output". Distinguishing "truncated by budget" from "model said
 * nothing" is the difference between a retry that can work and one that
 * repeats the same failure.
 */

export type TextCallResult = {
  content: string;
  reasoning?: string;
  finishReason?: string;
  /** True when the budget was consumed before any content was emitted. */
  starvedByReasoning: boolean;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

type ChatChoice = {
  finish_reason?: string;
  message?: { content?: unknown; reasoning_content?: unknown };
};

export function parseChatResponse(json: unknown): TextCallResult | null {
  if (!json || typeof json !== "object") return null;
  const choice = ((json as { choices?: ChatChoice[] }).choices ?? [])[0];
  if (!choice) return null;
  const rawContent = choice.message?.content;
  // Some multimodal responses deliver content as an array of parts.
  const content = typeof rawContent === "string"
    ? rawContent
    : Array.isArray(rawContent)
      ? rawContent.map((p) => (typeof p === "object" && p && "text" in p ? String((p as { text?: unknown }).text ?? "") : "")).join("")
      : "";
  const reasoning = typeof choice.message?.reasoning_content === "string" ? choice.message.reasoning_content : undefined;
  const finishReason = choice.finish_reason;
  return {
    content,
    reasoning,
    finishReason,
    starvedByReasoning: content.trim().length === 0 && Boolean(reasoning?.trim()) && finishReason === "length",
    usage: (json as { usage?: TextCallResult["usage"] }).usage,
  };
}

/** Reasoning models need headroom before they emit any content at all. */
export function isReasoningModel(model: string): boolean {
  return /^(minimax-|glm-|deepseek-|kimi-|qwen-3|gpt-5|doubao-seed)/i.test(model.trim());
}

/** Minimum budget worth sending to a reasoning model for a structured reply. */
export const REASONING_MIN_OUTPUT_TOKENS = 2048;

export const chatTextAdapter: ModalityAdapter = {
  id: "text.chat_completions",
  modality: "text",
  matches: () => true, // every text model on this gateway speaks chat/completions
  describe: () => "POST /v1/chat/completions · reasoning_content aware · budget-starvation detected",
  async invoke(ctx, input: AdapterInput): Promise<AdapterOutcome> {
    const requested = input.maxTokens ?? 4096;
    const maxTokens = isReasoningModel(ctx.model) ? Math.max(requested, REASONING_MIN_OUTPUT_TOKENS) : requested;
    const res = await postJson(ctx.baseUrl, ctx.apiKey, "/v1/chat/completions", {
      model: ctx.model,
      messages: [{ role: "user", content: input.prompt }],
      max_tokens: maxTokens,
      ...(input.temperature != null ? { temperature: input.temperature } : {}),
      ...(input.extra ?? {}),
    }, ctx.timeoutMs);
    if (!res.ok) return { ok: false, error: res.error, status: res.status };

    const parsed = parseChatResponse(res.json);
    if (!parsed) return { ok: false, error: "unrecognised chat response shape", raw: res.json };
    if (!parsed.content.trim()) {
      return {
        ok: false,
        error: parsed.starvedByReasoning
          ? `model spent the whole ${maxTokens}-token budget on reasoning_content and emitted no content — raise maxTokens`
          : `model returned empty content (finish_reason=${parsed.finishReason ?? "unknown"})`,
        raw: res.json,
      };
    }
    return { ok: true, text: parsed.content, raw: res.json };
  },
};

export const TEXT_ADAPTERS: ModalityAdapter[] = [chatTextAdapter];
