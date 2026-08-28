/**
 * 动态 LLM 服务商：Console 可增删改；路由按 scene 绑定 provider + 模型 cascade。
 */
import { PRODUCT } from "@/lib/product-config";
import type { LlmProvider } from "@/lib/llm/types";
import type { RuntimeModelsOverride, RuntimeSecretsPayload } from "@/lib/runtime-config";

export type LlmProtocol = "openai_compatible" | "gemini" | "anthropic";

export type RuntimeSceneKey =
  | "game_text"
  | "game_bgm"
  | "game_vision"
  | "game"
  | "novel"
  | "novel_plan"
  | "comic_storyboard"
  | "comic_image_openai"
  | "comic_image_gemini";

export type RuntimeLlmProvider = {
  id: string;
  name: string;
  protocol: LlmProtocol;
  baseUrl: string;
  apiKey: string;
  userAgent?: string;
  /** 该服务商可用的模型 ID 列表（便于 Console 展示与校验） */
  models: string[];
  enabled: boolean;
};

export type RuntimeModelRoute = {
  scene: RuntimeSceneKey;
  providerId: string;
  primary: string;
  /** Legacy same-provider fallback models. Retained for stored configurations. */
  fallbacks: string[];
  /** Explicit candidates may use any enabled provider; ordered after primary. */
  fallbackCandidates?: RuntimeModelCandidate[];
};

export type RuntimeModelCandidate = {
  providerId: string;
  model: string;
};

/**
 * Language policy is deliberately coarse grained: Simplified + Traditional
 * Chinese share the Chinese cultural/model pool; every other UI language uses
 * the international pool.  It is a routing policy, not a UI translation.
 */
export type RuntimeLocaleGroup = "zh" | "international";

export type RuntimeLocaleModelRoute = RuntimeModelRoute & {
  localeGroup: RuntimeLocaleGroup;
};

export type RuntimeProviderPublic = {
  id: string;
  name: string;
  protocol: LlmProtocol;
  baseUrl: string;
  apiKey: string | null;
  apiKeySource: "env" | "db" | "none";
  userAgent: string | null;
  models: string[];
  enabled: boolean;
};

export type ResolvedSceneRoute = {
  scene: RuntimeSceneKey;
  provider: RuntimeLlmProvider;
  models: string[];
};

export type ResolvedSceneCandidate = {
  scene: RuntimeSceneKey;
  provider: RuntimeLlmProvider;
  model: string;
};

const OPENAI_PROVIDER_ID = "default-openai-compatible";
const GEMINI_PROVIDER_ID = "default-gemini";
const ANTHROPIC_PROVIDER_ID = "default-anthropic";

