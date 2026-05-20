import type { ComicPage } from "@/lib/comic-format";
import type { CoverGenre } from "@/lib/cover-genre";
import {
  buildComicJsonSchema,
  buildComicSystemPrompt,
  defaultPanelPrompt,
  normalizeComicPagesForGeneration,
  PANELS_PER_PAGE,
  shouldUseLongComicPipeline,
} from "@/lib/comic-generate-config";
import { fetchComicDirectorPack } from "@/lib/comic-director";
import type { ComicDirectorPack } from "@/lib/comic-director-types";
import {
  checkComicPanelsConsistency,
  formatComicConsistencyIssues,
  type ComicConsistencyIssue,
} from "@/lib/comic-panel-consistency";
import type { ComicStreamEmitter } from "@/lib/comic-pipeline-events";
import { applyShotPlanToPages } from "@/lib/comic-shot-plan";
import { fetchComicStoryboardChunk } from "@/lib/comic-storyboard-long";
import { llmJson } from "@/lib/llm";
import { PRODUCT } from "@/lib/product-config";
import type { NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import type { NovelLengthTier } from "@/lib/novel-length";

export type { ComicStreamEmitter } from "@/lib/comic-pipeline-events";

export type ComicPagesGenerateResult = {
  pages: ComicPage[];
  pipeline: "long_director" | "light";
  director: ComicDirectorPack | null;
  provider: string;
  model: string;
  consistencyIssues: ComicConsistencyIssue[];
};

/** 按页码进度截取正文，并附上 Brief/简介，避免多批分镜都只读开头。 */
function buildLightStoryboardSource(opts: {
  novelContent: string;
  novelPrompt: string;
  novelSummary: string;
  chunkStart: number;
  pageCount: number;
  maxChars: number;
}): string {
  const headerParts: string[] = [];
  const prompt = opts.novelPrompt.trim();
  const summary = opts.novelSummary.trim();
  if (prompt.length >= 2) {
    headerParts.push(`改编要点 / 创意构思：\n${prompt.slice(0, 4000)}`);
  }
  if (summary.length >= 2) {
    headerParts.push(`故事简介：\n${summary.slice(0, 1200)}`);
  }
  const header = headerParts.join("\n\n");
  const bodyBudget = Math.max(2500, opts.maxChars - header.length - 80);
  const progress = (opts.chunkStart - 1) / Math.max(1, opts.pageCount);
  const start = Math.floor(progress * opts.novelContent.length);
  let body = opts.novelContent.slice(start, start + bodyBudget);
  if (start > 0) {
    const nl = body.indexOf("\n");
    if (nl > 0 && nl < 240) body = body.slice(nl + 1);
  }
  if (!header) return body;
  return `${header}\n\n小说正文（本段节选）：\n${body}`;
}

async function generateComicPagesLight(params: {
  model: string;
  novelTitle: string;
  novelContent: string;
  novelPrompt: string;
  novelSummary: string;
  pageCount: number;
  storyGenre: CoverGenre;
  emit?: ComicStreamEmitter;
}): Promise<{ pages: ComicPage[]; provider: string; model: string }> {
  const { model, novelTitle, novelContent, novelPrompt, novelSummary, pageCount, storyGenre, emit } =
    params;
  const send = emit ?? (() => {});
  const CHUNK_SIZE = PRODUCT.comic.storyboardChunkPages;
  let pages: ComicPage[] = [];
  let providerUsed = "";
  let modelUsed = model;

  const chunkCount = Math.ceil(pageCount / CHUNK_SIZE);
  for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
    const chunkStart = chunkIdx * CHUNK_SIZE + 1;
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, pageCount);
    const chunkPages = chunkEnd - chunkStart + 1;
    const chunkPanels = chunkPages * PANELS_PER_PAGE;

    send({
      step: "light_chunk_start",
      index: chunkIdx + 1,
      total: chunkCount,
      chunkStart,
      chunkEnd,
      message: `轻量分镜 第 ${chunkIdx + 1}/${chunkCount} 批（第 ${chunkStart}–${chunkEnd} 页）…`,
    });

    const comicSystem = buildComicSystemPrompt(chunkPages, storyGenre);
    const comicSchema = buildComicJsonSchema(chunkPages);
    const storySource = buildLightStoryboardSource({
      novelContent,
      novelPrompt,
      novelSummary,
      chunkStart,
      pageCount,
      maxChars: PRODUCT.comic.lightPathContentMaxChars,
    });

    let chunkResult: ComicPage[] = [];
    const result = await llmJson({
      model,
      system: comicSystem,
      user: `请为以下小说改编漫画，输出第 ${chunkStart}～${chunkEnd} 页（共 ${chunkPages} 页，每页 4 格，共 ${chunkPanels} 格）。\n全书共 ${pageCount} 页，请按比例推进剧情（第 ${chunkStart} 页对应故事进度约 ${Math.round(((chunkStart - 1) / pageCount) * 100)}%）。格与格之间连贯；caption 用中文对白/旁白（网页叠字，勿要求画进图里），prompt 用英文纯画面描述。\n\n小说标题：${novelTitle}\n\n${storySource}\n\n请输出 JSON，根对象包含长度为 ${chunkPages} 的 "pages" 数组。`,
      jsonSchema: comicSchema,
      temperature: 0.8,
      mode: "json_schema",
      timeoutMs: Math.min(PRODUCT.comic.storyboardTimeoutMs, 30_000 + chunkPages * 10_000),
    });
    if (result.ok && result.raw && typeof result.raw === "object" && "pages" in result.raw) {
      const rawPages = (result.raw as { pages: ComicPage[] }).pages;
      if (Array.isArray(rawPages) && rawPages.length > 0) {
        chunkResult = normalizeComicPagesForGeneration(rawPages, chunkPages, storyGenre);
        providerUsed = result.provider;
        modelUsed = result.model;
      }
    }

    if (chunkResult.length < 1) {
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

    for (let i = 0; i < chunkResult.length; i++) {
      chunkResult[i] = { ...chunkResult[i]!, page: chunkStart + i };
    }
    pages.push(...chunkResult);

    send({
      step: "light_chunk_done",
      index: chunkIdx + 1,
      total: chunkCount,
      pagesSoFar: pages.length,
      message: `第 ${chunkIdx + 1} 批分镜完成`,
    });
  }

  return { pages, provider: providerUsed, model: modelUsed };
}

