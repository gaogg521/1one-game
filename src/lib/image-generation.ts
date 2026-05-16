/**
 * 文生图服务：优先 gpt-image-2，备选 gemini-3.1-flash-image-preview
 * 1K 分辨率（1024x1024）
 */

import { createOpenAIClient } from "@/lib/openai-client";
import fs from "fs";
import path from "path";

export interface ImageGenResult {
  url: string;
  localPath?: string;
}

const FALLBACK_MODELS = ["gpt-image-2", "gpt-image-1", "dall-e-3"];

/**
 * 使用 OpenAI 兼容网关生成图片。
 * 优先尝试 gpt-image-2，失败后降级到 dall-e-3。
 */
export async function generateImageWithOpenAI(
  prompt: string,
  options?: { size?: "1024x1024" | "1024x1536" | "1536x1024"; quality?: "standard" | "high"; n?: number }
): Promise<ImageGenResult | null> {
  try {
    const client = createOpenAIClient();
    const size = options?.size ?? "1024x1024";
    const quality = options?.quality ?? "standard";
    const n = options?.n ?? 1;

    for (const model of FALLBACK_MODELS) {
      try {
        const response = await client.images.generate({
          model,
          prompt,
          size,
          quality,
          n,
          response_format: "url",
        });

        const url = response.data?.[0]?.url;
        if (url) {
          return { url };
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
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
    const size = options?.size ?? "1024x1024";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${key}`,
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
