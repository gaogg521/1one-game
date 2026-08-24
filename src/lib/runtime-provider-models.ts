import { normalizeOpenAIBaseURL } from "@/lib/openai-client";
import type { RuntimeLlmProvider } from "@/lib/runtime-providers";

export type ProviderModelDiscoveryResult = {
  ok: boolean;
  models: string[];
  message: string;
  status?: number;
};

function authHeaders(provider: RuntimeLlmProvider): Record<string, string> {
  return {
    Authorization: `Bearer ${provider.apiKey.trim()}`,
    ...(provider.userAgent ? { "User-Agent": provider.userAgent } : {}),
  };
}

/**
 * 拉取 OpenAI 兼容服务商的 /models 目录。仅返回 model ID，不记录响应正文，
 * 以免网关可能附带的供应商元数据进入日志或审计记录。
 */
export async function discoverRuntimeProviderModels(
  provider: RuntimeLlmProvider,
): Promise<ProviderModelDiscoveryResult> {
  if (!provider.apiKey?.trim()) return { ok: false, models: [], message: "missing_api_key" };
  if (provider.protocol !== "openai_compatible") {
    return { ok: false, models: [], message: "model_discovery_unsupported_protocol" };
  }

  const base = normalizeOpenAIBaseURL(provider.baseUrl);
  if (!base) return { ok: false, models: [], message: "missing_base_url" };

  try {
    const res = await fetch(`${base}/models`, {
      method: "GET",
      headers: authHeaders(provider),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, models: [], message: `http_${res.status}`, status: res.status };

    const payload = (await res.json().catch(() => null)) as { data?: Array<{ id?: unknown }> } | null;
    const models = Array.from(
      new Set(
        (payload?.data ?? [])
          .map((entry) => (typeof entry.id === "string" ? entry.id.trim() : ""))
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));
    return models.length
      ? { ok: true, models, message: "models_ok", status: res.status }
      : { ok: false, models: [], message: "models_empty", status: res.status };
  } catch {
    return { ok: false, models: [], message: "network_error" };
  }
}
