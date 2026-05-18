import { generateComicCover } from "@/lib/cover-generation";
import { inferStoryGenre } from "@/lib/cover-genre";
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
import {
  buildComicJsonSchema,
  buildComicSystemPrompt,
  defaultPanelPrompt,
  resolveComicPageCount,
  PANELS_PER_PAGE,
  normalizeComicPagesForGeneration,
} from "@/lib/comic-generate-config";
import { formatComicStorageTitle } from "@/lib/comic-display";
import { renderComicPanels, serializeComicPanels } from "@/lib/comic-panel-render";
import {
  extractNovelTitleFromContent,
  normalizeNovelTitle,
  validateNovelTitleInput,
} from "@/lib/novel-display";
import { parseNovelLengthTier } from "@/lib/novel-length";
import { persistNovelLengthTier } from "@/lib/novel-length-tier-db";
import type { ComicPage } from "@/lib/comic-format";

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
  let novelSummary = "";
  let novelPrompt = "";
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
    novelContent = novel.content;
    novelSummary = novel.summary ?? "";
    novelPrompt = novel.prompt ?? "";
    novelTitle = normalizeNovelTitle(novel.title, novel.prompt);
    if (novel.lengthTier) novelLengthTier = parseNovelLengthTier(novel.lengthTier);
  } else if (content && typeof content === "string" && content.trim().length > 0) {
    novelContent = content.trim();
    if (title?.trim()) {
      const tv = validateNovelTitleInput(title.trim());
      novelTitle = tv.ok
        ? tv.value
        : normalizeNovelTitle(title.trim(), novelContent.slice(0, 500));
    } else {
      novelTitle = extractNovelTitleFromContent(
        novelContent,
        undefined,
        novelContent.slice(0, 500),
      );
    }

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
    await persistNovelLengthTier(novel.id, novelLengthTier);
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
  const storyGenre = inferStoryGenre({
    title: novelTitle,
    summary: novelSummary,
    prompt: novelPrompt,
    contentSnippet: novelContent.slice(0, 1200),
  });

  const CHUNK_SIZE = 4; // 每次最多生成 4 页，避免大 JSON Schema 超时

  try {
    const cascade = getNovelStyleTextModelCascade();
    let pages: ComicPage[] = [];
    let providerUsed = "";
    let modelUsed = "";

    const contentSnippet = novelContent.slice(0, 12000);

    // 分段生成：每 CHUNK_SIZE 页一批，合并结果
    const chunkCount = Math.ceil(pageCount / CHUNK_SIZE);
    for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
      const chunkStart = chunkIdx * CHUNK_SIZE + 1; // 1-indexed
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, pageCount);
      const chunkPages = chunkEnd - chunkStart + 1;
      const chunkPanels = chunkPages * PANELS_PER_PAGE;

      const comicSystem = buildComicSystemPrompt(chunkPages, storyGenre);
      const comicSchema = buildComicJsonSchema(chunkPages);

      let chunkResult: ComicPage[] = [];
      for (const model of cascade) {
        const result = await llmJson({
          model,
          system: comicSystem,
          user: `请为以下小说改编漫画，输出第 ${chunkStart}～${chunkEnd} 页（共 ${chunkPages} 页，每页 4 格，共 ${chunkPanels} 格）。\n全书共 ${pageCount} 页，请按比例推进剧情（第 ${chunkStart} 页对应故事进度约 ${Math.round((chunkStart - 1) / pageCount * 100)}%）。格与格之间连贯。\n\n小说标题：${novelTitle}\n\n小说正文（节选）：\n${contentSnippet}\n\n请输出 JSON，根对象包含长度为 ${chunkPages} 的 "pages" 数组。`,
          jsonSchema: comicSchema,
          temperature: 0.8,
          mode: "json_schema",
          timeoutMs: Math.min(120_000, 30_000 + chunkPages * 10_000),
        });
        if (result.ok && result.raw && typeof result.raw === "object" && "pages" in result.raw) {
          const rawPages = (result.raw as { pages: ComicPage[] }).pages;
          if (!Array.isArray(rawPages) || rawPages.length < 1) continue;

          chunkResult = normalizeComicPagesForGeneration(rawPages, chunkPages, storyGenre);
          if (chunkResult.length < 1) continue;

          if (!providerUsed) {
            providerUsed = result.provider;
            modelUsed = result.model;
          }
          break;
        }
      }

      if (chunkResult.length < 1) {
        // 某段失败：用占位页填充，不中断整体
        for (let i = chunkStart; i <= chunkEnd; i++) {
          chunkResult.push({
            page: i,
            panels: Array.from({ length: PANELS_PER_PAGE }, (_, j) => ({
              scene: (i - 1) * PANELS_PER_PAGE + j + 1,
              caption: "……",
              prompt: defaultPanelPrompt(storyGenre),
            })),
          });
        }
      }

      // 修正 page 编号为全局序号
      for (let i = 0; i < chunkResult.length; i++) {
        chunkResult[i] = { ...chunkResult[i]!, page: chunkStart + i };
      }
      pages.push(...chunkResult);
    }

    const panelCount = pages.reduce((n, p) => n + p.panels.length, 0);
    if (pages.length < 1 || panelCount < PANELS_PER_PAGE) {
      return NextResponse.json(
        { error: "漫画分镜提取失败（模型未返回有效分镜）", code: codes.LLM_FAILED, requestId },
        { status: 502, headers: ridHeaders(requestId) },
      );
    }

    const comicDoc = {
      formatVersion: 2,
      pageCount: pages.length,
      pages,
    };
    const skipInlinePanels = panelCount > PANELS_PER_PAGE;
    const { doc: docWithImages, rendered, imageSource } = skipInlinePanels
      ? { doc: comicDoc, rendered: 0, imageSource: "none" as const }
      : await renderComicPanels(comicDoc, {
          onlyMissing: false,
          storyGenre,
          storyContext: {
            title: novelTitle,
            summary: novelSummary || novelContent.slice(0, 400).replace(/\n/g, " "),
          },
          skipStyleRefs: true,
        });
    const imageUrls = serializeComicPanels(docWithImages);
    const storageTitle = formatComicStorageTitle(novelTitle, novelContent.slice(0, 300));

    const comic = await prisma.comic.create({
      data: {
        ownerKey,
        novelId: actualNovelId!,
        title: storageTitle,
        prompt: novelContent.slice(0, 200),
        imageUrls,
        status: rendered > 0 ? "ready" : "pending_images",
      },
    });

    void generateComicCover(
      comic.id,
      storageTitle,
      novelSummary || novelContent.slice(0, 400).replace(/\n/g, " "),
      novelContent.slice(0, 800),
      storyGenre,
    ).catch(() => {});
    // 漫画生成不得写入或覆盖 Novel.coverPath（见 composeAndPersistNovelCoverFromBackground 都市保护）

    return NextResponse.json(
      {
        ok: true,
        comic,
        pages,
        pageCount: pages.length,
        panelCount,
        panelsRendered: rendered,
        provider: providerUsed,
        model: modelUsed,
        imageSource,
        imagesWarning:
          rendered < panelCount
            ? "部分分镜配图未生成，可在漫画页点击「生成配图」重试"
            : undefined,
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
