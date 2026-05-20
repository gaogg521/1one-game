import { generateComicCover } from "@/lib/cover-generation";
import { inferStoryGenre } from "@/lib/cover-genre";
import { getNovelStyleTextModelCascade } from "@/lib/llm";
import { generateComicPages } from "@/lib/comic-pipeline";
import type { ComicStreamEmitter } from "@/lib/comic-pipeline-events";
import { formatComicConsistencyIssues } from "@/lib/comic-panel-consistency";
import { PANELS_PER_PAGE, resolveComicPageCount } from "@/lib/comic-generate-config";
import { formatComicStorageTitle } from "@/lib/comic-display";
import { renderComicPanels, serializeComicPanels } from "@/lib/comic-panel-render";
import {
  extractNovelTitleFromContent,
  normalizeNovelTitle,
  validateNovelTitleInput,
} from "@/lib/novel-display";
import { parseNovelLengthTier } from "@/lib/novel-length";
import { persistNovelLengthTier } from "@/lib/novel-length-tier-db";
import { loadNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import {
  extractComicCreativePitch,
  resolveMediaCreativeBrief,
} from "@/lib/creative-brief/resolve-media-brief";
import { parseNovelCreativeBrief, type NovelBriefUserRevision, type NovelCreativeBrief } from "@/lib/literary-brief";
import {
  saveComicCreativeBriefJson,
  serializeComicCreativeBrief,
} from "@/lib/comic-creative-brief-db";
import {
  saveNovelCreativeBriefJson,
  serializeNovelCreativeBrief,
} from "@/lib/novel-creative-brief-db";
import { prisma } from "@/lib/prisma";
import { PRODUCT } from "@/lib/product-config";

export type ComicGenerateRunInput = {
  ownerKey: string;
  novelId?: string;
  content?: string;
  /** 一句话漫画创意（全文粘贴时可单独填写；不填则从短文或首段提取） */
  creativePrompt?: string;
  /** 客户端已预览的 Brief，避免重复 LLM 扩写 */
  creativeBrief?: NovelCreativeBrief;
  briefRevision?: NovelBriefUserRevision;
  title?: string;
  pageCount?: number;
  lengthTier?: string;
};

export type ComicGenerateRunResult = {
  comicId: string;
  pageCount: number;
  panelCount: number;
  panelsRendered: number;
  pipeline: string;
  needsPanelRender: boolean;
  imagesWarning?: string;
  consistencyWarnings?: string;
  provider: string;
  model: string;
  imageSource: string;
};

export async function resolveComicGenerateNovel(
  input: ComicGenerateRunInput,
): Promise<{
  novelTitle: string;
  novelContent: string;
  novelSummary: string;
  novelPrompt: string;
  actualNovelId: string;
  novelLengthTier: ReturnType<typeof parseNovelLengthTier>;
  novelMeta: Awaited<ReturnType<typeof loadNovelGenerationMeta>>;
}> {
  let novelTitle = input.title?.trim() || "未命名小说";
  let novelContent = "";
  let novelSummary = "";
  let novelPrompt = "";
  let actualNovelId = input.novelId;
  let novelLengthTier = parseNovelLengthTier(input.lengthTier);
  let novelMeta = null;

  if (actualNovelId) {
    const novel = await prisma.novel.findUnique({ where: { id: actualNovelId } });
    if (!novel) throw new Error("小说不存在");
    if (novel.ownerKey !== input.ownerKey) throw new Error("无权为此小说生成漫画");
    novelContent = novel.content;
    novelSummary = novel.summary ?? "";
    novelPrompt = novel.prompt ?? "";
    novelTitle = normalizeNovelTitle(novel.title, novel.prompt);
    if (novel.lengthTier) novelLengthTier = parseNovelLengthTier(novel.lengthTier);
    novelMeta = await loadNovelGenerationMeta(actualNovelId);
  } else if (input.content?.trim()) {
    novelContent = input.content.trim();
    if (input.title?.trim()) {
      const tv = validateNovelTitleInput(input.title.trim());
      novelTitle = tv.ok
        ? tv.value
        : normalizeNovelTitle(input.title.trim(), novelContent.slice(0, 500));
    } else {
      novelTitle = extractNovelTitleFromContent(novelContent, undefined, novelContent.slice(0, 500));
    }
    const pitchForStore = extractComicCreativePitch(novelContent, input.creativePrompt).slice(0, 400);
    const novel = await prisma.novel.create({
      data: {
        ownerKey: input.ownerKey,
        title: novelTitle,
        prompt: pitchForStore,
        content: novelContent,
        summary: novelContent.slice(0, 300).replace(/\n/g, " ").slice(0, 200) + "…",
        status: "ready",
      },
    });
    await persistNovelLengthTier(novel.id, novelLengthTier);
    actualNovelId = novel.id;
  } else {
    throw new Error("请提供 novelId 或直接粘贴小说内容");
  }

  return {
    novelTitle,
    novelContent,
    novelSummary,
    novelPrompt,
    actualNovelId: actualNovelId!,
    novelLengthTier,
    novelMeta,
  };
}

export async function runComicGeneration(
  input: ComicGenerateRunInput,
  emit?: ComicStreamEmitter,
): Promise<ComicGenerateRunResult> {
  const send = emit ?? (() => {});

  const resolved = await resolveComicGenerateNovel(input);
  let {
    novelTitle,
    novelContent,
    novelSummary,
    novelPrompt,
    actualNovelId,
    novelLengthTier,
    novelMeta,
  } = resolved;

  const creativePitch = extractComicCreativePitch(
    novelContent,
    input.creativePrompt ?? (novelPrompt.trim().length >= 2 ? novelPrompt : undefined),
  );
  let comicBriefToPersist: NovelCreativeBrief | null = null;
  if (PRODUCT.comic.creativeBriefExpand && creativePitch.length >= 2) {
    const preParsed = input.creativeBrief ? parseNovelCreativeBrief(input.creativeBrief) : null;
    const briefResult = await resolveMediaCreativeBrief(creativePitch, "comic", {
      preExpanded: preParsed ?? undefined,
      userRevision: input.briefRevision ?? undefined,
    });
    if (briefResult) {
      comicBriefToPersist = briefResult.brief;
      send({
        step: "brief",
        summary: briefResult.oneLineSummary,
        brief: briefResult.brief,
      });
      novelPrompt = briefResult.augmentedPrompt;
    }
  }

  const pageCount = resolveComicPageCount({
    lengthTier: novelLengthTier,
    pageCount: input.pageCount,
    contentLength: novelContent.length,
  });
  const storyGenre = inferStoryGenre({
    title: novelTitle,
    summary: novelSummary,
    prompt: novelPrompt,
    contentSnippet: novelContent.slice(0, 1200),
  });

  send({
    step: "start",
    message: `开始改编漫画，共 ${pageCount} 页（每页 ${PANELS_PER_PAGE} 格）…`,
    pageCount,
  });

  const cascade = getNovelStyleTextModelCascade();
  let gen = null as Awaited<ReturnType<typeof generateComicPages>> | null;
  let lastError = "";

  for (const model of cascade) {
    send({ step: "model_start", model });
    try {
      gen = await generateComicPages({
        cascade,
        novelTitle,
        novelPrompt,
        novelSummary,
        novelContent,
        pageCount,
        storyGenre,
        lengthTier: novelLengthTier,
        novelMeta,
        model,
        emit: send,
      });
      break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      send({ step: "model_error", model, message: lastError });
    }
  }

  if (!gen) {
    throw new Error(lastError || "漫画分镜生成失败");
  }

  const pages = gen.pages;
  const panelCount = pages.reduce((n, p) => n + p.panels.length, 0);
  if (pages.length < 1 || panelCount < PANELS_PER_PAGE) {
    throw new Error("漫画分镜提取失败（模型未返回有效分镜）");
  }

  const comicDoc = {
    formatVersion: gen.director ? 3 : 2,
    pageCount: pages.length,
    pages,
    ...(gen.director ? { director: gen.director, pipeline: gen.pipeline } : {}),
  };

  const skipInlinePanels = panelCount > PANELS_PER_PAGE;
  let rendered = 0;
  let imageSource = "none";

  if (!skipInlinePanels) {
    send({ step: "panels_render_start", message: `正在生成 ${panelCount} 格配图…`, panelCount });
    const renderResult = await renderComicPanels(comicDoc, {
      onlyMissing: false,
      storyGenre,
      storyContext: {
        title: novelTitle,
        summary: novelSummary || novelContent.slice(0, 400).replace(/\n/g, " "),
      },
      skipStyleRefs: true,
      director: gen.director,
      onProgress: (ev) => {
        if (ev.type === "panel_start") {
          send({
            step: "panels_render_progress",
            index: ev.index,
            total: ev.total,
            message: `配图 ${ev.index}/${ev.total}…`,
          });
        }
        if (ev.type === "panel_done") {
          send({
            step: "panels_render_progress",
            index: ev.index,
            total: ev.total,
            ok: ev.ok,
            withImage: ev.withImage,
            message: ev.ok ? `已完成 ${ev.withImage}/${ev.total} 格` : ev.error,
          });
        }
      },
    });
    Object.assign(comicDoc, renderResult.doc);
    rendered = renderResult.rendered;
    imageSource = renderResult.imageSource;
  } else {
    send({
      step: "panels_render_start",
      message: `分镜已就绪（${panelCount} 格），将跳转漫画页批量配图…`,
      panelCount,
      deferred: true,
    });
  }

  send({ step: "save_start", message: "正在保存漫画…" });
  const imageUrls = serializeComicPanels(comicDoc);
  const storageTitle = formatComicStorageTitle(novelTitle, novelContent.slice(0, 300));

  const comic = await prisma.comic.create({
    data: {
      ownerKey: input.ownerKey,
      novelId: actualNovelId,
      title: storageTitle,
      prompt: novelContent.slice(0, 200),
      imageUrls,
      status: rendered > 0 ? "ready" : "pending_images",
    },
  });

  if (comicBriefToPersist) {
    const json = serializeComicCreativeBrief(comicBriefToPersist);
    await saveComicCreativeBriefJson(comic.id, json);
    await saveNovelCreativeBriefJson(actualNovelId, serializeNovelCreativeBrief(comicBriefToPersist));
  }

  send({ step: "cover_start", message: "封面将在后台生成…" });
  void generateComicCover(
    comic.id,
    storageTitle,
    novelSummary || novelContent.slice(0, 400).replace(/\n/g, " "),
    novelContent.slice(0, 800),
    storyGenre,
  ).catch(() => {});

  const consistencyNote =
    gen.consistencyIssues.length > 0
      ? formatComicConsistencyIssues(gen.consistencyIssues)
      : undefined;

  const needsPanelRender = skipInlinePanels || rendered < panelCount;
  const imagesWarning = needsPanelRender
    ? "部分或全部分镜需在漫画页点击「生成配图」"
    : undefined;

  return {
    comicId: comic.id,
    pageCount: pages.length,
    panelCount,
    panelsRendered: rendered,
    pipeline: gen.pipeline,
    needsPanelRender,
    imagesWarning,
    consistencyWarnings: consistencyNote,
    provider: gen.provider,
    model: gen.model,
    imageSource,
  };
}
