/**
 * 文生图：模型与默认分辨率见 `src/lib/product-config.ts` / `model-config.ts`。
 */

import {
  buildComicStyleReferenceInstruction,
  loadStyleReferenceImages,
} from "@/lib/comic-style-reference";
import { panelLooksHistoricalOrPeriod } from "@/lib/comic-panel-prompt-urban";
import type { CoverGenre } from "@/lib/cover-genre";
import { getImageGenDefaultSize, getImageGenGeminiModel, getImageGenOpenAIModel } from "@/lib/model-config";
import { createOpenAIClient } from "@/lib/openai-client";
import { getRuntimeConfigSync } from "@/lib/runtime-config";
import { createOpenAIClientForProvider } from "@/lib/runtime-llm-client";
import { resolveSceneRoute, resolveSceneRouteCandidates } from "@/lib/runtime-providers";
import type { ResolvedSceneCandidate, RuntimeLocaleGroup } from "@/lib/runtime-providers";
import { repoPublicPath } from "@/lib/public-path";
import { recordProviderUsage } from "@/lib/provider-usage";
import { runtimeLocaleGroupForCurrentRequest } from "@/lib/runtime-locale-routing";
import fs from "fs";
import path from "path";

const DEFAULT_IMAGE_GEN_TIMEOUT_MS = 12 * 60 * 1000;

function resolveImageGenTimeoutMs(timeoutMs?: number): number {
  const raw = timeoutMs ?? Number.parseInt(process.env.IMAGE_GEN_TIMEOUT_MS ?? "", 10);
  if (Number.isFinite(raw) && raw >= 30_000) return Math.min(raw, 30 * 60 * 1000);
  return DEFAULT_IMAGE_GEN_TIMEOUT_MS;
}

export interface ImageGenResult {
  url: string;
  localPath?: string;
}

export type ImageGenDetail = {
  ok: boolean;
  url?: string;
  localPath?: string;
  provider?: "openai" | "gemini" | "seedream";
  model?: string;
  error?: string;
  /** 本次 generateImageDetailed 总耗时（含 OpenAI 重试与 Gemini 降级） */
  durationMs?: number;
};

type LocaleImageOptions = { localeGroup?: RuntimeLocaleGroup };

function resolveOpenAIImageClient(localeGroup?: RuntimeLocaleGroup, candidate?: ResolvedSceneCandidate): ReturnType<typeof createOpenAIClient> {
  const ctx = candidate ?? resolveSceneRoute(getRuntimeConfigSync().payload, "comic_image_openai", localeGroup);
  if (ctx) return createOpenAIClientForProvider(ctx.provider);
  return createOpenAIClient();
}

type SeedreamImageConfig = { endpoint: string; key: string; model: string };
type OpenAIImageOptions = {
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  quality?: "standard" | "high";
  n?: number;
  timeoutMs?: number;
  modelOverride?: string;
  routeCandidate?: ResolvedSceneCandidate;
} & LocaleImageOptions;

/**
 * DALL·E 3 uses `standard`/`hd`. gpt-image-1/2 reject those and want
 * `auto`/`low`/`medium`/`high`. Callers still pass the DALL·E names.
 */
export function resolveOpenAIImagesQuality(
  model: string,
  quality?: "standard" | "high",
): "standard" | "hd" | "auto" | "low" | "medium" | "high" | undefined {
  if (!quality) return undefined;
  if (/gpt-image|chatgpt-image/i.test(model)) {
    return quality === "high" ? "high" : "auto";
  }
  return quality === "high" ? "hd" : "standard";
}

export function buildOpenAIImageRequestBodies(input: {
  model: string;
  prompt: string;
  size: string;
  n: number;
  quality?: "standard" | "high";
}): Record<string, unknown>[] {
  const base = { model: input.model, prompt: input.prompt, size: input.size, n: input.n };
  const mapped = resolveOpenAIImagesQuality(input.model, input.quality);
  if (!mapped) return [base];
  return [{ ...base, quality: mapped }, base];
}

export function isSeedreamImageModel(model: string): boolean {
  return model.trim().toLowerCase().startsWith("doubao-seedream-");
}

