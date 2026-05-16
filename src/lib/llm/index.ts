import type OpenAI from "openai";
import { createOpenAIClient } from "@/lib/openai-client";
import { llmJsonOpenAICompatible, llmTextOpenAICompatible } from "@/lib/llm/provider-openai-compatible";
import { llmJsonAnthropic } from "@/lib/llm/provider-anthropic";
import { llmJsonGemini } from "@/lib/llm/provider-gemini";
import { getModelCascadeForProvider, getProviderKeyStatus } from "@/lib/llm/models";
import type { LlmJsonRequest, LlmJsonResult, LlmProvider, LlmTextRequest, LlmTextResult } from "@/lib/llm/types";

function normalizeProvider(p: string | undefined): LlmProvider {
  const v = (p ?? "").trim().toLowerCase();
  if (v === "openai") return "openai";
  if (v === "openai_compatible") return "openai_compatible";
  if (v === "litellm") return "litellm";
  if (v === "anthropic") return "anthropic";
  if (v === "gemini") return "gemini";
  return "litellm";
}

let _openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (_openaiClient) return _openaiClient;
  _openaiClient = createOpenAIClient();
  return _openaiClient;
}

export function getActiveProvider(): LlmProvider {
  return normalizeProvider(process.env.LLM_PROVIDER);
}

export async function llmJson(req: Omit<LlmJsonRequest, "provider">): Promise<LlmJsonResult> {
  const provider = getActiveProvider();
  const keyStatus = getProviderKeyStatus(provider);
  if (!keyStatus.ok) {
    return { ok: false, provider, model: req.model, modeTried: req.mode, error: keyStatus.reason ?? "missing key" };
  }
  if (provider === "anthropic") return await llmJsonAnthropic({ ...req, provider });
  if (provider === "gemini") return await llmJsonGemini({ ...req, provider });
  // 默认走 OpenAI-compatible（包含 LiteLLM/OpenAI 官方）
  const client = getOpenAIClient();
  return await llmJsonOpenAICompatible({ client, req: { ...req, provider } });
}

export async function llmText(req: Omit<LlmTextRequest, "provider">): Promise<LlmTextResult> {
  const provider = getActiveProvider();
  const keyStatus = getProviderKeyStatus(provider);
  if (!keyStatus.ok) {
    return { ok: false, provider, model: req.model, error: keyStatus.reason ?? "missing key" };
  }
  if (provider === "anthropic") {
    // Anthropic 也走 OpenAI-compatible 客户端（LiteLLM 等代理可转接）
    const client = getOpenAIClient();
    return await llmTextOpenAICompatible({ client, req: { ...req, provider } });
  }
  if (provider === "gemini") {
    const client = getOpenAIClient();
    return await llmTextOpenAICompatible({ client, req: { ...req, provider } });
  }
  const client = getOpenAIClient();
  return await llmTextOpenAICompatible({ client, req: { ...req, provider } });
}

export function getProviderModelCascade(): string[] {
  return getModelCascadeForProvider(getActiveProvider());
}

