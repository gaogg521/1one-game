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
import { getModelCascadeForProvider, getProviderKeyStatus } from "@/lib/llm/models";
import type { GameModelRouteInput } from "@/lib/game-model-route";
import { resolveGameModelRoute } from "@/lib/game-model-route";
import type { LlmJsonRequest, LlmJsonResult, LlmProvider, LlmTextRequest, LlmTextResult } from "@/lib/llm/types";
import { resolveSceneRouteCandidates, protocolToLlmProvider, preferRequestedModel, RUNTIME_SCENE_KEYS, type RuntimeLocaleGroup, type RuntimeSceneKey } from "@/lib/runtime-providers";
import { getRuntimeConfigSync, getSceneModelCascade } from "@/lib/runtime-config";
import { runtimeLocaleGroupForCurrentRequest } from "@/lib/runtime-locale-routing";
import {
  createNovelOpenAIClientForProvider,
  createOpenAIClientForProvider,
  providerCredentialOk,
  withProviderEnv,
  snapshotProviderEnv,
  restoreProviderEnv,
  applyProviderToProcessEnv,
} from "@/lib/runtime-llm-client";
import { recordProviderUsage } from "@/lib/provider-usage";

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
let _openaiClientKey = "";
const _novelOpenaiClients = new Map<string, OpenAI>();

function envClientKey(prefix = ""): string {
  return `${prefix}|${process.env.OPENAI_API_KEY ?? ""}|${process.env.OPENAI_BASE_URL ?? ""}|${process.env.OPENAI_USER_AGENT ?? ""}`;
}

function getOpenAIClient(): OpenAI {
  const key = envClientKey();
  if (_openaiClient && _openaiClientKey === key) return _openaiClient;
  _openaiClient = createOpenAIClient();
  _openaiClientKey = key;
  return _openaiClient;
}

function getNovelOpenAIClient(tier: NovelLengthTier = "medium"): OpenAI {
  const key = envClientKey(tier);
  const cached = _novelOpenaiClients.get(key);
  if (cached) return cached;
  const client = createNovelOpenAIClient(tier);
  _novelOpenaiClients.set(key, client);
  return client;
}

export function getActiveProvider(): LlmProvider {
  return normalizeProvider(process.env.LLM_PROVIDER);
}

function inferSceneForModel(model: string, localeGroup?: RuntimeLocaleGroup): RuntimeSceneKey | undefined {
  const payload = getRuntimeConfigSync().payload;
  const normalized = model.trim();
  if (!normalized) return undefined;
  for (const scene of RUNTIME_SCENE_KEYS) {
    if (resolveSceneRouteCandidates(payload, scene, localeGroup).some((item) => item.model === normalized)) {
      return scene;
    }
  }
  for (const scene of RUNTIME_SCENE_KEYS) {
    if (getSceneModelCascade(scene, localeGroup).includes(normalized)) return scene;
  }
  return undefined;
}

async function observeLlmResult<T extends LlmJsonResult | LlmTextResult>(
  model: string,
  operation: "json" | "text",
  work: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const result = await work();
  recordProviderUsage({
    modality: "llm",
    provider: result.provider,
    model: result.model || model,
    operation,
    status: result.ok ? "succeeded" : "failed",
    durationMs: Date.now() - startedAt,
    outputUnits: result.ok && "text" in result ? result.text.length : undefined,
    errorCode: result.ok ? undefined : "llm_request_failed",
  });
  return result;
}

