import { generateComicCover } from "@/lib/cover-generation";
import { NextResponse } from "next/server";
import { generationErrorCodes } from "@/lib/api/json-error-response";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { newGenerateRequestId, ridHeaders } from "@/lib/api/request-id";
import { readLimitedJson } from "@/lib/api/read-json-body";
import { llmJson, getNovelStyleTextModelCascade } from "@/lib/llm";
import { getOwnerKey } from "@/lib/owner";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { prisma } from "@/lib/prisma";
import { generateComfyImages, comfyImageUrl } from "@/lib/comfy-image-gen";
import { generateImage } from "@/lib/image-generation";
import { getComfyBaseUrl } from "@/lib/orchestration/comfy-gateway";
import {
  buildComicJsonSchema,
  buildComicSystemPrompt,
  resolveComicPageCount,
  PANELS_PER_PAGE,
  normalizeComicPagesForGeneration,
} from "@/lib/comic-generate-config";
import { parseNovelLengthTier } from "@/lib/novel-length";
import type { ComicPage } from "@/lib/comic-format";
import { serializeComicDocument } from "@/lib/comic-format";

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]!, i);
    }
  }
  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

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

  const { novelId, content, title, pageCount: pageCountRaw, lengthTier: lengthTierRaw } = json.body as {
    novelId?: string;
    content?: string;
    title?: string;
    pageCount?: number;
    lengthTier?: string;
  };

  let novelTitle = title?.trim() || "未命名小说";
  let novelContent = "";
  let actualNovelId = novelId;
  let novelLengthTier = parseNovelLengthTier(lengthTierRaw);

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
    if (novel.lengthTier) novelLengthTier = parseNovelLengthTier(novel.lengthTier);
  } else if (content && typeof content === "string" && content.trim().length > 0) {
    novelContent = content.trim();
    const firstLine = novelContent.split("\n")[0].replace(/^#+\s*/, "").slice(0, 80);
    if (firstLine && firstLine.length > 3) novelTitle = firstLine;

    const novel = await prisma.novel.create({
      data: {
        ownerKey,
        title: novelTitle,
        prompt: novelContent.slice(0, 200),
        content: novelContent,
        summary: novelContent.slice(0, 300).replace(/\n/g, " ").slice(0, 200) + "…",
        lengthTier: novelLengthTier,
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

  const pageCount = resolveComicPageCount({
    lengthTier: novelLengthTier,
    pageCount: pageCountRaw,
    contentLength: novelContent.length,
  });
  const totalPanels = pageCount * PANELS_PER_PAGE;

  try {
    const cascade = getNovelStyleTextModelCascade();
    let pages: ComicPage[] = [];
    let providerUsed = "";
    let modelUsed = "";

    const comicSystem = buildComicSystemPrompt(pageCount);
    const comicSchema = buildComicJsonSchema(pageCount);
    const contentSnippet = novelContent.slice(0, 12000);

    for (const model of cascade) {
      const result = await llmJson({
        model,
        system: comicSystem,
        user: `请为以下小说改编 **${pageCount} 页**漫画（每页 4 格，共 ${totalPanels} 格）。按页推进剧情，格与格之间连贯。\n\n小说标题：${novelTitle}\n\n小说正文（节选）：\n${contentSnippet}\n\n请输出 JSON，根对象包含长度为 ${pageCount} 的 "pages" 数组。`,
        jsonSchema: comicSchema,
        temperature: 0.8,
        mode: "json_schema",
        timeoutMs: Math.min(180_000, 30_000 + pageCount * 8_000),
      });
      if (result.ok && result.raw && typeof result.raw === "object" && "pages" in result.raw) {
        const rawPages = (result.raw as { pages: ComicPage[] }).pages;
        if (!Array.isArray(rawPages) || rawPages.length < 1) continue;

        pages = normalizeComicPagesForGeneration(rawPages, pageCount);
        if (pages.length < 1) continue;

        providerUsed = result.provider;
        modelUsed = result.model;
        break;
      }
    }

    const panelCount = pages.reduce((n, p) => n + p.panels.length, 0);
    if (pages.length < 1 || panelCount < PANELS_PER_PAGE) {
      return NextResponse.json(
        { error: "漫画分镜提取失败（模型未返回有效分镜）", code: codes.LLM_FAILED, requestId },
        { status: 502, headers: ridHeaders(requestId) },
      );
    }

    const flatPrompts = pages.flatMap((pg) =>
      pg.panels.map((p) => ({ caption: p.caption, prompt: p.prompt })),
    );

    const comfyBase = getComfyBaseUrl();
    let imageSource = "none";

    if (comfyBase) {
      const comfyImages = await generateComfyImages(flatPrompts.map((p) => p.prompt));
      if (comfyImages.length > 0) {
        let idx = 0;
        for (const pg of pages) {
          for (const panel of pg.panels) {
            const img = comfyImages[idx];
            if (img) panel.imageUrl = comfyImageUrl(comfyBase, img);
            idx += 1;
          }
        }
        imageSource = "comfy";
      }
    }

    if (imageSource === "none") {
      const generated = await mapWithConcurrency(flatPrompts, 2, async (p) => {
        const result = await generateImage(p.prompt, { size: "1024x1024", quality: "standard" });
        return { ...p, imageUrl: result?.url };
      });
      let idx = 0;
      for (const pg of pages) {
        for (const panel of pg.panels) {
          const g = generated[idx++];
          if (g?.imageUrl) panel.imageUrl = g.imageUrl;
        }
      }
      if (generated.some((g) => g.imageUrl)) imageSource = "openai";
    }

    const imageUrls = serializeComicDocument({
      formatVersion: 2,
      pageCount: pages.length,
      pages,
    });

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

    void generateComicCover(comic.id, `${novelTitle} · 漫画版`, novelContent.slice(0, 200)).catch(() => {});

    return NextResponse.json(
      {
        ok: true,
        comic,
        pages,
        pageCount: pages.length,
        panelCount,
        provider: providerUsed,
        model: modelUsed,
        comfyUsed: !!comfyBase,
        imageSource,
      },
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
