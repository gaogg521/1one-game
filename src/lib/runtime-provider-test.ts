import type { RuntimeLlmProvider } from "@/lib/runtime-providers";

export type ProviderTestResult = {
  ok: boolean;
  message: string;
  status?: number;
};

function normalizeBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

/** 轻量连通性探测：OpenAI 兼容走 /models；Gemini/Anthropic 仅校验 URL 与 Key 是否填写 */
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
    const base = normalizeBase(provider.baseUrl || "https://generativelanguage.googleapis.com");
    if (!base) return { ok: false, message: "missing_base_url" };
    return { ok: true, message: "gemini_config_ok" };
  }

  const base = normalizeBase(provider.baseUrl);
  if (!base) return { ok: false, message: "missing_base_url" };

  const url = `${base}/models`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${provider.apiKey.trim()}`,
        ...(provider.userAgent ? { "User-Agent": provider.userAgent } : {}),
      },
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