export async function llmJson(
  req: Omit<LlmJsonRequest, "provider"> & { scene?: RuntimeSceneKey; localeGroup?: RuntimeLocaleGroup },
  opts?: { novelLongRun?: boolean; lengthTier?: NovelLengthTier },
): Promise<LlmJsonResult> {
  return observeLlmResult(req.model, "json", async () => {
  const { localeGroup: suppliedLocaleGroup, ...request } = req;
  const localeGroup = suppliedLocaleGroup ?? await runtimeLocaleGroupForCurrentRequest();
  const scene = request.scene ?? inferSceneForModel(request.model, localeGroup);
  if (scene) {
    const payload = getRuntimeConfigSync().payload;
    const candidates = preferRequestedModel(
      resolveSceneRouteCandidates(payload, scene, localeGroup),
      request.model,
    );
    if (!candidates.length) {
      return {
        ok: false,
        provider: "openai_compatible",
        model: request.model,
        modeTried: request.mode,
        error: `未配置场景 ${scene} 的服务商`,
      };
    }
    let last: LlmJsonResult | undefined;
    for (const candidate of candidates) {
      const cred = providerCredentialOk(candidate.provider);
      if (!cred.ok) continue;
      const provider = protocolToLlmProvider(candidate.provider.protocol);
      const result = await withProviderEnv(candidate.provider, async () => {
        const routedRequest = { ...request, model: candidate.model };
        if (provider === "anthropic") return await llmJsonAnthropic({ ...routedRequest, provider });
        if (provider === "gemini") return await llmJsonGemini({ ...routedRequest, provider });
        const tier = opts?.lengthTier ?? "medium";
        const client = opts?.novelLongRun
          ? createNovelOpenAIClientForProvider(candidate.provider, tier)
          : createOpenAIClientForProvider(candidate.provider);
        return await llmJsonOpenAICompatible({ client, req: { ...routedRequest, provider }, gatewayBaseUrl: candidate.provider.baseUrl });
      });
      if (result.ok) return result;
      last = result;
    }
    return last ?? { ok: false, provider: "openai_compatible", model: request.model, modeTried: request.mode, error: `场景 ${scene} 没有可用候选项` };
  }

  const provider = getActiveProvider();
  const keyStatus = getProviderKeyStatus(provider);
  if (!keyStatus.ok) {
    return { ok: false, provider, model: request.model, modeTried: request.mode, error: keyStatus.reason ?? "missing key" };
  }
  if (provider === "anthropic") return await llmJsonAnthropic({ ...request, provider });
  if (provider === "gemini") return await llmJsonGemini({ ...request, provider });
  const tier = opts?.lengthTier ?? "medium";
  const client = opts?.novelLongRun ? getNovelOpenAIClient(tier) : getOpenAIClient();
  return await llmJsonOpenAICompatible({
    client,
    req: { ...request, provider },
    gatewayBaseUrl: process.env.OPENAI_BASE_URL,
  });
  });
}

/** 长篇流水线 JSON（设定圣经 / 章规划）：使用小说网关超时头。 */
export async function llmNovelJson(
  req: Omit<LlmJsonRequest, "provider"> & { localeGroup?: RuntimeLocaleGroup },
  lengthTier: NovelLengthTier = "long",
): Promise<LlmJsonResult> {
  return llmJson({ ...req, scene: "novel_plan" }, { novelLongRun: true, lengthTier });
}

export async function llmText(
  req: Omit<LlmTextRequest, "provider"> & { scene?: RuntimeSceneKey; localeGroup?: RuntimeLocaleGroup },
  opts?: { novelLongRun?: boolean; lengthTier?: NovelLengthTier },
): Promise<LlmTextResult> {
  return observeLlmResult(req.model, "text", async () => {
  const { localeGroup: suppliedLocaleGroup, ...request } = req;
  const localeGroup = suppliedLocaleGroup ?? await runtimeLocaleGroupForCurrentRequest();
  const scene = request.scene ?? inferSceneForModel(request.model, localeGroup);
  if (scene) {
    const payload = getRuntimeConfigSync().payload;
    const candidates = preferRequestedModel(
      resolveSceneRouteCandidates(payload, scene, localeGroup),
      request.model,
    );
    if (!candidates.length) {
      return { ok: false, provider: "openai_compatible", model: request.model, error: `未配置场景 ${scene} 的服务商` };
    }
    let last: LlmTextResult | undefined;
    for (const candidate of candidates) {
      const cred = providerCredentialOk(candidate.provider);
      if (!cred.ok) continue;
      const provider = protocolToLlmProvider(candidate.provider.protocol);
      const result = await withProviderEnv(candidate.provider, async () => {
        const tier = opts?.lengthTier ?? "medium";
        const client = opts?.novelLongRun
          ? createNovelOpenAIClientForProvider(candidate.provider, tier)
          : createOpenAIClientForProvider(candidate.provider);
        return await llmTextOpenAICompatible({ client, req: { ...request, model: candidate.model, provider } });
      });
      if (result.ok) return result;
      last = result;
    }
    return last ?? { ok: false, provider: "openai_compatible", model: request.model, error: `场景 ${scene} 没有可用候选项` };
  }

  const provider = getActiveProvider();
  const keyStatus = getProviderKeyStatus(provider);
  if (!keyStatus.ok) {
    return { ok: false, provider, model: request.model, error: keyStatus.reason ?? "missing key" };
  }
  const tier = opts?.lengthTier ?? "medium";
  const client = opts?.novelLongRun ? getNovelOpenAIClient(tier) : getOpenAIClient();
  if (provider === "anthropic" || provider === "gemini") {
    return await llmTextOpenAICompatible({ client, req: { ...request, provider } });
  }
  return await llmTextOpenAICompatible({ client, req: { ...request, provider } });
  });
}

