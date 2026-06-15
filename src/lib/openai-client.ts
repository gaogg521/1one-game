import OpenAI from "openai";
import { novelLlmTimeoutMs } from "@/lib/novel-generate-config";
import type { NovelLengthTier } from "@/lib/novel-length";
import { PRODUCT } from "@/lib/product-config";

function normalizeBaseURL(url: string): string {
  const u = url.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(u) && !/\/v1$/i.test(u)) {
    return `${u}/v1`;
  }
  return u;
}

/** OpenAI 兼容网关 Base URL 规范化（与 SDK 路径一致，自动补 /v1） */
export function normalizeOpenAIBaseURL(url: string): string {
  return normalizeBaseURL(url);
}

function mergeDefaultHeaders(override?: Record<string, string>): Record<string, string> | undefined {
  const h: Record<string, string> = {};
  const ua = process.env.OPENAI_USER_AGENT?.trim();
  if (ua) h["User-Agent"] = ua;
  h["x-openclaw-timeout-ms"] = String(PRODUCT.gateway.defaultOpenClawTimeoutMs);
  if (override) {
    for (const [k, v] of Object.entries(override)) {
      if (k.trim() && v) h[k] = v;
    }
  }
  return Object.keys(h).length ? h : undefined;
}

/**
 * 兼容官方 OpenAI 与自建/中转网关（通过 OPENAI_BASE_URL）。
 * 部分网关要求特定 User-Agent，可用 OPENAI_USER_AGENT。
 * 默认附带 x-openclaw-timeout-ms（见 product-config）；小说按篇幅在 createNovelOpenAIClient 中覆盖。
 * 若 BASE_URL 不含 /v1，会自动补全（与 OpenAI SDK 默认路径一致）。
 */
export function createOpenAIClient(headerOverride?: Record<string, string>): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 未配置");
  }

  const baseRaw = process.env.OPENAI_BASE_URL?.trim();
  const baseURL = baseRaw ? normalizeBaseURL(baseRaw) : undefined;
  const defaultHeaders = mergeDefaultHeaders(headerOverride);

  return new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    ...(defaultHeaders ? { defaultHeaders } : {}),
  });
}

/** 小说正文 LLM：按篇幅覆盖网关 x-openclaw-timeout-ms（长篇默认 30 分钟）。 */
export function createNovelOpenAIClient(tier: NovelLengthTier = "medium"): OpenAI {
  const ms = novelLlmTimeoutMs(tier);
  return createOpenAIClient({ "x-openclaw-timeout-ms": String(ms) });
}
