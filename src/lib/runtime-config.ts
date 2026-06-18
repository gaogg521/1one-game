/**
 * 平台运行时配置：DB 覆盖 .env，启动时 hydrate，保存后立即生效。
 * 密钥加密落库；模型按游戏 / 小说 / 漫画分域可配。
 */
import { PRODUCT } from "@/lib/product-config";
import { prisma } from "@/lib/prisma";
import { decryptRuntimeSecrets, encryptRuntimeSecrets } from "@/lib/runtime-config-crypto";
import {
  buildDefaultRoutes,
  buildLegacyProviders,
  getEffectiveProviders,
  getEffectiveRoutes,
  mergeRoutesWithDefaults,
  normalizeProviderPatch,
  providerApiKeySource,
  resolveSceneRoute,
  routeModelCascade,
  syncLegacySecretsFromProviders,
  type RuntimeLlmProvider,
  type RuntimeModelRoute,
  type RuntimeProviderPublic,
  type RuntimeSceneKey,
} from "@/lib/runtime-providers";
import { applyProviderToProcessEnv } from "@/lib/runtime-llm-client";

const ROW_ID = "default";
const CACHE_TTL_MS = 30_000;

export type RuntimeModelsOverride = {
  gameTextPrimary?: string;
  gameTextFallbacks?: string[];
  gameVisionPrimary?: string;
  gameVisionFallbacks?: string[];
  gamePrimary?: string;
  gameFallbacks?: string[];
  novelTextPrimary?: string;
  novelTextFallback?: string;
  imageOpenAI?: string;
  imageGemini?: string;
  anthropicPrimary?: string;
  anthropicFallbacks?: string[];
  geminiPrimary?: string;
  geminiFallbacks?: string[];
};

export type RuntimeSecretsPayload = {
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiUserAgent?: string;
  geminiApiKey?: string;
  geminiBaseUrl?: string;
  anthropicApiKey?: string;
  models?: RuntimeModelsOverride;
  providers?: RuntimeLlmProvider[];
  routes?: RuntimeModelRoute[];
};

export type RuntimeSecretField =
  | "openaiApiKey"
  | "openaiBaseUrl"
  | "openaiUserAgent"
  | "geminiApiKey"
  | "geminiBaseUrl"
  | "anthropicApiKey";

export type RuntimeConfigPublicView = {
  updatedAt: string | null;
  updatedByUserId: string | null;
  sources: Record<RuntimeSecretField, "env" | "db" | "none">;
  secrets: {
    openaiApiKey: string | null;
    openaiBaseUrl: string | null;
    openaiUserAgent: string | null;
    geminiApiKey: string | null;
    geminiBaseUrl: string | null;
    anthropicApiKey: string | null;
  };
  models: {
    gameTextPrimary: string;
    gameTextFallbacks: string[];
    gameVisionPrimary: string;
    gameVisionFallbacks: string[];
    gamePrimary: string;
    gameFallbacks: string[];
    novelTextPrimary: string;
    novelTextFallback: string;
    imageOpenAI: string;
    imageGemini: string;
    anthropicPrimary: string;
    anthropicFallbacks: string[];
    geminiPrimary: string;
    geminiFallbacks: string[];
  };
  modelSources: Record<keyof RuntimeModelsOverride, "product" | "db">;
  productDefaults: RuntimeModelsOverride;
  providers: RuntimeProviderPublic[];
  routes: RuntimeModelRoute[];
};

type ResolvedRuntime = {
  payload: RuntimeSecretsPayload;
  dbPayload: RuntimeSecretsPayload;
  updatedAt: Date | null;
  updatedByUserId: string | null;
};

let cache: ResolvedRuntime | null = null;
let cacheAt = 0;

