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
import { resolveSceneRoute } from "@/lib/runtime-providers";
import { repoPublicPath } from "@/lib/public-path";
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
  provider?: "openai" | "gemini";
  model?: string;
  error?: string;
  /** 本次 generateImageDetailed 总耗时（含 OpenAI 重试与 Gemini 降级） */
  durationMs?: number;
};

function resolveOpenAIImageClient(): ReturnType<typeof createOpenAIClient> {
  const ctx = resolveSceneRoute(getRuntimeConfigSync().payload, "comic_image_openai");
  if (ctx) return createOpenAIClientForProvider(ctx.provider);
  return createOpenAIClient();
}

function resolveGeminiImageConfig(): { base: string; key: string; model: string } | null {
  const ctx = resolveSceneRoute(getRuntimeConfigSync().payload, "comic_image_gemini");
  const model = getImageGenGeminiModel();
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

export function getImageGenAvailability(): {
  ok: boolean;
  message: string;
  openaiModel: string;
  hasOpenAI: boolean;
  hasGemini: boolean;
} {
  const openaiCtx = resolveSceneRoute(getRuntimeConfigSync().payload, "comic_image_openai");
  const geminiCfg = resolveGeminiImageConfig();
  const hasOpenAI = Boolean(openaiCtx?.provider.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim());
  const hasGemini = Boolean(geminiCfg?.key);
  const openaiModel = getImageGenOpenAIModel();
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
      : `将使用 Gemini ${getImageGenGeminiModel()}`,
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

/**
 * LiteLLM / gpt-image-2 等网关常不支持 `response_format`、`quality`；按多种参数组合尝试。
 */
export async function generateImageWithOpenAI(
  prompt: string,
  options?: { size?: "1024x1024" | "1024x1536" | "1536x1024"; quality?: "standard" | "high"; n?: number; timeoutMs?: number }
): Promise<ImageGenResult | null> {
  const detail = await generateImageWithOpenAIDetail(prompt, options);
  return detail.ok && detail.url ? { url: detail.url, localPath: detail.localPath } : null;
}

export async function generateImageWithOpenAIDetail(
  prompt: string,
  options?: { size?: "1024x1024" | "1024x1536" | "1536x1024"; quality?: "standard" | "high"; n?: number; timeoutMs?: number },
): Promise<ImageGenDetail> {
  const t0 = Date.now();
  const model = getImageGenOpenAIModel();
  let client: ReturnType<typeof createOpenAIClient>;
  try {
    client = resolveOpenAIImageClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, model, error: msg, durationMs: Date.now() - t0 };
  }

  const size = options?.size ?? getImageGenDefaultSize();
  const n = options?.n ?? 1;
  const timeoutMs = resolveImageGenTimeoutMs(options?.timeoutMs);
  const attempts: Record<string, unknown>[] = [{ model, prompt, size, n }];
  if (options?.quality) {
    attempts.push({ model, prompt, size, n, quality: options.quality });
  }

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
  options?: { size?: "1024x1024" | "1024x1536" | "1536x1024"; quality?: "standard" | "high"; timeoutMs?: number },
): Promise<ImageGenBatchResult> {
  const t0 = Date.now();
  if (prompts.length === 0) {
    return { results: [], mode: "batch", durationMs: 0 };
  }
  if (prompts.length === 1) {
    const one = await generateImageWithOpenAIDetail(prompts[0], options);
    return { results: [one], mode: "batch", durationMs: Date.now() - t0 };
  }

  const model = getImageGenOpenAIModel();
  let client: ReturnType<typeof createOpenAIClient>;
  try {
    client = resolveOpenAIImageClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const fail = prompts.map(() => ({ ok: false as const, model, error: msg }));
    return { results: fail, mode: "parallel", durationMs: Date.now() - t0, batchError: msg };
  }

  const size = options?.size ?? getImageGenDefaultSize();
  const n = prompts.length;
  const timeoutMs = resolveImageGenTimeoutMs(options?.timeoutMs);
  const combinedPrompt = buildBatchCombinedPrompt(prompts);
  const attempts: Record<string, unknown>[] = [{ model, prompt: combinedPrompt, size, n }];
  if (options?.quality) {
    attempts.push({ model, prompt: combinedPrompt, size, n, quality: options.quality });
  }

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
  options?: { size?: "1024x1024" | "1024x1536" | "1536x1024"; quality?: "standard" | "high"; timeoutMs?: number },
): Promise<ImageGenBatchResult> {
  const batch = await generateImagesBatchOpenAIDetail(prompts, options);
  const results = [...batch.results];
  let changed = false;
  for (let i = 0; i < results.length; i++) {
    if (results[i]?.ok) continue;
    const gemini = await generateImageWithGemini(prompts[i]!, { size: options?.size });
    if (gemini?.url) {
      results[i] = {
        ok: true,
        url: gemini.url,
        localPath: gemini.localPath,
        provider: "gemini",
        model: getImageGenGeminiModel(),
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
  options?: { size?: string; styleReferenceUrls?: string[]; styleGenre?: CoverGenre; timeoutMs?: number },
): Promise<ImageGenResult | null> {
  const cfg = resolveGeminiImageConfig();
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
  },
): Promise<ImageGenDetail> {
  const t0 = Date.now();
  const styleRefs = options?.styleReferenceUrls?.filter(Boolean) ?? [];

  if (styleRefs.length > 0) {
    const geminiRef = await generateImageWithGemini(prompt, {
      size: options?.size,
      styleReferenceUrls: styleRefs,
      styleGenre: options?.styleGenre,
      timeoutMs: options?.timeoutMs,
    });
    if (geminiRef?.url) {
      return {
        ok: true,
        url: geminiRef.url,
        localPath: geminiRef.localPath,
        provider: "gemini",
        model: getImageGenGeminiModel(),
        durationMs: Date.now() - t0,
      };
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
  if (openai.ok) return { ...openai, durationMs: openai.durationMs ?? Date.now() - t0 };

  const gemini = await generateImageWithGemini(prompt, { size: options?.size, timeoutMs: options?.timeoutMs });
  const durationMs = Date.now() - t0;
  if (gemini?.url) {
    return {
      ok: true,
      url: gemini.url,
      localPath: gemini.localPath,
      provider: "gemini",
      model: getImageGenGeminiModel(),
      durationMs,
    };
  }

  const geminiHint = process.env.GEMINI_API_KEY?.trim()
    ? "Gemini 文生图也未返回图片"
    : "未配置 GEMINI_API_KEY";
  return {
    ok: false,
    model: openai.model,
    error: [openai.error, geminiHint].filter(Boolean).join("；"),
    durationMs,
  };
}

export async function generateImage(
  prompt: string,
  options?: {
    size?: "1024x1024" | "1024x1536" | "1536x1024";
    quality?: "standard" | "high";
    timeoutMs?: number;
    coverGenre?: CoverGenre;
  },
): Promise<ImageGenResult | null> {
  const detail = await generateImageDetailed(prompt, {
    ...options,
    styleGenre: options?.coverGenre,
  });
  return detail.ok && detail.url ? { url: detail.url, localPath: detail.localPath } : null;
}