/**
 * Joy MaaS 的 Seedream API 不兼容 OpenAI images endpoint。仅在显式配置时启用，
 * 防止生产 Ark 等 OpenAI 兼容服务商的同名模型被错误改写到 Joy 路径。
 */
export function shouldUseJoySeedreamAdapter(model: string, mode = process.env.SEEDREAM_IMAGE_API_MODE): boolean {
  return isSeedreamImageModel(model) && mode?.trim().toLowerCase() === "joy";
}

/** Joy MaaS Seedream accepts a quality tier, not the OpenAI pixel-dimension enum. */
function seedreamSize(): "2K" {
  return "2K";
}

export function seedreamGenerationEndpoint(base: string): string {
  return new URL("/api/seedream/v1/images/generations", base).toString();
}

export function buildSeedreamGenerationRequest(model: string, prompt: string, n: number) {
  return {
    model,
    prompt,
    size: seedreamSize(),
    n,
    output_format: "png" as const,
    watermark: false,
    stream: false,
  };
}

/** 豆包 Seedream 在 Joy MaaS 使用专用路由，不兼容 OpenAI `/v1/images/generations`。 */
function resolveSeedreamImageConfig(localeGroup?: RuntimeLocaleGroup, modelOverride?: string, candidate?: ResolvedSceneCandidate): SeedreamImageConfig | null {
  const ctx = candidate ?? resolveSceneRoute(getRuntimeConfigSync().payload, "comic_image_openai", localeGroup);
  const base = ctx?.provider.baseUrl?.trim() || process.env.OPENAI_BASE_URL?.trim();
  const key = ctx?.provider.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  const model = modelOverride ?? getImageGenOpenAIModel(localeGroup);
  if (!base || !key || !shouldUseJoySeedreamAdapter(model)) return null;
  try {
    return {
      endpoint: seedreamGenerationEndpoint(base),
      key,
      model,
    };
  } catch {
    return null;
  }
}

function resolveGeminiImageConfig(localeGroup?: RuntimeLocaleGroup): { base: string; key: string; model: string } | null {
  const ctx = resolveSceneRoute(getRuntimeConfigSync().payload, "comic_image_gemini", localeGroup);
  const model = getImageGenGeminiModel(localeGroup);
  if (ctx) {
    return {
      base: (ctx.provider.baseUrl?.trim() || "https://generativelanguage.googleapis.com").replace(/\/+$/, ""),
      key: ctx.provider.apiKey.trim(),
      model,
    };
  }
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const base = (process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
  return { base, key, model };
}

export function getImageGenAvailability(localeGroup?: RuntimeLocaleGroup): {
  ok: boolean;
  message: string;
  openaiModel: string;
  hasOpenAI: boolean;
  hasGemini: boolean;
} {
  const openaiCtx = resolveSceneRoute(getRuntimeConfigSync().payload, "comic_image_openai", localeGroup);
  const geminiCfg = resolveGeminiImageConfig(localeGroup);
  const hasOpenAI = Boolean(openaiCtx?.provider.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim());
  const hasGemini = Boolean(geminiCfg?.key);
  const openaiModel = getImageGenOpenAIModel(localeGroup);
  if (!hasOpenAI && !hasGemini) {
    return {
      ok: false,
      message: "未配置文生图服务商（请在 Console 模型路由中绑定 comic_image_openai / comic_image_gemini）",
      openaiModel,
      hasOpenAI,
      hasGemini,
    };
  }
  const openaiLabel = openaiCtx?.provider.name ?? "OpenAI 兼容网关";
  return {
    ok: true,
    message: hasOpenAI
      ? `将经 ${openaiLabel} 调用 ${openaiModel}（短篇可一次 n=4 批量，约 2～8 分钟）`
      : `将使用 Gemini ${getImageGenGeminiModel(localeGroup)}`,
    openaiModel,
    hasOpenAI,
    hasGemini,
  };
}

/**
 * 使用 OpenAI 兼容网关生成图片；失败则由上层降级 Gemini。
 */
function imageItemToResult(
  item: { url?: string | null; b64_json?: string | null } | undefined,
  fileStem?: string,
): ImageGenResult | null {
  if (!item) return null;
  if (item.url) return { url: item.url };
  if (item.b64_json) {
    const buf = Buffer.from(item.b64_json, "base64");
    const filename = `openai-${fileStem ?? Date.now()}.png`;
    const dir = repoPublicPath("covers");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const localPath = path.join(/*turbopackIgnore: true*/ dir, filename);
    fs.writeFileSync(/*turbopackIgnore: true*/ localPath, buf);
    return { url: `/covers/${filename}`, localPath };
  }
  return null;
}

async function generateImageWithSeedreamDetail(
  prompt: string,
  options?: OpenAIImageOptions,
): Promise<ImageGenDetail> {
  const localeGroup = options?.localeGroup ?? await runtimeLocaleGroupForCurrentRequest();
  options = { ...options, localeGroup };
  const t0 = Date.now();
  const cfg = resolveSeedreamImageConfig(options?.localeGroup, options?.modelOverride, options?.routeCandidate);
  if (!cfg) return { ok: false, model: options?.modelOverride ?? getImageGenOpenAIModel(options?.localeGroup), error: "未配置 Seedream 网关", durationMs: 0 };
  try {
    const response = await fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify(buildSeedreamGenerationRequest(cfg.model, prompt, options?.n ?? 1)),
      signal: AbortSignal.timeout(resolveImageGenTimeoutMs(options?.timeoutMs)),
    });
    if (!response.ok) return { ok: false, model: cfg.model, error: `Seedream HTTP ${response.status}`, durationMs: Date.now() - t0 };
    const payload = (await response.json()) as { data?: Array<{ url?: string | null; b64_json?: string | null }> };
    const hit = imageItemToResult(payload.data?.[0], `seedream-${Date.now()}`);
    if (!hit) return { ok: false, model: cfg.model, error: "Seedream 响应无 url 或 b64_json", durationMs: Date.now() - t0 };
    return { ok: true, url: hit.url, localPath: hit.localPath, provider: "seedream", model: cfg.model, durationMs: Date.now() - t0 };
  } catch {
    return { ok: false, model: cfg.model, error: "Seedream 图片请求失败", durationMs: Date.now() - t0 };
  }
}