async function generateComicPagesLong(params: {
  model: string;
  novelTitle: string;
  novelPrompt: string;
  novelSummary: string;
  novelContent: string;
  pageCount: number;
  storyGenre: CoverGenre;
  novelMeta: NovelGenerationMeta | null;
  emit?: ComicStreamEmitter;
}): Promise<{ pages: ComicPage[]; director: ComicDirectorPack; provider: string; model: string }> {
  const { model, emit } = params;
  const send = emit ?? (() => {});

  send({ step: "director_start", message: "正在生成漫画导演包（角色/场景/页节拍）…" });

  const director = await fetchComicDirectorPack({
    model,
    novelTitle: params.novelTitle,
    novelPrompt: params.novelPrompt,
    novelSummary: params.novelSummary,
    novelContent: params.novelContent,
    pageCount: params.pageCount,
    genre: params.storyGenre,
    novelMeta: params.novelMeta,
  });

  send({
    step: "director_ready",
    message: `导演包完成：${director.characters.length} 角色 · ${director.locations.length} 场景 · ${director.pageBeats.length} 页节拍`,
    characterCount: director.characters.length,
  });

  const CHUNK_SIZE = PRODUCT.comic.storyboardChunkPages;
  let pages: ComicPage[] = [];
  const chunkCount = Math.ceil(params.pageCount / CHUNK_SIZE);

  for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
    const chunkStart = chunkIdx * CHUNK_SIZE + 1;
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, params.pageCount);

    send({
      step: "storyboard_chunk_start",
      index: chunkIdx + 1,
      total: chunkCount,
      chunkStart,
      chunkEnd,
      message: `分镜第 ${chunkIdx + 1}/${chunkCount} 批（第 ${chunkStart}–${chunkEnd} 页）…`,
    });

    const chunkResult = await fetchComicStoryboardChunk({
      model,
      director,
      chunkStart,
      chunkEnd,
      totalPages: params.pageCount,
      genre: params.storyGenre,
    });

    for (let i = 0; i < chunkResult.length; i++) {
      chunkResult[i] = { ...chunkResult[i]!, page: chunkStart + i };
    }
    pages.push(...chunkResult);

    send({
      step: "storyboard_chunk_done",
      index: chunkIdx + 1,
      total: chunkCount,
      pagesSoFar: pages.length,
      message: `第 ${chunkIdx + 1} 批分镜完成`,
    });
  }

  send({ step: "shot_plan_start", message: "正在合成镜头与统一生图描述…" });
  pages = applyShotPlanToPages(pages, director, params.storyGenre);
  send({ step: "shot_plan_done", message: "镜头规划完成" });

  return { pages, director, provider: "", model };
}

/** 生成漫画分镜（短篇轻量 / 长篇导演流水线）。 */
export async function generateComicPages(opts: {
  model: string;
  novelTitle: string;
  novelPrompt: string;
  novelSummary: string;
  novelContent: string;
  pageCount: number;
  storyGenre: CoverGenre;
  lengthTier: NovelLengthTier;
  novelMeta: NovelGenerationMeta | null;
  emit?: ComicStreamEmitter;
}): Promise<ComicPagesGenerateResult> {
  const useLong = shouldUseLongComicPipeline(opts.pageCount, opts.lengthTier);
  const send = opts.emit ?? (() => {});

  send({
    step: "pipeline_mode",
    pipeline: useLong ? "long_director" : "light",
    message: useLong ? "使用长篇导演流水线" : "使用轻量分镜流水线",
  });

  if (useLong) {
    const { pages, director, model } = await generateComicPagesLong({
      model: opts.model,
      novelTitle: opts.novelTitle,
      novelPrompt: opts.novelPrompt,
      novelSummary: opts.novelSummary,
      novelContent: opts.novelContent,
      pageCount: opts.pageCount,
      storyGenre: opts.storyGenre,
      novelMeta: opts.novelMeta,
      emit: opts.emit,
    });

    send({ step: "consistency_start", message: "一致性检查…" });
    const report = checkComicPanelsConsistency(pages, director);
    if (report.issues.length > 0) {
      send({
        step: "consistency_warn",
        ok: report.ok,
        issues: report.issues,
        message: formatComicConsistencyIssues(report.issues),
      });
    }

    return {
      pages,
      pipeline: "long_director",
      director,
      provider: "",
      model,
      consistencyIssues: report.issues,
    };
  }

  const { pages, provider, model } = await generateComicPagesLight({
    model: opts.model,
    novelTitle: opts.novelTitle,
    novelContent: opts.novelContent,
    novelPrompt: opts.novelPrompt,
    novelSummary: opts.novelSummary,
    pageCount: opts.pageCount,
    storyGenre: opts.storyGenre,
    emit: opts.emit,
  });

  return {
    pages,
    pipeline: "light",
    director: null,
    provider,
    model,
    consistencyIssues: [],
  };
}
