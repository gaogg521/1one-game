/**
 * Azure 等路由上的 GPT‑5/o 系列常会拒绝 body 里的 `max_tokens`，要求改用 `max_completion_tokens`。
 * LiteLLM/网关有时也会给缺省字段；此处显式传参可避免错误字段。
 */

import { PRODUCT } from "@/lib/product-config";

export function openAiCompletionPrefersCompletionTokenParam(modelId: string): boolean {
  const m = modelId.trim().toLowerCase().replace(/^litellm\//, "");
  const forced = PRODUCT.llm.forceMaxCompletionTokens;
  if (forced === true) return true;
  if (forced === false) return false;
  /* o‑series、gpt‑5.*：与 OpenAI Responses 对齐的命名空间 */
  if (/^o[0-9]/.test(m)) return true;
  if (/\bgpt-5\b/.test(m)) return true;
  if (m.includes("gpt-5")) return true;
  return false;
}

/**
 * Reasoning models emit `reasoning_content` before any answer, and that
 * reasoning is billed against the SAME output budget. Below roughly 2k tokens
 * they routinely return HTTP 200 with `finish_reason: "length"` and an EMPTY
 * `content` — which every caller here reports as "the model returned nothing".
 *
 * Verified 2026-09-06 on minimax-2-7 and glm-latest: max_tokens=32 yields
 * empty content, max_tokens=2048 yields the answer. The floor is applied
 * centrally because the small budgets are scattered across call sites written
 * when the routed models were all non-reasoning (a 320-token synopsis, a
 * 400-token vision caption, an 8-token provider ping), and each of those would
 * otherwise silently return nothing the moment a reasoning model is routed.
 */
export const REASONING_OUTPUT_TOKEN_FLOOR = 2048;

/**
 * Reasoning is billed against the same budget as the answer, so a caller that
 * sized `maxOut` for its content gets a TRUNCATED answer once reasoning takes
 * its share. Observed on the game design agent: an 8192 budget produced ~1-2k
 * of reasoning and then a JSON object cut off mid-field. The budget therefore
 * has to be widened for these models, not merely floored.
 */
export const REASONING_HEADROOM_TOKENS = 6144;

/**
 * Reasoning also costs wall-clock. Brief expansion was written against fast
 * completion models and capped at 24-28s; on minimax-2-7 the same call needs
 * 30-60s, so it timed out on every model in the cascade and the caller
 * silently fell back to its static template — novel briefs were never actually
 * LLM-expanded, and nothing reported a failure.
 */
export const REASONING_MIN_TIMEOUT_MS = 90_000;

/** Widens a timeout budget written for non-reasoning models. */
export function reasoningAwareTimeoutMs(modelId: string, timeoutMs: number): number {
  return isReasoningStyleModel(modelId) ? Math.max(timeoutMs, REASONING_MIN_TIMEOUT_MS) : timeoutMs;
}

export function isReasoningStyleModel(modelId: string): boolean {
  const m = modelId.trim().toLowerCase().replace(/^litellm\//, "");
  return /^(minimax-|glm-|deepseek-|kimi-|qwen-?3|gpt-5|o[0-9]|doubao-seed|claude-(opus|sonnet|fable))/.test(m);
}

export function openAiChatOutputTokenLimits(
  modelId: string,
  maxOut: number,
): { max_tokens?: number; max_completion_tokens?: number } {
  const requested = Math.floor(Number.isFinite(maxOut) ? maxOut : 4096);
  const adjusted = isReasoningStyleModel(modelId)
    ? Math.max(requested + REASONING_HEADROOM_TOKENS, REASONING_OUTPUT_TOKEN_FLOOR)
    : requested;
  const n = Math.max(1, Math.min(131_072, adjusted));
  return openAiCompletionPrefersCompletionTokenParam(modelId)
    ? { max_completion_tokens: n }
    : { max_tokens: n };
}

export function envIntPositive(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