/**
 * LiteLLM / gpt-image-2 等网关常不支持 `response_format`、`quality`；按多种参数组合尝试。
 */
export async function generateImageWithOpenAI(
  prompt: string,
  options?: Omit<OpenAIImageOptions, "modelOverride" | "routeCandidate">
): Promise<ImageGenResult | null> {
  const detail = await generateImageWithOpenAIDetail(prompt, options);
  return detail.ok && detail.url ? { url: detail.url, localPath: detail.localPath } : null;
}

export async function generateImageWithOpenAIDetail(
  prompt: string,
  options?: OpenAIImageOptions,
): Promise<ImageGenDetail> {
  const t0 = Date.now();
  const model = options?.modelOverride ?? options?.routeCandidate?.model ?? getImageGenOpenAIModel(options?.localeGroup);
  if (!options?.routeCandidate && !options?.modelOverride) {
    const candidates = resolveSceneRouteCandidates(getRuntimeConfigSync().payload, "comic_image_openai", options?.localeGroup);
    if (candidates.length > 0) {
      let last: ImageGenDetail | undefined;
      for (const candidate of candidates) {
        const retried = await generateImageWithOpenAIDetail(prompt, { ...options, routeCandidate: candidate, modelOverride: candidate.model });
        if (retried.ok) return retried;
        last = retried;
      }
      return last ?? { ok: false, model, error: "未配置可用图片候选项", durationMs: Date.now() - t0 };
    }
  }
  if (shouldUseJoySeedreamAdapter(model)) return generateImageWithSeedreamDetail(prompt, options);
  let client: ReturnType<typeof createOpenAIClient>;
  try {
    client = resolveOpenAIImageClient(options?.localeGroup, options?.routeCandidate);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, model, error: msg, durationMs: Date.now() - t0 };
  }

  const size = options?.size ?? getImageGenDefaultSize();
  const n = options?.n ?? 1;
  const timeoutMs = resolveImageGenTimeoutMs(options?.timeoutMs);
  const attempts = buildOpenAIImageRequestBodies({
    model,
    prompt,
    size,
    n,
    quality: options?.quality,
  });

  let lastErr = "网关未返回图片数据";
  for (const body of attempts) {
    try {
      if (process.env.GENERATE_STRUCTURED_LOG === "1") {
        console.info("[image-gen] openai request", { model, size });
      }
      const response = await client.images.generate(
        body as unknown as Parameters<typeof client.images.generate>[0],
        { timeout: timeoutMs } as Parameters<typeof client.images.generate>[1],
      );
      if (!("data" in response) || !response.data?.length) {
        lastErr = "响应无 data 字段";
        continue;
      }
      const hit = imageItemToResult(response.data[0]);
      if (hit) {
        if (process.env.GENERATE_STRUCTURED_LOG === "1") {
          console.info("[image-gen] openai ok", { model, url: hit.url.slice(0, 80) });
        }
        return {
          ok: true,
          url: hit.url,
          localPath: hit.localPath,
          provider: "openai",
          model,
          durationMs: Date.now() - t0,
        };
      }
      lastErr = "响应无 url 或 b64_json";
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (process.env.GENERATE_STRUCTURED_LOG === "1") {
        console.warn("[image-gen] openai attempt failed", { model, error: lastErr });
      }
    }
  }
  return { ok: false, model, error: lastErr, durationMs: Date.now() - t0 };
}