export function llmNovelText(
  req: Omit<LlmTextRequest, "provider"> & { localeGroup?: RuntimeLocaleGroup },
  lengthTier: NovelLengthTier = "medium",
): Promise<LlmTextResult> {
  return llmText({ ...req, scene: "novel" }, { novelLongRun: true, lengthTier });
}

/** OpenAI 兼容网关流式文本（chunk 为增量字符串）；需网关支持 `stream: true`。 */
export async function* llmTextStream(
  req: Omit<LlmTextRequest, "provider"> & { scene?: RuntimeSceneKey; localeGroup?: RuntimeLocaleGroup },
  opts?: { novelLongRun?: boolean; lengthTier?: NovelLengthTier },
): AsyncGenerator<string> {
  const { localeGroup: suppliedLocaleGroup, ...request } = req;
  const localeGroup = suppliedLocaleGroup ?? await runtimeLocaleGroupForCurrentRequest();
  const scene = request.scene ?? inferSceneForModel(request.model, localeGroup);
  if (scene) {
    const payload = getRuntimeConfigSync().payload;
    const candidates = preferRequestedModel(
      resolveSceneRouteCandidates(payload, scene, localeGroup),
      request.model,
    );
    if (!candidates.length) throw new Error(`未配置场景 ${scene} 的服务商`);
    const tier = opts?.lengthTier ?? "medium";
    let lastError = `场景 ${scene} 没有可用候选项`;
    for (const candidate of candidates) {
      const cred = providerCredentialOk(candidate.provider);
      if (!cred.ok) {
        lastError = cred.reason ?? lastError;
        continue;
      }
      const provider = protocolToLlmProvider(candidate.provider.protocol);
      const prev = snapshotProviderEnv();
      applyProviderToProcessEnv(candidate.provider);
      const startedAt = Date.now();
      let outputUnits = 0;
      let succeeded = false;
      let emitted = false;
      try {
        const client = opts?.novelLongRun
          ? createNovelOpenAIClientForProvider(candidate.provider, tier)
          : createOpenAIClientForProvider(candidate.provider);
        for await (const chunk of llmTextStreamOpenAICompatible({ client, req: { ...request, model: candidate.model, provider } })) {
          emitted = true;
          outputUnits += chunk.length;
          yield chunk;
        }
        succeeded = true;
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        // A downstream response is already visible once a chunk was yielded;
        // retrying another provider then would corrupt the article/game text.
        if (emitted) throw error;
      } finally {
        restoreProviderEnv(prev);
        recordProviderUsage({
          modality: "llm",
          provider,
          model: candidate.model,
          operation: "text",
          status: succeeded ? "succeeded" : "failed",
          durationMs: Date.now() - startedAt,
          outputUnits,
          errorCode: succeeded ? undefined : "llm_stream_failed",
        });
      }
    }
    throw new Error(lastError);
  }

  const provider = getActiveProvider();
  const keyStatus = getProviderKeyStatus(provider);
  if (!keyStatus.ok) {
    throw new Error(keyStatus.reason ?? "missing key");
  }
  const tier = opts?.lengthTier ?? "medium";
  const client = opts?.novelLongRun ? getNovelOpenAIClient(tier) : getOpenAIClient();
  const startedAt = Date.now();
  let outputUnits = 0;
  let succeeded = false;
  try {
    for await (const chunk of llmTextStreamOpenAICompatible({ client, req: { ...request, provider } })) {
      outputUnits += chunk.length;
      yield chunk;
    }
    succeeded = true;
  } finally {
    recordProviderUsage({
      modality: "llm",
      provider,
      model: request.model,
      operation: "text",
      status: succeeded ? "succeeded" : "failed",
      durationMs: Date.now() - startedAt,
      outputUnits,
      errorCode: succeeded ? undefined : "llm_stream_failed",
    });
  }
}

/** 小说正文流式：按篇幅使用对应网关超时头（长篇默认 30 分钟）。 */
export async function* llmNovelTextStream(
  req: Omit<LlmTextRequest, "provider"> & { localeGroup?: RuntimeLocaleGroup },
  lengthTier: NovelLengthTier = "medium",
): AsyncGenerator<string> {
  yield* llmTextStream({ ...req, scene: "novel" }, { novelLongRun: true, lengthTier });
}

export function getProviderModelCascade(opts?: GameModelRouteInput): string[] {
  const provider = getActiveProvider();
  if (provider === "anthropic" || provider === "gemini") {
    return getModelCascadeForProvider(provider);
  }
  return resolveGameModelRoute(opts ?? {}).models;
}

export { getNovelStyleTextModelCascade, getNovelPlanModelCascade, getComicStoryboardModelCascade } from "@/lib/model-config";
