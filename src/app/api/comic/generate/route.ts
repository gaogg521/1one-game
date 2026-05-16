import { generateComicCover } from "@/lib/cover-generation";
import { NextResponse } from "next/server";
import { generationErrorCodes } from "@/lib/api/json-error-response";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { llmJson, getProviderModelCascade } from "@/lib/llm";
import { getOwnerKey } from "@/lib/owner";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { prisma } from "@/lib/prisma";
import { generateComfyImages, comfyImageUrl } from "@/lib/comfy-image-gen";
import { generateImage } from "@/lib/image-generation";
import { getComfyBaseUrl } from "@/lib/orchestration/comfy-gateway";
import fs from "fs";
import path from "path";

const COMIC_SYSTEM = `你是一位擅长漫画分镜的 AI 艺术家。用户会提供一篇小说或故事文本，你需要从中提取 4 个最具视觉张力的场景，并为每个场景写出详细的图像生成提示词（英文，便于 Stable Diffusion / ComfyUI 使用）。

要求：
1. 只输出 JSON 对象，不要 markdown 代码块
2. 根对象有一个 "panels" 数组，包含 4 个元素
3. 每个元素包含：
   - "scene": 场景编号 1-4
   - "caption": 中文场景说明（20 字以内）
   - "prompt": 英文图像生成提示词（80-150 词），包含风格、角色、动作、环境、光照、氛围
4. 4 个场景应该覆盖故事的起、承、转、合
5. 风格统一：建议日式漫画 / 美漫 / 国漫风格中选一种并贯穿
6. 角色一致性：同一角色在不同场景中的外貌、服装保持一致`;

const COMIC_SCHEMA = {
  name: "comic_panels",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      panels: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            scene: { type: "integer" },
            caption: { type: "string" },
            prompt: { type: "string" },
          },
          required: ["scene", "caption", "prompt"],
        },
      },
    },
    required: ["panels"],
  },
};

