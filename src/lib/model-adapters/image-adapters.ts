import { postJson } from "@/lib/model-adapters/http";
import type { AdapterInput, AdapterOutcome, AdapterRequestContext, ModalityAdapter } from "@/lib/model-adapters/types";

/**
 * Image adapters, one per protocol actually observed on the gateway
 * (probed 2026-09-05, evidence in `scripts/qa-model-adapters.ts`):
 *
 *  - doubao-seedream-*      POST /api/seedream/v1/images/generations, tier size
 *  - gpt-image-*            POST /v1/images/generations, OpenAI pixel size
 *  - gemini-*image*         POST /v1/chat/completions, image inside content[]
 *
 * Calling any of these with another family's shape returns 404 model_not_found
 * even though /v1/models lists the model, which is what made the failure look
 * like "the model does not exist".
 */

function pickDataUrlOrUrl(node: unknown): { url?: string; bytes?: Buffer; mimeType?: string } | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const b64 = typeof obj.b64_json === "string" ? obj.b64_json : null;
  if (b64) return { bytes: Buffer.from(b64, "base64"), mimeType: "image/png" };
  const url = typeof obj.url === "string" ? obj.url : null;
  if (url && url.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(url);
    if (match) return { bytes: Buffer.from(match[2]!, "base64"), mimeType: match[1]! };
  }
  if (url) return { url };
  return null;
}

/** Walks an arbitrary response tree for the first image payload it recognises. */
function findImageDeep(node: unknown, depth = 0): { url?: string; bytes?: Buffer; mimeType?: string } | null {
  if (depth > 6 || node == null) return null;
  const direct = pickDataUrlOrUrl(node);
  if (direct) return direct;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findImageDeep(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node === "object") {
    for (const value of Object.values(node as Record<string, unknown>)) {
      const hit = findImageDeep(value, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/** Seedream takes a quality tier ("1K"/"2K"/"4K"), never a pixel enum. */
function seedreamTier(size?: string): string {
  if (!size) return "2K";
  if (/^\d?K$/i.test(size)) return size.toUpperCase();
  const width = Number.parseInt(size.split("x")[0] ?? "", 10);
  if (Number.isFinite(width) && width >= 1536) return "2K";
  return "1K";
}

export const seedreamImageAdapter: ModalityAdapter = {
  id: "image.seedream",
  modality: "image",
  matches: (model) => /^doubao-seedream-/i.test(model.trim()),
  describe: () => "POST /api/seedream/v1/images/generations · tier size (1K/2K) · output_format png · watermark false",
  async invoke(ctx: AdapterRequestContext, input: AdapterInput): Promise<AdapterOutcome> {
    const res = await postJson(ctx.baseUrl, ctx.apiKey, "/api/seedream/v1/images/generations", {
      model: ctx.model,
      prompt: input.prompt,
      size: seedreamTier(input.size),
      n: 1,
      output_format: "png",
      watermark: false,
      stream: false,
      ...(input.extra ?? {}),
    }, ctx.timeoutMs);
    if (!res.ok) return { ok: false, error: res.error, status: res.status };
    const media = findImageDeep(res.json);
    if (!media) return { ok: false, error: "seedream returned no url or b64_json", raw: res.json };
    return { ok: true, media, raw: res.json };
  },
};

export const openaiImageAdapter: ModalityAdapter = {
  id: "image.openai",
  modality: "image",
  matches: (model) => /^(gpt-image-|dall-e)/i.test(model.trim()),
  describe: () => "POST /v1/images/generations · OpenAI pixel size · b64_json or url",
  async invoke(ctx, input): Promise<AdapterOutcome> {
    const res = await postJson(ctx.baseUrl, ctx.apiKey, "/v1/images/generations", {
      model: ctx.model,
      prompt: input.prompt,
      n: 1,
      size: input.size && /^\d+x\d+$/.test(input.size) ? input.size : "1024x1024",
      ...(input.extra ?? {}),
    }, ctx.timeoutMs);
    if (!res.ok) return { ok: false, error: res.error, status: res.status };
    const media = findImageDeep(res.json);
    if (!media) return { ok: false, error: "openai image endpoint returned no image payload", raw: res.json };
    return { ok: true, media, raw: res.json };
  },
};

export const geminiChatImageAdapter: ModalityAdapter = {
  id: "image.gemini_chat",
  modality: "image",
  // Gemini image models 404 on /v1/images/generations but answer on chat.
  matches: (model) => /^gemini-.*image/i.test(model.trim()),
  describe: () => "POST /v1/chat/completions · image returned as data URI inside message content[]",
  async invoke(ctx, input): Promise<AdapterOutcome> {
    const content: unknown[] = [{ type: "text", text: input.prompt }];
    for (const ref of input.referenceImages ?? []) content.push({ type: "image_url", image_url: { url: ref } });
    const res = await postJson(ctx.baseUrl, ctx.apiKey, "/v1/chat/completions", {
      model: ctx.model,
      messages: [{ role: "user", content: content.length === 1 ? input.prompt : content }],
      max_tokens: input.maxTokens ?? 4096,
      ...(input.extra ?? {}),
    }, ctx.timeoutMs);
    if (!res.ok) return { ok: false, error: res.error, status: res.status };
    const media = findImageDeep(res.json);
    if (!media) return { ok: false, error: "gemini chat response contained no image", raw: res.json };
    return { ok: true, media, raw: res.json };
  },
};

export const IMAGE_ADAPTERS: ModalityAdapter[] = [seedreamImageAdapter, openaiImageAdapter, geminiChatImageAdapter];