function envTrim(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function defaultModels(): RuntimeModelsOverride {
  const m = PRODUCT.models;
  return {
    gameTextPrimary: m.gameTextPrimary,
    gameTextFallbacks: [...(m.gameTextFallbacks ?? [])],
    gameVisionPrimary: m.gameVisionPrimary,
    gameVisionFallbacks: [...(m.gameVisionFallbacks ?? [])],
    gamePrimary: m.gamePrimary,
    gameFallbacks: [...m.gameFallbacks],
    novelTextPrimary: m.novelTextPrimary,
    novelTextFallback: m.novelTextFallback,
    imageOpenAI: m.imageOpenAI,
    imageGemini: m.imageGemini,
    anthropicPrimary: m.anthropicPrimary,
    anthropicFallbacks: [...m.anthropicFallbacks],
    geminiPrimary: m.geminiPrimary,
    geminiFallbacks: [...m.geminiFallbacks],
  };
}

export function getProductModelDefaults(): RuntimeModelsOverride {
  return defaultModels();
}

function parseDbPayload(secretsEnc: string | null | undefined): RuntimeSecretsPayload {
  if (!secretsEnc) return {};
  try {
    return JSON.parse(decryptRuntimeSecrets(secretsEnc)) as RuntimeSecretsPayload;
  } catch {
    return {};
  }
}

function mergePayload(db: RuntimeSecretsPayload): RuntimeSecretsPayload {
  const models: RuntimeModelsOverride = { ...defaultModels(), ...db.models };
  return {
    openaiApiKey: db.openaiApiKey ?? envTrim("OPENAI_API_KEY"),
    openaiBaseUrl: db.openaiBaseUrl ?? envTrim("OPENAI_BASE_URL"),
    openaiUserAgent: db.openaiUserAgent ?? envTrim("OPENAI_USER_AGENT"),
    geminiApiKey: db.geminiApiKey ?? envTrim("GEMINI_API_KEY"),
    geminiBaseUrl: db.geminiBaseUrl ?? envTrim("GEMINI_BASE_URL"),
    anthropicApiKey: db.anthropicApiKey ?? envTrim("ANTHROPIC_API_KEY"),
    models,
  };
}

function resolveFromEnvOnly(): ResolvedRuntime {
  return {
    payload: mergePayload({}),
    dbPayload: {},
    updatedAt: null,
    updatedByUserId: null,
  };
}

async function loadFromDb(): Promise<ResolvedRuntime> {
  try {
    const row = await prisma.platformRuntimeConfig.findFirst({ where: { id: ROW_ID } });
    if (!row) return resolveFromEnvOnly();
    const dbPayload = parseDbPayload(row.secretsEnc);
    return {
      payload: mergePayload(dbPayload),
      dbPayload,
      updatedAt: row.updatedAt,
      updatedByUserId: row.updatedByUserId,
    };
  } catch {
    return resolveFromEnvOnly();
  }
}

/** 将合并后的有效值写入 process.env — 按场景绑定的网关写入（支持多 LiteLLM 实例时以 game / 配图场景为准）。 */
export function applyRuntimeToProcessEnv(resolved: ResolvedRuntime): void {
  const payload = resolved.payload;
  const set = (key: string, val: string | undefined) => {
    if (val) process.env[key] = val;
    else delete process.env[key];
  };

  const gameCtx = resolveSceneRoute(payload, "game_text") ?? resolveSceneRoute(payload, "game_vision");
  const geminiCtx = resolveSceneRoute(payload, "comic_image_gemini");
  const anthropic = getEffectiveProviders(payload).find((p) => p.protocol === "anthropic" && p.enabled !== false);

  if (gameCtx) applyProviderToProcessEnv(gameCtx.provider);
  else {
    set("OPENAI_API_KEY", payload.openaiApiKey);
    set("OPENAI_BASE_URL", payload.openaiBaseUrl);
    set("OPENAI_USER_AGENT", payload.openaiUserAgent);
  }

  if (geminiCtx) applyProviderToProcessEnv(geminiCtx.provider);
  else {
    set("GEMINI_API_KEY", payload.geminiApiKey);
    set("GEMINI_BASE_URL", payload.geminiBaseUrl);
  }

  if (anthropic?.apiKey) set("ANTHROPIC_API_KEY", anthropic.apiKey);
  else set("ANTHROPIC_API_KEY", payload.anthropicApiKey);
}

export async function loadRuntimeConfig(): Promise<ResolvedRuntime> {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  cache = await loadFromDb();
  cacheAt = Date.now();
  applyRuntimeToProcessEnv(cache);
  return cache;
}

export function invalidateRuntimeConfigCache(): void {
  cache = null;
  cacheAt = 0;
}

export function getRuntimeConfigSync(): ResolvedRuntime {
  if (cache) return cache;
  const resolved = resolveFromEnvOnly();
  applyRuntimeToProcessEnv(resolved);
  return resolved;
}

export function getEffectiveModels(): RuntimeModelsOverride {
  return getRuntimeConfigSync().payload.models ?? defaultModels();
}

export function maskSecret(value: string | undefined | null): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (v.length <= 8) return "••••••••";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

function secretSource(
  field: RuntimeSecretField,
  db: RuntimeSecretsPayload,
  merged: RuntimeSecretsPayload,
): "env" | "db" | "none" {
  if (db[field]?.trim()) return "db";
  if (merged[field]?.trim()) return "env";
  return "none";
}

function modelSource(field: keyof RuntimeModelsOverride, db: RuntimeSecretsPayload): "product" | "db" {
  const dbModels = db.models;
  if (!dbModels) return "product";
  const val = dbModels[field];
  if (val === undefined) return "product";
  if (Array.isArray(val) && val.length === 0) return "product";
  if (typeof val === "string" && !val.trim()) return "product";
  return "db";
}

export async function getRuntimeConfigPublicView(): Promise<RuntimeConfigPublicView> {
  const resolved = await loadRuntimeConfig();
  const { payload, dbPayload, updatedAt, updatedByUserId } = resolved;
  const models = payload.models ?? defaultModels();
  const modelKeys = Object.keys(defaultModels()) as (keyof RuntimeModelsOverride)[];
  const effectiveProviders = getEffectiveProviders(payload);
  const dbProviders = dbPayload.providers;
  const routes = mergeRoutesWithDefaults(dbPayload.routes, payload);

  const providersPublic: RuntimeProviderPublic[] = effectiveProviders.map((p) => ({
    id: p.id,
    name: p.name,
    protocol: p.protocol,
    baseUrl: p.baseUrl,
    apiKey: maskSecret(p.apiKey),
    apiKeySource: providerApiKeySource(p, dbProviders, p.apiKey),
    userAgent: p.userAgent ?? null,
    models: p.models,
    enabled: p.enabled !== false,
  }));

  return {
    updatedAt: updatedAt?.toISOString() ?? null,
    updatedByUserId,
    sources: {
      openaiApiKey: secretSource("openaiApiKey", dbPayload, payload),
      openaiBaseUrl: secretSource("openaiBaseUrl", dbPayload, payload),
      openaiUserAgent: secretSource("openaiUserAgent", dbPayload, payload),
      geminiApiKey: secretSource("geminiApiKey", dbPayload, payload),
      geminiBaseUrl: secretSource("geminiBaseUrl", dbPayload, payload),
      anthropicApiKey: secretSource("anthropicApiKey", dbPayload, payload),
    },
    secrets: {
      openaiApiKey: maskSecret(payload.openaiApiKey),
      openaiBaseUrl: payload.openaiBaseUrl ?? null,
      openaiUserAgent: payload.openaiUserAgent ?? null,
      geminiApiKey: maskSecret(payload.geminiApiKey),
      geminiBaseUrl: payload.geminiBaseUrl ?? null,
      anthropicApiKey: maskSecret(payload.anthropicApiKey),
    },
    models: {
      gameTextPrimary: models.gameTextPrimary ?? PRODUCT.models.gameTextPrimary,
      gameTextFallbacks: models.gameTextFallbacks ?? [...PRODUCT.models.gameTextFallbacks],
      gameVisionPrimary: models.gameVisionPrimary ?? PRODUCT.models.gameVisionPrimary,
      gameVisionFallbacks: models.gameVisionFallbacks ?? [...PRODUCT.models.gameVisionFallbacks],
      gamePrimary: models.gamePrimary ?? PRODUCT.models.gamePrimary,
      gameFallbacks: models.gameFallbacks ?? [...PRODUCT.models.gameFallbacks],
      novelTextPrimary: models.novelTextPrimary ?? PRODUCT.models.novelTextPrimary,
      novelTextFallback: models.novelTextFallback ?? PRODUCT.models.novelTextFallback,
      imageOpenAI: models.imageOpenAI ?? PRODUCT.models.imageOpenAI,
      imageGemini: models.imageGemini ?? PRODUCT.models.imageGemini,
      anthropicPrimary: models.anthropicPrimary ?? PRODUCT.models.anthropicPrimary,
      anthropicFallbacks: models.anthropicFallbacks ?? [...PRODUCT.models.anthropicFallbacks],
      geminiPrimary: models.geminiPrimary ?? PRODUCT.models.geminiPrimary,
      geminiFallbacks: models.geminiFallbacks ?? [...PRODUCT.models.geminiFallbacks],
    },
    modelSources: Object.fromEntries(modelKeys.map((k) => [k, modelSource(k, dbPayload)])) as Record<
      keyof RuntimeModelsOverride,
      "product" | "db"
    >,
    productDefaults: defaultModels(),
    providers: providersPublic,
    routes,
  };
}

export type RuntimeConfigPatch = {
  secrets?: Partial<Record<RuntimeSecretField, string | null>>;
  models?: Partial<Record<keyof RuntimeModelsOverride, string | string[] | null>>;
  providers?: RuntimeLlmProvider[];
  routes?: RuntimeModelRoute[];
};

export function getSceneModelCascade(scene: RuntimeSceneKey): string[] {
  const payload = getRuntimeConfigSync().payload;
  const route = mergeRoutesWithDefaults(payload.routes, payload).find((r) => r.scene === scene);
  if (!route) return [];
  return routeModelCascade(route);
}

export { getEffectiveProviders, getEffectiveRoutes, resolveSceneRoute, type RuntimeSceneKey } from "@/lib/runtime-providers";

function applyPatchToPayload(
  current: RuntimeSecretsPayload,
  patch: RuntimeConfigPatch,
): RuntimeSecretsPayload {
  const next: RuntimeSecretsPayload = { ...current, models: { ...current.models } };

  if (patch.secrets) {
    for (const [k, v] of Object.entries(patch.secrets) as [RuntimeSecretField, string | null | undefined][]) {
      if (v === undefined) continue;
      if (v === null || v === "") {
        delete next[k];
      } else {
        next[k] = v.trim();
      }
    }
  }

  if (patch.models) {
    next.models = { ...next.models };
    for (const [k, v] of Object.entries(patch.models) as [
      keyof RuntimeModelsOverride,
      string | string[] | null | undefined,
    ][]) {
      if (v === undefined) continue;
      if (v === null || v === "") {
        delete next.models![k];
        continue;
      }
      if (k === "gameFallbacks" || k === "gameTextFallbacks" || k === "gameVisionFallbacks" || k === "anthropicFallbacks" || k === "geminiFallbacks") {
        const arr = Array.isArray(v)
          ? v.map((s) => s.trim()).filter(Boolean)
          : String(v)
              .split(/[,;\n]+/)
              .map((s) => s.trim())
              .filter(Boolean);
        if (arr.length) next.models![k] = arr;
        else delete next.models![k];
      } else {
        next.models![k] = String(v).trim();
      }
    }
    if (Object.keys(next.models).length === 0) delete next.models;
  }

  if (patch.providers) {
    const mergedPayload = mergePayload(current);
    const merged = normalizeProviderPatch(
      mergedPayload.providers ?? buildLegacyProviders(mergedPayload),
      patch.providers,
    );
    Object.assign(next, syncLegacySecretsFromProviders({ ...next, providers: merged }, merged));
  }

  if (patch.routes) {
    next.routes = patch.routes;
    const modelsFromRoutes: RuntimeModelsOverride = { ...next.models };
    for (const route of patch.routes) {
      if (route.scene === "game_text") {
        modelsFromRoutes.gameTextPrimary = route.primary;
        modelsFromRoutes.gameTextFallbacks = route.fallbacks;
      } else if (route.scene === "game_vision") {
        modelsFromRoutes.gameVisionPrimary = route.primary;
        modelsFromRoutes.gameVisionFallbacks = route.fallbacks;
      } else if (route.scene === "game") {
        modelsFromRoutes.gamePrimary = route.primary;
        modelsFromRoutes.gameFallbacks = route.fallbacks;
      } else if (route.scene === "novel" || route.scene === "novel_plan" || route.scene === "comic_storyboard") {
        if (route.scene === "novel" || !modelsFromRoutes.novelTextPrimary) {
          modelsFromRoutes.novelTextPrimary = route.primary;
        }
        if (route.fallbacks[0]) modelsFromRoutes.novelTextFallback = route.fallbacks[0];
      } else if (route.scene === "comic_image_openai") {
        modelsFromRoutes.imageOpenAI = route.primary;
      } else if (route.scene === "comic_image_gemini") {
        modelsFromRoutes.imageGemini = route.primary;
      }
    }
    next.models = modelsFromRoutes;
  }

  return next;
}

export async function saveRuntimeConfig(
  patch: RuntimeConfigPatch,
  actorUserId?: string | null,
): Promise<RuntimeConfigPublicView> {
  const row = await prisma.platformRuntimeConfig.findFirst({ where: { id: ROW_ID } });
  const currentDb = parseDbPayload(row?.secretsEnc);
  const nextDb = applyPatchToPayload(currentDb, patch);
  const hasContent =
    Object.keys(nextDb).some((k) => k !== "models" && nextDb[k as keyof RuntimeSecretsPayload]) ||
    (nextDb.models && Object.keys(nextDb.models).length > 0) ||
    (nextDb.providers && nextDb.providers.length > 0) ||
    (nextDb.routes && nextDb.routes.length > 0);

  if (hasContent) {
    await prisma.platformRuntimeConfig.upsert({
      where: { id: ROW_ID },
      create: {
        id: ROW_ID,
        secretsEnc: encryptRuntimeSecrets(JSON.stringify(nextDb)),
        updatedByUserId: actorUserId ?? undefined,
      },
      update: {
        secretsEnc: encryptRuntimeSecrets(JSON.stringify(nextDb)),
        updatedByUserId: actorUserId ?? undefined,
      },
    });
  } else if (row) {
    await prisma.platformRuntimeConfig.delete({ where: { id: ROW_ID } });
  }

  invalidateRuntimeConfigCache();
  await loadRuntimeConfig();
  return getRuntimeConfigPublicView();
}
