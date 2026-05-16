/**
 * 文生图：模型与默认分辨率见 `src/lib/model-config.ts`（`IMAGE_GEN_*` / `GEMINI_IMAGE_MODEL`）。
 */

import { getImageGenDefaultSize, getImageGenGeminiModel, getImageGenOpenAIModel } from "@/lib/model-config";
import { createOpenAIClient } from "@/lib/openai-client";
import fs from "fs";
import path from "path";

export interface ImageGenResult {
  url: string;
  localPath?: string;
}

/**
 * 使用 OpenAI 兼容网关生成图片（`IMAGE_GEN_OPENAI_MODEL`）；失败则由上层降级 Gemini。
 */
function imageItemToResult(item: { url?: string | null; b64_json?: string | null } | undefined): ImageGenResult | null {
  if (!item) return null;
  if (item.url) return { url: item.url };
  if (item.b64_json) {
    const buf = Buffer.from(item.b64_json, "base64");
    const filename = `openai-${Date.now()}.png`;
    const dir = path.join(process.cwd(), "public", "covers");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const localPath = path.join(dir, filename);
    fs.writeFileSync(localPath, buf);
    return { url: `/covers/${filename}`, localPath };
  }
  return null;
}

/**
 * LiteLLM / gpt-image-2 等网关常不支持 `response_format`、`quality`；按多种参数组合尝试。
 */
export async function generateImageWithOpenAI(
  prompt: string,
  options?: { size?: "1024x1024" | "1024x1536" | "1536x1024"; quality?: "standard" | "high"; n?: number }
): Promise<ImageGenResult | null> {
  const client = createOpenAIClient();
  const model = getImageGenOpenAIModel();
  const size = options?.size ?? getImageGenDefaultSize();
  const n = options?.n ?? 1;

  // 多数 LiteLLM / gpt-image-2 网关：默认返回 b64_json，且不支持 response_format / quality
  const attempts: Record<string, unknown>[] = [{ model, prompt, size, n }];
  if (options?.quality) {
    attempts.push({ model, prompt, size, n, quality: options.quality });
  }

  for (const body of attempts) {
    try {
      const response = await client.images.generate(
        body as unknown as Parameters<typeof client.images.generate>[0],
      );
      if (!("data" in response) || !response.data?.length) continue;
      const hit = imageItemToResult(response.data[0]);
      if (hit) return hit;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * 使用 Gemini Flash Image 生成图片（备选路径）。
 * 需要 GEMINI_API_KEY 环境变量。
 */
export async function generateImageWithGemini(
  prompt: string,
  options?: { size?: string }
): Promise<ImageGenResult | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  try {
    const size = options?.size ?? getImageGenDefaultSize();
    const geminiModel = getImageGenGeminiModel();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) return null;

    // 保存到 public/comics/
    const buf = Buffer.from(imagePart.inlineData.data, "base64");
    const filename = `gemini-${Date.now()}.png`;
    const dir = path.join(process.cwd(), "public", "comics");
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
export async function generateImage(
  prompt: string,
  options?: { size?: "1024x1024" | "1024x1536" | "1536x1024"; quality?: "standard" | "high" }
): Promise<ImageGenResult | null> {
  // 优先 OpenAI
  const openaiResult = await generateImageWithOpenAI(prompt, options);
  if (openaiResult) return openaiResult;

  // 备选 Gemini
  return generateImageWithGemini(prompt, { size: options?.size });
}