export async function POST(req: Request) {
  const codes = generationErrorCodes();
  const requestId = newGenerateRequestId();
  const rl = generateRateLimits();
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("comic_gen", ownerKey);
  if (!rateLimit(throttleKey, rl.postMax, rl.windowMs)) {
    return NextResponse.json(
      { error: "生成次数过多，请稍后再试", code: codes.RATE_LIMITED, requestId },
      { status: 429, headers: ridHeaders(requestId) },
    );
  }

  const json = await readLimitedJson(req, requestId);
  if (!json.ok) {
    return NextResponse.json(json.payload, { status: json.status, headers: ridHeaders(requestId) });
  }

  const { novelId, content, title } = json.body as { novelId?: string; content?: string; title?: string };

  let novelTitle = title?.trim() || "未命名小说";
  let novelContent = "";
  let actualNovelId = novelId;

  // 模式 1：用户提供已有 novelId
  if (actualNovelId) {
    const novel = await prisma.novel.findUnique({ where: { id: actualNovelId } });
    if (!novel) {
      return NextResponse.json(
        { error: "小说不存在", code: codes.BAD_REQUEST, requestId },
        { status: 404, headers: ridHeaders(requestId) },
      );
    }
    if (novel.ownerKey !== ownerKey) {
      return NextResponse.json(
        { error: "无权为此小说生成漫画", code: codes.UNAUTHORIZED, requestId },
        { status: 403, headers: ridHeaders(requestId) },
      );
    }
    novelTitle = novel.title;
    novelContent = novel.content;
  }
  // 模式 2：用户直接粘贴文本内容
  else if (content && typeof content === "string" && content.trim().length > 0) {
    novelContent = content.trim();
    // 自动提取标题（第一行）
    const firstLine = novelContent.split("\n")[0].replace(/^#+\s*/, "").slice(0, 80);
    if (firstLine && firstLine.length > 3) novelTitle = firstLine;

    // 先存入 Novel（便于后续管理和关联）
    const novel = await prisma.novel.create({
      data: {
        ownerKey,
        title: novelTitle,
        prompt: novelContent.slice(0, 200),
        content: novelContent,
        summary: novelContent.slice(0, 300).replace(/\n/g, " ").slice(0, 200) + "…",
        status: "ready",
      },
    });
    actualNovelId = novel.id;
  } else {
    return NextResponse.json(
      { error: "请提供 novelId 或直接粘贴小说内容", code: codes.BAD_REQUEST, requestId },
      { status: 400, headers: ridHeaders(requestId) },
    );
  }

  try {
    const cascade = getProviderModelCascade();
    let panels: { scene: number; caption: string; prompt: string }[] = [];
    let providerUsed = "";
    let modelUsed = "";

    for (const model of cascade) {
      const result = await llmJson({
        model,
        system: COMIC_SYSTEM,
        user: `请为以下小说提取 4 个漫画场景：\n\n小说标题：${novelTitle}\n\n小说内容摘要：\n${novelContent.slice(0, 4000)}\n\n请输出 4 个场景的 JSON 对象，根对象包含 "panels" 数组。`,
        jsonSchema: COMIC_SCHEMA,
        temperature: 0.8,
        mode: "json_schema",
        timeoutMs: 60_000,
      });
      // LlmJsonResult 只有 raw 字段，没有 parsed
      if (result.ok && result.raw && typeof result.raw === "object" && "panels" in result.raw) {
        panels = (result.raw as { panels: typeof panels }).panels;
        providerUsed = result.provider;
        modelUsed = result.model;
        break;
      }
    }

    if (panels.length < 4) {
      return NextResponse.json(
        { error: "漫画场景提取失败", code: codes.LLM_FAILED, requestId },
        { status: 502, headers: ridHeaders(requestId) },
      );
    }

    // 尝试调用 ComfyUI 生成 4 张图片
    let imageResults: { caption: string; prompt: string; imageUrl?: string }[] = panels.map((p) => ({
      caption: p.caption,
      prompt: p.prompt,
    }));

    const comfyBase = getComfyBaseUrl();
    let imageSource = "none";

    if (comfyBase) {
      const comfyImages = await generateComfyImages(panels.map((p) => p.prompt));
      if (comfyImages.length > 0) {
        imageResults = panels.map((p, i) => ({
          caption: p.caption,
          prompt: p.prompt,
          imageUrl: comfyImages[i] ? comfyImageUrl(comfyBase, comfyImages[i]) : undefined,
        }));
        imageSource = "comfy";
      }
    }

    // 若 ComfyUI 未配置或失败，尝试 OpenAI / Gemini 文生图
    if (imageSource === "none") {
      const generated: { caption: string; prompt: string; imageUrl?: string }[] = [];
      for (const p of panels) {
        const result = await generateImage(p.prompt, { size: "1024x1024", quality: "standard" });
        if (result?.url) {
          generated.push({ caption: p.caption, prompt: p.prompt, imageUrl: result.url });
        } else {
          generated.push({ caption: p.caption, prompt: p.prompt });
        }
      }
      if (generated.some((g) => g.imageUrl)) {
        imageResults = generated;
        imageSource = "openai";
      }
    }

    const imageUrls = JSON.stringify(imageResults);

    const comic = await prisma.comic.create({
      data: {
        ownerKey,
        novelId: actualNovelId!,
        title: `${novelTitle} · 漫画版`,
        prompt: novelContent.slice(0, 200),
        imageUrls,
        status: "ready",
      },
    });

    // Fire-and-forget cover generation
    void generateComicCover(comic.id, `${novelTitle} · 漫画版`, novelContent.slice(0, 200)).catch(() => {});

    return NextResponse.json(
      { ok: true, comic, panels: imageResults, provider: providerUsed, model: modelUsed, comfyUsed: !!comfyBase },
      { headers: ridHeaders(requestId) },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, code: codes.LLM_FAILED, requestId },
      { status: 502, headers: ridHeaders(requestId) },
    );
  }
}
