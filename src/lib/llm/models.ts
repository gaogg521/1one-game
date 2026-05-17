import { getModelCascade } from "@/lib/model-config";
import { PRODUCT } from "@/lib/product-config";
import type { LlmProvider } from "@/lib/llm/types";

export { getNovelStyleTextModelCascade } from "@/lib/model-config";

export function getModelCascadeForProvider(provider: LlmProvider): string[] {
  if (provider === "anthropic") {
    const { anthropicPrimary, anthropicFallbacks } = PRODUCT.models;
    return [anthropicPrimary, ...anthropicFallbacks].filter(Boolean);
  }
  if (provider === "gemini") {
    const { geminiPrimary, geminiFallbacks } = PRODUCT.models;
    return [geminiPrimary, ...geminiFallbacks].filter(Boolean);
  }
  return getModelCascade();
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
  const key = process.env.OPENAI_API_KEY?.trim();
  return key ? { ok: true } : { ok: false, reason: "未配置 OPENAI_API_KEY" };
}
