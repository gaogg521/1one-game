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
    const body = await res.text().catch(() => "");
    if (res.status === 403 && /IP address not allowed/i.test(body)) {
      return { ok: false, message: "ip_not_allowed", status: res.status };
    }
    return { ok: false, message: `http_${res.status}`, status: res.status };
  } catch {
    return { ok: false, message: "network_error" };
  }
}

async function testOpenAIChatEndpoint(
  base: string,
  provider: RuntimeLlmProvider,
  model: string,
): Promise<ProviderTestResult> {
  const url = `${base}/chat/completions`;
  const bodies: Array<Record<string, unknown>> = [
    { model, messages: [{ role: "user", content: "ping" }] },
    { model, messages: [{ role: "user", content: "ping" }], max_tokens: 8 },
  ];
  for (const body of bodies) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          ...authHeaders(provider),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 403 && /IP address not allowed/i.test(body)) {
          return { ok: false, message: "ip_not_allowed", status: res.status };
        }
        return { ok: false, message: `http_${res.status}`, status: res.status };
      }
      const data = (await res.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
        error?: { message?: string };
      } | null;
      if (data?.error?.message) {
        continue;
      }
      const msg = data?.choices?.[0]?.message;
      const text = msg?.content;
      const reasoning = msg?.reasoning_content;
      if (
        (typeof text === "string" && text.trim()) ||
        (typeof reasoning === "string" && reasoning.trim())
      ) {
        return { ok: true, message: `chat_ok:${model}`, status: res.status };
      }
      // 200 但无正文：部分推理模型只回 reasoning_content，上面已覆盖；否则试下一 body
      if (res.ok && !("max_tokens" in body)) {
        return { ok: true, message: `chat_ok:${model}`, status: res.status };
      }
    } catch {
      return { ok: false, message: "network_error" };
    }
  }
  return { ok: false, message: "chat_empty" };
}

function modelsToTry(provider: RuntimeLlmProvider): string[] {
  const fromList = provider.models.map((m) => m.trim()).filter(Boolean);
  if (fromList.length) return fromList.slice(0, 6);
  return ["gpt-3.5-turbo"];
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

  // 部分自建/中转网关（如 JoyMaaS）不提供 /models；依次尝试模型目录中的模型
  let lastChat: ProviderTestResult = { ok: false, message: "chat_empty" };
  for (const model of modelsToTry(provider)) {
    const chatProbe = await testOpenAIChatEndpoint(base, provider, model);
    if (chatProbe.ok) return chatProbe;
    lastChat = chatProbe;
    if (chatProbe.message === "network_error") break;
  }

  return lastChat.message !== "network_error" ? lastChat : modelsProbe;
}
