/**
 * Azure 等路由上的 GPT‑5/o 系列常会拒绝 body 里的 `max_tokens`，要求改用 `max_completion_tokens`。
 * LiteLLM/网关有时也会给缺省字段；此处显式传参可避免错误字段。
 */

export function openAiCompletionPrefersCompletionTokenParam(modelId: string): boolean {
  const m = modelId.trim().toLowerCase().replace(/^litellm\//, "");
  const flag = typeof process.env.OPENAI_CHAT_USE_MAX_COMPLETION_TOKENS === "string"
    ? process.env.OPENAI_CHAT_USE_MAX_COMPLETION_TOKENS.trim().toLowerCase()
    : "";
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (flag === "0" || flag === "false" || flag === "no") return false;
  /* o‑series、gpt‑5.*：与 OpenAI Responses 对齐的命名空间 */
  if (/^o[0-9]/.test(m)) return true;
  if (/\bgpt-5\b/.test(m)) return true;
  if (m.includes("gpt-5")) return true;
  return false;
}

export function openAiChatOutputTokenLimits(
  modelId: string,
  maxOut: number,
): { max_tokens?: number; max_completion_tokens?: number } {
  const n = Math.max(1, Math.min(131_072, Math.floor(Number.isFinite(maxOut) ? maxOut : 4096)));
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