export function newRuntimeProviderId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function parseModelsList(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(/[,;\n]+/)
        .map((s) => s.trim());
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of arr) {
    if (m && !seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

function openaiLinkedModels(models: RuntimeModelsOverride | undefined): string[] {
  const m = models ?? {};
  return parseModelsList([
    m.gameTextPrimary,
    ...(m.gameTextFallbacks ?? []),
    m.gameVisionPrimary,
    ...(m.gameVisionFallbacks ?? []),
    m.gamePrimary,
    ...(m.gameFallbacks ?? []),
    m.novelTextPrimary,
    m.novelTextFallback,
    m.imageOpenAI,
  ].filter(Boolean) as string[]);
}

function geminiLinkedModels(models: RuntimeModelsOverride | undefined): string[] {
  const m = models ?? {};
  return parseModelsList([m.imageGemini, m.geminiPrimary, ...(m.geminiFallbacks ?? [])].filter(Boolean) as string[]);
}

function anthropicLinkedModels(models: RuntimeModelsOverride | undefined): string[] {
  const m = models ?? {};
  return parseModelsList([m.anthropicPrimary, ...(m.anthropicFallbacks ?? [])].filter(Boolean) as string[]);
}

/** 从 legacy 平铺字段合成默认三服务商（无 DB providers 时使用） */
export function buildLegacyProviders(payload: RuntimeSecretsPayload): RuntimeLlmProvider[] {
  const models = payload.models;
  const out: RuntimeLlmProvider[] = [];

  if (payload.openaiApiKey?.trim() || payload.openaiBaseUrl?.trim()) {
    out.push({
      id: OPENAI_PROVIDER_ID,
      name: "OpenAI 兼容 / 自定义网关",
      protocol: "openai_compatible",
      baseUrl: payload.openaiBaseUrl?.trim() ?? "",
      apiKey: payload.openaiApiKey?.trim() ?? "",
      userAgent: payload.openaiUserAgent?.trim() || undefined,
      models: openaiLinkedModels(models),
      enabled: true,
    });
  }

  if (payload.geminiApiKey?.trim() || payload.geminiBaseUrl?.trim()) {
    out.push({
      id: GEMINI_PROVIDER_ID,
      name: "Google Gemini",
      protocol: "gemini",
      baseUrl: payload.geminiBaseUrl?.trim() ?? "",
      apiKey: payload.geminiApiKey?.trim() ?? "",
      models: geminiLinkedModels(models),
      enabled: true,
    });
  }

  if (payload.anthropicApiKey?.trim()) {
    out.push({
      id: ANTHROPIC_PROVIDER_ID,
      name: "Anthropic",
      protocol: "anthropic",
      baseUrl: "https://api.anthropic.com",
      apiKey: payload.anthropicApiKey.trim(),
      models: anthropicLinkedModels(models),
      enabled: true,
    });
  }

  return out;
}

export function getEffectiveProviders(payload: RuntimeSecretsPayload): RuntimeLlmProvider[] {
  if (payload.providers?.length) {
    return payload.providers.filter((p) => p.enabled !== false);
  }
  return buildLegacyProviders(payload);
}

function pickProviderId(
  providers: RuntimeLlmProvider[],
  protocol: LlmProtocol,
  preferredId: string,
): string {
  const hit = providers.find((p) => p.id === preferredId);
  if (hit) return hit.id;
  const byProtocol = providers.find((p) => p.protocol === protocol);
  return byProtocol?.id ?? preferredId;
}

export function buildDefaultRoutes(
  models: RuntimeModelsOverride,
  providers: RuntimeLlmProvider[],
): RuntimeModelRoute[] {
  const m = { ...PRODUCT.models, ...models };
  const openaiId = pickProviderId(providers, "openai_compatible", OPENAI_PROVIDER_ID);
  const geminiId = pickProviderId(providers, "gemini", GEMINI_PROVIDER_ID);
  const novelFallbacks = [m.novelTextFallback].filter(Boolean);

  return [
    {
      scene: "game_text",
      providerId: openaiId,
      primary: m.gameTextPrimary ?? m.gamePrimary,
      fallbacks: [...(m.gameTextFallbacks ?? m.gameFallbacks ?? [])],
    },
    {
      scene: "game_bgm",
      providerId: openaiId,
      primary: m.gameTextPrimary ?? m.gamePrimary,
      fallbacks: [...(m.gameTextFallbacks ?? m.gameFallbacks ?? [])],
    },
    {
      scene: "game_vision",
      providerId: openaiId,
      primary: m.gameVisionPrimary ?? m.gamePrimary,
      fallbacks: [...(m.gameVisionFallbacks ?? m.gameFallbacks ?? [])],
    },
    {
      scene: "novel",
      providerId: openaiId,
      primary: m.novelTextPrimary,
      fallbacks: novelFallbacks,
    },
    {
      scene: "novel_plan",
      providerId: openaiId,
      primary: m.novelTextPrimary,
      fallbacks: novelFallbacks,
    },
    {
      scene: "comic_storyboard",
      providerId: openaiId,
      primary: m.novelTextPrimary,
      fallbacks: novelFallbacks,
    },
    {
      scene: "comic_image_openai",
      providerId: openaiId,
      primary: m.imageOpenAI,
      fallbacks: [],
    },
    {
      scene: "comic_image_gemini",
      providerId: geminiId,
      primary: m.imageGemini,
      fallbacks: [],
    },
  ];
}

/** 合并 DB 路由与默认路由 — 升级后自动补齐 novel_plan / comic_storyboard 等新场景 */
export function mergeRoutesWithDefaults(
  stored: RuntimeModelRoute[] | undefined,
  payload: RuntimeSecretsPayload,
): RuntimeModelRoute[] {
  const providers = getEffectiveProviders(payload);
  const defaults = buildDefaultRoutes(payload.models ?? {}, providers);
  if (!stored?.length) return defaults;
  const byScene = new Map(stored.map((r) => [r.scene, r]));
  const legacyGame = byScene.get("game");

  return defaults.map((d) => {
    let hit = byScene.get(d.scene);
    if (!hit && legacyGame) {
      if (d.scene === "game_vision") hit = legacyGame;
    }
    if (!hit) return d;
    return {
      ...d,
      providerId: hit.providerId || d.providerId,
      primary: hit.primary?.trim() ? hit.primary : d.primary,
      // An explicit empty array means “no same-provider fallback”. Do not
      // silently inject unrelated product defaults into an operator route.
      fallbacks: Array.isArray(hit.fallbacks) ? hit.fallbacks : d.fallbacks,
      ...(Array.isArray(hit.fallbackCandidates) ? { fallbackCandidates: hit.fallbackCandidates } : {}),
    };
  });
}

export function getEffectiveRoutes(payload: RuntimeSecretsPayload): RuntimeModelRoute[] {
  return mergeRoutesWithDefaults(payload.routes, payload);
}

/** Locale overrides are sparse by design: an absent override safely falls back
 * to the existing global scene route, so upgrading never changes live traffic. */
export function getLocaleRouteOverride(
  payload: RuntimeSecretsPayload,
  scene: RuntimeSceneKey,
  localeGroup?: RuntimeLocaleGroup,
): RuntimeLocaleModelRoute | undefined {
  if (!localeGroup) return undefined;
  return payload.localeRoutes?.find((route) => route.scene === scene && route.localeGroup === localeGroup);
}

/** Merge global scene routes with a locale overlay. Used by the live admin summary. */
export function pickEffectiveSceneRoute<T extends RuntimeModelRoute>(
  routes: T[],
  localeRoutes: Array<T & { localeGroup: RuntimeLocaleGroup }>,
  scene: RuntimeSceneKey,
  localeGroup: RuntimeLocaleGroup,
): { route: T | undefined; overridden: boolean } {
  const override = localeRoutes.find((item) => item.scene === scene && item.localeGroup === localeGroup);
  if (override) return { route: override, overridden: true };
  return { route: routes.find((item) => item.scene === scene), overridden: false };
}

export function routeModelCascade(route: RuntimeModelRoute): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of routeModelCandidates(route)) {
    if (!seen.has(candidate.model)) {
      seen.add(candidate.model);
      out.push(candidate.model);
    }
  }
  return out;
}

