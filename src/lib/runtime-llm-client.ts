import type OpenAI from "openai";
import { createNovelOpenAIClient, createOpenAIClient } from "@/lib/openai-client";
import type { RuntimeLlmProvider } from "@/lib/runtime-providers";

type EnvSnapshot = Record<string, string | undefined>;

export function snapshotProviderEnv(): EnvSnapshot {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_USER_AGENT: process.env.OPENAI_USER_AGENT,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_BASE_URL: process.env.GEMINI_BASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };
}

export function restoreProviderEnv(prev: EnvSnapshot): void {
  for (const [key, val] of Object.entries(prev)) {
    if (val) process.env[key] = val;
    else delete process.env[key];
  }
}

export function applyProviderToProcessEnv(provider: RuntimeLlmProvider): void {
  if (provider.protocol === "openai_compatible") {
    process.env.OPENAI_API_KEY = provider.apiKey;
    process.env.OPENAI_BASE_URL = provider.baseUrl;
    if (provider.userAgent) process.env.OPENAI_USER_AGENT = provider.userAgent;
    else delete process.env.OPENAI_USER_AGENT;
    return;
  }
  if (provider.protocol === "gemini") {
    process.env.GEMINI_API_KEY = provider.apiKey;
    process.env.GEMINI_BASE_URL = provider.baseUrl;
    return;
  }
  process.env.ANTHROPIC_API_KEY = provider.apiKey;
}

export async function withProviderEnv<T>(provider: RuntimeLlmProvider, fn: () => Promise<T>): Promise<T> {
  const prev = snapshotProviderEnv();
  applyProviderToProcessEnv(provider);
  try {
    return await fn();
  } finally {
    restoreProviderEnv(prev);
  }
}

export function createOpenAIClientForProvider(
  provider: RuntimeLlmProvider,
  headerOverride?: Record<string, string>,
): OpenAI {
  return withProviderEnvSync(provider, () => createOpenAIClient(headerOverride));
}

export function createNovelOpenAIClientForProvider(
  provider: RuntimeLlmProvider,
  tier: import("@/lib/novel-length").NovelLengthTier = "medium",
): OpenAI {
  return withProviderEnvSync(provider, () => createNovelOpenAIClient(tier));
}

function withProviderEnvSync<T>(provider: RuntimeLlmProvider, fn: () => T): T {
  const prev = snapshotProviderEnv();
  applyProviderToProcessEnv(provider);
  try {
    return fn();
  } finally {
    restoreProviderEnv(prev);
  }
}

export function providerCredentialOk(provider: RuntimeLlmProvider): { ok: boolean; reason?: string } {
  if (!provider.apiKey?.trim()) return { ok: false, reason: `未配置 ${provider.name} 的 API Key` };
  if (provider.protocol === "openai_compatible" && !provider.baseUrl?.trim()) {
    return { ok: false, reason: `未配置 ${provider.name} 的 Base URL` };
  }
  return { ok: true };
}
