import { normalizeOpenAIModelId } from "@/lib/model-cascade";
import type { LlmProvider } from "@/lib/llm/types";

function splitList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getModelCascadeForProvider(provider: LlmProvider): string[] {
  if (provider === "anthropic") {
    const primary = (process.env.ANTHROPIC_MODEL?.trim() || "claude-3-7-sonnet-latest").trim();
    const fallbacks = splitList(process.env.ANTHROPIC_MODEL_FALLBACKS);
    return [primary, ...fallbacks].filter(Boolean);
  }
  if (provider === "gemini") {
    const primary = (process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview").trim();
    const fallbacks = splitList(process.env.GEMINI_MODEL_FALLBACKS);
    return [primary, ...fallbacks].filter(Boolean);
  }
  // OpenAI / LiteLLM(OpenAI-compatible)
  const primary = normalizeOpenAIModelId(process.env.OPENAI_MODEL?.trim() || "gpt-5.2");
  const fallbacks = splitList(process.env.OPENAI_MODEL_FALLBACKS).map(normalizeOpenAIModelId);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of [primary, ...fallbacks]) {
    if (m && !seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out.length ? out : [primary];
}

export function getProviderKeyStatus(provider: LlmProvider): { ok: boolean; reason?: string } {
  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    return key ? { ok: true } : { ok: false, reason: "未配置 ANTHROPIC_API_KEY" };
  }
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY?.trim();
    return key ? { ok: true } : { ok: false, reason: "未配置 GEMINI_API_KEY" };
  }
  // openai/openai-compatible/litellm
  const key = process.env.OPENAI_API_KEY?.trim();
  return key ? { ok: true } : { ok: false, reason: "未配置 OPENAI_API_KEY" };
}