export type ImageGenBatchMode = "batch" | "parallel";

export type ImageGenBatchResult = {
  results: ImageGenDetail[];
  mode: ImageGenBatchMode;
  durationMs: number;
  batchError?: string;
};

function buildBatchCombinedPrompt(prompts: string[]): string {
  return (
    `Generate ${prompts.length} distinct manga comic panel illustrations as separate images. ` +
    `Keep a consistent art style across all panels.\n` +
    prompts.map((p, i) => `Panel ${i + 1}: ${p}`).join("\n")
  );
}

/**
 * 一次 OpenAI 兼容网关请求生成多张图（`n` = prompts.length）。
 * 失败时降级为逐张并行请求。
 */
export async function generateImagesBatchOpenAIDetail(
  prompts: string[],
  options?: { size?: "1024x1024" | "1024x1536" | "1536x1024"; quality?: "standard" | "high"; timeoutMs?: number } & LocaleImageOptions,
): Promise<ImageGenBatchResult> {
  const t0 = Date.now();
  if (prompts.length === 0) {
    return { results: [], mode: "batch", durationMs: 0 };
  }
  if (prompts.length === 1) {
    const one = await generateImageWithOpenAIDetail(prompts[0], options);
    return { results: [one], mode: "batch", durationMs: Date.now() - t0 };
  }

  const model = getImageGenOpenAIModel(options?.localeGroup);
  if (shouldUseJoySeedreamAdapter(model)) {
    const results = await Promise.all(
      prompts.map((prompt) => generateImageWithSeedreamDetail(prompt, { ...options, n: 1 })),
    );
    return { results, mode: "parallel", durationMs: Date.now() - t0 };
  }
  let client: ReturnType<typeof createOpenAIClient>;
  try {
    client = resolveOpenAIImageClient(options?.localeGroup);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const fail = prompts.map(() => ({ ok: false as const, model, error: msg }));
    return { results: fail, mode: "parallel", durationMs: Date.now() - t0, batchError: msg };
  }

  const size = options?.size ?? getImageGenDefaultSize();
  const n = prompts.length;
  const timeoutMs = resolveImageGenTimeoutMs(options?.timeoutMs);
  const combinedPrompt = buildBatchCombinedPrompt(prompts);
  const attempts = buildOpenAIImageRequestBodies({
    model,
    prompt: combinedPrompt,
    size,
    n,
    quality: options?.quality,
  });

  let lastErr = "网关未返回足够图片";
  for (const body of attempts) {
    try {
      if (process.env.GENERATE_STRUCTURED_LOG === "1") {
        console.info("[image-gen] openai batch request", { model, size, n });
      }
      const response = await client.images.generate(
        body as unknown as Parameters<typeof client.images.generate>[0],
        { timeout: timeoutMs } as Parameters<typeof client.images.generate>[1],
      );
      const data = "data" in response && Array.isArray(response.data) ? response.data : [];
      if (data.length < n) {
        lastErr = `批量响应仅 ${data.length}/${n} 张`;
        continue;
      }
      const stem = `${Date.now()}`;
      const results: ImageGenDetail[] = [];
      for (let i = 0; i < n; i++) {
        const hit = imageItemToResult(data[i], `${stem}-${i}`);
        if (!hit) {
          lastErr = `第 ${i + 1} 张无 url 或 b64_json`;
          break;
        }
        results.push({
          ok: true,
          url: hit.url,
          localPath: hit.localPath,
          provider: "openai",
          model,
        });
      }
      if (results.length === n) {
        const durationMs = Date.now() - t0;
        for (const r of results) r.durationMs = durationMs;
        if (process.env.GENERATE_STRUCTURED_LOG === "1") {
          console.info("[image-gen] openai batch ok", { model, n, durationMs });
        }
        return { results, mode: "batch", durationMs };
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (process.env.GENERATE_STRUCTURED_LOG === "1") {
        console.warn("[image-gen] openai batch attempt failed", { model, n, error: lastErr });
      }
    }
  }

  console.warn("[image-gen] batch 失败，降级逐张并行", lastErr);
  const results = await Promise.all(
    prompts.map((p) => generateImageWithOpenAIDetail(p, { ...options, n: 1 })),
  );
  return {
    results,
    mode: "parallel",
    durationMs: Date.now() - t0,
    batchError: lastErr,
  };
}

/** 批量文生图：优先 OpenAI `n` 批量，失败格可降级 Gemini。 */
export async function generateImagesBatchDetailed(
  prompts: string[],
  options?: { size?: "1024x1024" | "1024x1536" | "1536x1024"; quality?: "standard" | "high"; timeoutMs?: number } & LocaleImageOptions,
): Promise<ImageGenBatchResult> {
  const batch = await generateImagesBatchOpenAIDetail(prompts, options);
  const results = [...batch.results];
  let changed = false;
  for (let i = 0; i < results.length; i++) {
    if (results[i]?.ok) continue;
    const gemini = await generateImageWithGemini(prompts[i]!, { size: options?.size, localeGroup: options?.localeGroup });
    if (gemini?.url) {
      results[i] = {
        ok: true,
        url: gemini.url,
        localPath: gemini.localPath,
        provider: "gemini",
        model: getImageGenGeminiModel(options?.localeGroup),
      };
      changed = true;
    }
  }
  if (!changed) return batch;
  return { ...batch, results };
}

/**
 * 使用 Gemini Flash Image 生成图片（备选路径）。
 * 需要 GEMINI_API_KEY 环境变量。
 */
export async function generateImageWithGemini(
  prompt: string,
  options?: { size?: string; styleReferenceUrls?: string[]; styleGenre?: CoverGenre; timeoutMs?: number } & LocaleImageOptions,
): Promise<ImageGenResult | null> {
  const cfg = resolveGeminiImageConfig(options?.localeGroup);
  if (!cfg) return null;

  try {
    const geminiModel = cfg.model;
    const refImages = options?.styleReferenceUrls?.length
      ? await loadStyleReferenceImages(options.styleReferenceUrls)
      : [];
    const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [];
    for (const ref of refImages) {
      parts.push({ inline_data: { mime_type: ref.mimeType, data: ref.base64 } });
    }
    const refPrefix =
      refImages.length > 0 ? buildComicStyleReferenceInstruction(options?.styleGenre) : "";
    const textPrompt = refImages.length > 0 ? `${refPrefix}${prompt}` : prompt;
    parts.push({ text: textPrompt });

    const timeoutMs = resolveImageGenTimeoutMs(options?.timeoutMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(
      `${cfg.base}/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(cfg.key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      },
    ).finally(() => clearTimeout(timer));
    if (!res.ok) return null;

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
    };
    const responseParts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = responseParts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) return null;

    // 保存到 public/comics/
    const buf = Buffer.from(imagePart.inlineData.data, "base64");
    const filename = `gemini-${Date.now()}.png`;
    const dir = repoPublicPath("comics");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const localPath = path.join(dir, filename);
    fs.writeFileSync(localPath, buf);

    return { url: `/comics/${filename}`, localPath };
  } catch {
    return null;
  }
}

/**
 * 主入口：优先 OpenAI (gpt-image-2)，失败后降级 Gemini。
 */
export async function generateImageDetailed(
  prompt: string,
  options?: {
    size?: "1024x1024" | "1024x1536" | "1536x1024";
    quality?: "standard" | "high";
    timeoutMs?: number;
    /** 首张分镜图 + 封面等，用于 Gemini 多模态风格锚定 */
    styleReferenceUrls?: string[];
    /** 与参考图一并约束题材（如都市禁止玄幻画风） */
    styleGenre?: CoverGenre;
    localeGroup?: RuntimeLocaleGroup;
  },
): Promise<ImageGenDetail> {
  const t0 = Date.now();
  const record = (result: ImageGenDetail) => {
    recordProviderUsage({
      modality: "image",
      provider: result.provider ?? "unknown",
      model: result.model ?? "unknown",
      operation: "image",
      status: result.ok ? "succeeded" : "failed",
      durationMs: result.durationMs ?? Date.now() - t0,
      outputUnits: result.ok && result.url ? 1 : 0,
      errorCode: result.ok ? undefined : "image_generation_failed",
    });
    return result;
  };
  const styleRefs = options?.styleReferenceUrls?.filter(Boolean) ?? [];

  if (styleRefs.length > 0) {
    const geminiRef = await generateImageWithGemini(prompt, {
      size: options?.size,
      styleReferenceUrls: styleRefs,
      styleGenre: options?.styleGenre,
      timeoutMs: options?.timeoutMs,
      localeGroup: options?.localeGroup,
    });
    if (geminiRef?.url) {
      return record({
        ok: true,
        url: geminiRef.url,
        localPath: geminiRef.localPath,
        provider: "gemini",
        model: getImageGenGeminiModel(options?.localeGroup),
        durationMs: Date.now() - t0,
      });
    }
  }

  const urbanPrefix =
    options?.styleGenre === "urban" && !panelLooksHistoricalOrPeriod({ prompt })
      ? "Modern contemporary urban China manhua, realistic clothing, city or office setting, NO fantasy magic, NO purple energy, NO ancient costumes. "
      : "";
  const openai = await generateImageWithOpenAIDetail(
    styleRefs.length > 0
      ? `Same manga series, consistent art style, line weight and color palette as previous panels. ${urbanPrefix}${prompt}`
      : `${urbanPrefix}${prompt}`,
    options,
  );
  if (openai.ok) return record({ ...openai, durationMs: openai.durationMs ?? Date.now() - t0 });

  const gemini = await generateImageWithGemini(prompt, { size: options?.size, timeoutMs: options?.timeoutMs, localeGroup: options?.localeGroup });
  const durationMs = Date.now() - t0;
  if (gemini?.url) {
    return record({
      ok: true,
      url: gemini.url,
      localPath: gemini.localPath,
      provider: "gemini",
      model: getImageGenGeminiModel(options?.localeGroup),
      durationMs,
    });
  }

  const geminiHint = process.env.GEMINI_API_KEY?.trim()
    ? "Gemini 文生图也未返回图片"
    : "未配置 GEMINI_API_KEY";
  return record({
    ok: false,
    model: openai.model,
    error: [openai.error, geminiHint].filter(Boolean).join("；"),
    durationMs,
  });
}

export async function generateImage(
  prompt: string,
  options?: {
    size?: "1024x1024" | "1024x1536" | "1536x1024";
    quality?: "standard" | "high";
    timeoutMs?: number;
    coverGenre?: CoverGenre;
    localeGroup?: RuntimeLocaleGroup;
  },
): Promise<ImageGenResult | null> {
  const detail = await generateImageDetailed(prompt, {
    ...options,
    styleGenre: options?.coverGenre,
  });
  return detail.ok && detail.url ? { url: detail.url, localPath: detail.localPath } : null;
}
