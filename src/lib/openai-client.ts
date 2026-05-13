import OpenAI from "openai";

function normalizeBaseURL(url: string): string {
  const u = url.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(u) && !/\/v1$/i.test(u)) {
    return `${u}/v1`;
  }
  return u;
}

function mergeDefaultHeaders(): Record<string, string> | undefined {
  const h: Record<string, string> = {};
  const ua = process.env.OPENAI_USER_AGENT?.trim();
  if (ua) h["User-Agent"] = ua;
  const raw = process.env.OPENAI_EXTRA_HEADERS_JSON?.trim();
  if (raw) {
    try {
      const extra = JSON.parse(raw) as Record<string, unknown>;
      for (const [k, v] of Object.entries(extra)) {
        if (k.trim() && (typeof v === "string" || typeof v === "number")) h[k] = String(v);
      }
    } catch {
      /* 忽略无效 JSON */
    }
  }
  return Object.keys(h).length ? h : undefined;
}

/**
 * 兼容官方 OpenAI 与自建/中转网关（通过 OPENAI_BASE_URL）。
 * 部分网关要求特定 User-Agent，可用 OPENAI_USER_AGENT。
 * OpenClaw LiteLLM 等可在 OPENAI_EXTRA_HEADERS_JSON 中传 x-openclaw-timeout-ms 等头。
 * 若 BASE_URL 不含 /v1，会自动补全（与 OpenAI SDK 默认路径一致）。
 */
export function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 未配置");
  }

  const baseRaw = process.env.OPENAI_BASE_URL?.trim();
  const baseURL = baseRaw ? normalizeBaseURL(baseRaw) : undefined;
  const defaultHeaders = mergeDefaultHeaders();

  return new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    ...(defaultHeaders ? { defaultHeaders } : {}),
  });
}