/** Ordered candidates preserve the provider beside every model ID. */
export function routeModelCandidates(route: RuntimeModelRoute): RuntimeModelCandidate[] {
  const seen = new Set<string>();
  const add = (out: RuntimeModelCandidate[], providerId: string | undefined, model: string | undefined) => {
    const normalizedProvider = providerId?.trim();
    const normalizedModel = model?.trim();
    if (!normalizedProvider || !normalizedModel) return;
    const key = `${normalizedProvider}\u0000${normalizedModel}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ providerId: normalizedProvider, model: normalizedModel });
  };
  const out: RuntimeModelCandidate[] = [];
  add(out, route.providerId, route.primary);
  if (Array.isArray(route.fallbackCandidates)) {
    for (const candidate of route.fallbackCandidates) add(out, candidate.providerId, candidate.model);
  } else {
    for (const model of route.fallbacks) add(out, route.providerId, model);
  }
  return out;
}

function resolveCandidatesForRoute(
  scene: RuntimeSceneKey,
  route: RuntimeModelRoute | undefined,
  providers: RuntimeLlmProvider[],
): ResolvedSceneCandidate[] {
  if (!route) return [];
  return routeModelCandidates(route).flatMap((candidate) => {
    const provider = providers.find((item) => item.id === candidate.providerId && item.enabled !== false);
    if (!provider?.apiKey?.trim()) return [];
    if (provider.protocol === "openai_compatible" && !provider.baseUrl?.trim()) return [];
    return [{ scene, provider, model: candidate.model }];
  });
}

export function resolveSceneRouteCandidates(
  payload: RuntimeSecretsPayload,
  scene: RuntimeSceneKey,
  localeGroup?: RuntimeLocaleGroup,
): ResolvedSceneCandidate[] {
  const providers = getEffectiveProviders(payload);
  const routes = getEffectiveRoutes(payload);
  const localeRoute = getLocaleRouteOverride(payload, scene, localeGroup);
  const fromLocale = resolveCandidatesForRoute(scene, localeRoute, providers);
  if (fromLocale.length) return fromLocale;
  return resolveCandidatesForRoute(scene, routes.find((r) => r.scene === scene), providers);
}

/** Put the caller-selected model first so cascade retries actually switch IDs. */
export function preferRequestedModel<T extends { model: string }>(
  candidates: T[],
  requested?: string,
): T[] {
  const want = requested?.trim().toLowerCase();
  if (!want || candidates.length <= 1) return candidates;
  const hit = candidates.findIndex((c) => c.model.trim().toLowerCase() === want);
  if (hit <= 0) return candidates;
  return [candidates[hit]!, ...candidates.filter((_, i) => i !== hit)];
}

export function resolveSceneRoute(
  payload: RuntimeSecretsPayload,
  scene: RuntimeSceneKey,
  localeGroup?: RuntimeLocaleGroup,
): ResolvedSceneRoute | null {
  const candidates = resolveSceneRouteCandidates(payload, scene, localeGroup);
  const first = candidates[0];
  if (!first) return null;
  return {
    scene,
    provider: first.provider,
    // Legacy callers may still perform a same-provider model cascade.  Do not
    // leak models from another provider into their credentials; cross-provider
    // retries must use resolveSceneRouteCandidates explicitly.
    models: candidates.filter((candidate) => candidate.provider.id === first.provider.id).map((candidate) => candidate.model),
  };
}

function providerForRoute(
  providers: RuntimeLlmProvider[],
  route: RuntimeModelRoute | undefined,
  protocol: LlmProtocol,
  fallbackId: string,
): RuntimeLlmProvider | undefined {
  if (route?.providerId) {
    const hit = providers.find((p) => p.id === route.providerId && p.enabled !== false);
    if (hit) return hit;
  }
  return providers.find((p) => p.protocol === protocol && p.enabled !== false)
    ?? providers.find((p) => p.id === fallbackId);
}

export function protocolToLlmProvider(protocol: LlmProtocol): LlmProvider {
  if (protocol === "anthropic") return "anthropic";
  if (protocol === "gemini") return "gemini";
  return "openai_compatible";
}

/** 保存 providers 后回写 legacy 字段，兼容仍读 process.env 的路径 */
export function syncLegacySecretsFromProviders(
  payload: RuntimeSecretsPayload,
  providers: RuntimeLlmProvider[],
): RuntimeSecretsPayload {
  const next = { ...payload, providers };
  const routes = mergeRoutesWithDefaults(payload.routes, { ...next, providers });
  const openai =
    providerForRoute(providers, routes.find((r) => r.scene === "game_text"), "openai_compatible", OPENAI_PROVIDER_ID)
    ?? providerForRoute(providers, routes.find((r) => r.scene === "game_vision"), "openai_compatible", OPENAI_PROVIDER_ID)
    ?? providerForRoute(providers, routes.find((r) => r.scene === "game"), "openai_compatible", OPENAI_PROVIDER_ID)
    ?? providers.find((p) => p.protocol === "openai_compatible" && p.enabled !== false);
  const gemini =
    providerForRoute(
      providers,
      routes.find((r) => r.scene === "comic_image_gemini"),
      "gemini",
      GEMINI_PROVIDER_ID,
    ) ?? providers.find((p) => p.protocol === "gemini" && p.enabled !== false);
  const anthropic = providers.find((p) => p.protocol === "anthropic" && p.enabled !== false);

  if (openai) {
    next.openaiApiKey = openai.apiKey;
    next.openaiBaseUrl = openai.baseUrl;
    next.openaiUserAgent = openai.userAgent;
  }
  if (gemini) {
    next.geminiApiKey = gemini.apiKey;
    next.geminiBaseUrl = gemini.baseUrl;
  }
  if (anthropic) {
    next.anthropicApiKey = anthropic.apiKey;
  }
  return next;
}

export function providerApiKeySource(
  provider: RuntimeLlmProvider,
  dbProviders: RuntimeLlmProvider[] | undefined,
  mergedKey: string | undefined,
): "env" | "db" | "none" {
  const db = dbProviders?.find((p) => p.id === provider.id);
  if (db?.apiKey?.trim()) return "db";
  if (mergedKey?.trim()) return "env";
  return "none";
}

export function normalizeProviderPatch(
  current: RuntimeLlmProvider[],
  incoming: RuntimeLlmProvider[],
): RuntimeLlmProvider[] {
  const byId = new Map(current.map((p) => [p.id, p]));
  return incoming.map((p) => {
    const prev = byId.get(p.id);
    const apiKey = p.apiKey?.trim() ? p.apiKey.trim() : (prev?.apiKey ?? "");
    return {
      ...p,
      name: p.name.trim() || prev?.name || "未命名服务商",
      baseUrl: p.baseUrl.trim(),
      apiKey,
      models: parseModelsList(p.models),
      enabled: p.enabled !== false,
    };
  });
}

/** inferScene 优先级：专用场景在前，避免同一模型命中错误网关 */
export const RUNTIME_SCENE_KEYS: RuntimeSceneKey[] = [
  "comic_image_openai",
  "comic_image_gemini",
  "novel_plan",
  "comic_storyboard",
  "novel",
  "game_vision",
  "game_text",
  "game_bgm",
  "game",
];
