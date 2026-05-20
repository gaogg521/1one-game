import type OpenAI from "openai";
import { createNovelOpenAIClient, createOpenAIClient } from "@/lib/openai-client";
import type { NovelLengthTier } from "@/lib/novel-length";
import {
  llmJsonOpenAICompatible,
  llmTextOpenAICompatible,
  llmTextStreamOpenAICompatible,
} from "@/lib/llm/provider-openai-compatible";
import { llmJsonAnthropic } from "@/lib/llm/provider-anthropic";
import { llmJsonGemini } from "@/lib/llm/provider-gemini";
import { getModelCascadeForProvider, getNovelStyleTextModelCascade, getProviderKeyStatus } from "@/lib/llm/models";
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
const _novelOpenaiClients = new Map<NovelLengthTier, OpenAI>();

function getOpenAIClient(): OpenAI {
  if (_openaiClient) return _openaiClient;
  _openaiClient = createOpenAIClient();
  return _openaiClient;
}

function getNovelOpenAIClient(tier: NovelLengthTier = "medium"): OpenAI {
  let client = _novelOpenaiClients.get(tier);
  if (!client) {
    client = createNovelOpenAIClient(tier);
    _novelOpenaiClients.set(tier, client);
  }
  return client;
}

export function getActiveProvider(): LlmProvider {
  return normalizeProvider(process.env.LLM_PROVIDER);
}

export async function llmJson(
  req: Omit<LlmJsonRequest, "provider">,
  opts?: { novelLongRun?: boolean; lengthTier?: NovelLengthTier },
): Promise<LlmJsonResult> {
  const provider = getActiveProvider();
  const keyStatus = getProviderKeyStatus(provider);
  if (!keyStatus.ok) {
    return { ok: false, provider, model: req.model, modeTried: req.mode, error: keyStatus.reason ?? "missing key" };
  }
  if (provider === "anthropic") return await llmJsonAnthropic({ ...req, provider });
  if (provider === "gemini") return await llmJsonGemini({ ...req, provider });
  const tier = opts?.lengthTier ?? "medium";
  const client = opts?.novelLongRun ? getNovelOpenAIClient(tier) : getOpenAIClient();
  return await llmJsonOpenAICompatible({ client, req: { ...req, provider } });
}

/** 长篇流水线 JSON（设定圣经 / 章规划）：使用小说网关超时头。 */
export async function llmNovelJson(
  req: Omit<LlmJsonRequest, "provider">,
  lengthTier: NovelLengthTier = "long",
): Promise<LlmJsonResult> {
  return llmJson(req, { novelLongRun: true, lengthTier });
}

export async function llmText(
  req: Omit<LlmTextRequest, "provider">,
  opts?: { novelLongRun?: boolean; lengthTier?: NovelLengthTier },
): Promise<LlmTextResult> {
  const provider = getActiveProvider();
  const keyStatus = getProviderKeyStatus(provider);
  if (!keyStatus.ok) {
    return { ok: false, provider, model: req.model, error: keyStatus.reason ?? "missing key" };
  }
  const tier = opts?.lengthTier ?? "medium";
  const client = opts?.novelLongRun ? getNovelOpenAIClient(tier) : getOpenAIClient();
  if (provider === "anthropic" || provider === "gemini") {
    return await llmTextOpenAICompatible({ client, req: { ...req, provider } });
  }
  return await llmTextOpenAICompatible({ client, req: { ...req, provider } });
}

export function llmNovelText(
  req: Omit<LlmTextRequest, "provider">,
  lengthTier: NovelLengthTier = "medium",
): Promise<LlmTextResult> {
  return llmText(req, { novelLongRun: true, lengthTier });
}

/** OpenAI 兼容网关流式文本（chunk 为增量字符串）；需网关支持 `stream: true`。 */
export async function* llmTextStream(
  req: Omit<LlmTextRequest, "provider">,
  opts?: { novelLongRun?: boolean; lengthTier?: NovelLengthTier },
): AsyncGenerator<string> {
  const provider = getActiveProvider();
  const keyStatus = getProviderKeyStatus(provider);
  if (!keyStatus.ok) {
    throw new Error(keyStatus.reason ?? "missing key");
  }
  const tier = opts?.lengthTier ?? "medium";
  const client = opts?.novelLongRun ? getNovelOpenAIClient(tier) : getOpenAIClient();
  yield* llmTextStreamOpenAICompatible({ client, req: { ...req, provider } });
}

/** 小说正文流式：按篇幅使用对应网关超时头（长篇默认 30 分钟）。 */
export async function* llmNovelTextStream(
  req: Omit<LlmTextRequest, "provider">,
  lengthTier: NovelLengthTier = "medium",
): AsyncGenerator<string> {
  yield* llmTextStream(req, { novelLongRun: true, lengthTier });
}

export function getProviderModelCascade(): string[] {
  return getModelCascadeForProvider(getActiveProvider());
}

export { getNovelStyleTextModelCascade };

