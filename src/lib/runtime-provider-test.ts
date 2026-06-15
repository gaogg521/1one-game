import { normalizeOpenAIBaseURL } from "@/lib/openai-client";
import type { RuntimeLlmProvider } from "@/lib/runtime-providers";

export type ProviderTestResult = {
  ok: boolean;
  message: string;
  status?: number;
};

function authHeaders(provider: RuntimeLlmProvider): Record<string, string> {
  return {
    Authorization: `Bearer ${provider.apiKey.trim()}`,
    ...(provider.userAgent ? { "User-Agent": provider.userAgent } : {}),
  };
}

async function testOpenAIModelsEndpoint(base: string, provider: RuntimeLlmProvider): Promise<ProviderTestResult> {
  const url = `${base}/models`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: authHeaders(provider),
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      return { ok: true, message: "models_ok", status: res.status };
    }
    return { ok: false, message: `http_${res.status}`, status: res.status };
  } catch {
    return { ok: false, message: "network_error" };
  }
}

async function testOpenAIChatEndpoint(base: string, provider: RuntimeLlmProvider): Promise<ProviderTestResult> {
  const model = provider.models.find((m) => m.trim())?.trim() || "gpt-3.5-turbo";
  const url = `${base}/chat/completions`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...authHeaders(provider),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 8,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      return { ok: false, message: `http_${res.status}`, status: res.status };
    }
    const data = (await res.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    } | null;
    if (data?.error?.message) {
      return { ok: false, message: "chat_error" };
    }
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text === "string" && text.trim()) {
      return { ok: true, message: "chat_ok", status: res.status };
    }
    return { ok: false, message: "chat_empty" };
  } catch {
    return { ok: false, message: "network_error" };
  }
}

/** 轻量连通性探测：OpenAI 兼容先 /v1/models，不支持则回退 /v1/chat/completions */
export async function testRuntimeProvider(provider: RuntimeLlmProvider): Promise<ProviderTestResult> {
  if (!provider.enabled) {
    return { ok: false, message: "provider_disabled" };
  }
  if (!provider.apiKey?.trim()) {
    return { ok: false, message: "missing_api_key" };
  }

  if (provider.protocol === "anthropic") {
    if (!provider.baseUrl.trim()) {
      return { ok: false, message: "missing_base_url" };
    }
    return { ok: true, message: "anthropic_config_ok" };
  }

  if (provider.protocol === "gemini") {
    const base = provider.baseUrl.trim().replace(/\/+$/, "") || "https://generativelanguage.googleapis.com";
    if (!base) return { ok: false, message: "missing_base_url" };
    return { ok: true, message: "gemini_config_ok" };
  }

  const base = normalizeOpenAIBaseURL(provider.baseUrl);
  if (!base) return { ok: false, message: "missing_base_url" };

  const modelsProbe = await testOpenAIModelsEndpoint(base, provider);
  if (modelsProbe.ok) return modelsProbe;

  // 部分自建/中转网关（如 JoyMaaS）不提供 /models，但 /v1/chat/completions 可用
  const chatProbe = await testOpenAIChatEndpoint(base, provider);
  if (chatProbe.ok) return chatProbe;

  // 优先返回 chat 探测结果（更贴近真实调用）；models 仅作快速路径
  return chatProbe.message !== "network_error" ? chatProbe : modelsProbe;
}
