import type { ComicPage } from "@/lib/comic-format";
import type { CoverGenre } from "@/lib/cover-genre";
import {
  buildComicJsonSchema,
  buildComicSystemPrompt,
  defaultPanelPrompt,
  normalizeComicPagesForGeneration,
  panelsPerPageForLayout,
  shouldUseLongComicPipeline,
} from "@/lib/comic-generate-config";
import { type ComicLayoutId } from "@/lib/comic-layout";
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
import {
  formatSegmentsForStoryboardPrompt,
  segmentsForPageChunk,
  splitNovelIntoSegments,
} from "@/lib/comic-storyboard-segments";
import type { ComicStylePresetId } from "@/lib/comic-style-presets";
import type { ComicCharacterRoster } from "@/lib/comic-character-roster";
import {
  fetchComicCharacterRoster,
  rosterFromDirectorPack,
  rosterFromNovelMeta,
} from "@/lib/comic-character-roster";
import { enrichPagesFromSegmentDialogues } from "@/lib/comic-dialogue-extract";
import {
  buildComicPrereadPack,
  formatPlotDigestForPrompt,
  type ComicPlotDigest,
} from "@/lib/comic-preread";
import type { ComicReadMode } from "@/lib/comic-format";

export type { ComicStreamEmitter } from "@/lib/comic-pipeline-events";

export type ComicPagesGenerateResult = {
  pages: ComicPage[];
  pipeline: "long_director" | "light";
  director: ComicDirectorPack | null;
  provider: string;
  model: string;
  consistencyIssues: ComicConsistencyIssue[];
  readMode: ComicReadMode;
  layoutId: ComicLayoutId;
  characterRoster?: ComicCharacterRoster;
  plotDigest?: ComicPlotDigest;
};

/** 按段落绑定本批页码对应的小说节选（精读模式），并附 Brief/简介。 */
function buildLightStoryboardSource(opts: {
  novelContent: string;
  novelPrompt: string;
  novelSummary: string;
  chunkStart: number;
  chunkEnd: number;
  pageCount: number;
  maxChars: number;
  plotDigest?: ComicPlotDigest | null;
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
  if (opts.plotDigest) {
    headerParts.push(formatPlotDigestForPrompt(opts.plotDigest));
  }
  const header = headerParts.join("\n\n");
  const segments = splitNovelIntoSegments(opts.novelContent);
  const chunkSegs = segmentsForPageChunk(segments, opts.chunkStart, opts.chunkEnd, opts.pageCount);
  let body = formatSegmentsForStoryboardPrompt(chunkSegs);
  const budget = Math.max(2500, opts.maxChars - header.length - 120);
  if (body.length > budget) body = `${body.slice(0, budget)}\n…（后续段落于下一批分镜继续）`;
  if (!header) return `【本批必须改编的原文段落 — 逐段出格，禁止脱离段落脑补】\n\n${body}`;
  return `${header}\n\n【本批必须改编的原文段落 — 逐段出格，禁止脱离段落脑补】\n\n${body}`;
}

async function generateComicPagesLight(params: {
  model: string;
  novelTitle: string;
  novelContent: string;
  novelPrompt: string;
  novelSummary: string;
  pageCount: number;
  storyGenre: CoverGenre;
  stylePreset: ComicStylePresetId;
  layoutId: ComicLayoutId;
  plotDigest?: ComicPlotDigest | null;
  characterRoster?: ComicCharacterRoster | null;
  emit?: ComicStreamEmitter;
}): Promise<{ pages: ComicPage[]; provider: string; model: string }> {
  const {
    model,
    novelTitle,
    novelContent,
    novelPrompt,
    novelSummary,
    pageCount,
    storyGenre,
    stylePreset,
    layoutId,
    plotDigest,
    characterRoster,
    emit,
  } = params;
  const panelsPerPage = panelsPerPageForLayout(layoutId);
  const allSegments = splitNovelIntoSegments(novelContent);
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
    const chunkPanels = chunkPages * panelsPerPage;

    send({
      step: "light_chunk_start",
      index: chunkIdx + 1,
      total: chunkCount,
      chunkStart,
      chunkEnd,
      message: `轻量分镜 第 ${chunkIdx + 1}/${chunkCount} 批（第 ${chunkStart}–${chunkEnd} 页）…`,
    });

    const comicSystem = buildComicSystemPrompt(chunkPages, storyGenre, stylePreset, {
      roster: characterRoster,
      plotDigest,
      layoutId,
    });
    const comicSchema = buildComicJsonSchema(chunkPages, layoutId);
    const storySource = buildLightStoryboardSource({
      novelContent,
      novelPrompt,
      novelSummary,
      chunkStart,
      chunkEnd,
      pageCount,
      maxChars: PRODUCT.comic.lightPathContentMaxChars,
      plotDigest,
    });

    let chunkResult: ComicPage[] = [];
    const result = await llmJson({
      model,
      system: comicSystem,
      user: `请为以下小说改编漫画，输出第 ${chunkStart}～${chunkEnd} 页（共 ${chunkPages} 页，每页 4 格，共 ${chunkPanels} 格）。
全书共 ${pageCount} 页。本批仅改编下方【段落#】内容：约 1 段 1～2 格，sourceSegmentIndex 填段落号减 1。
区分 textType（对白/旁白/内心/场景/时间）；shotType 搭配远景/中景/特写；禁止脑补段落外剧情。

小说标题：${novelTitle}

${storySource}

请输出 JSON，根对象包含长度为 ${chunkPages} 的 "pages" 数组。`,
      jsonSchema: comicSchema,
      temperature: 0.8,
      mode: "json_schema",
      timeoutMs: Math.min(PRODUCT.comic.storyboardTimeoutMs, 30_000 + chunkPages * 10_000),
    });
    if (result.ok && result.raw && typeof result.raw === "object" && "pages" in result.raw) {
      const rawPages = (result.raw as { pages: ComicPage[] }).pages;
      if (Array.isArray(rawPages) && rawPages.length > 0) {
        chunkResult = normalizeComicPagesForGeneration(
          rawPages,
          chunkPages,
          storyGenre,
          stylePreset,
          layoutId,
        );
        providerUsed = result.provider;
        modelUsed = result.model;
      }
    }

    if (chunkResult.length < 1) {
      for (let i = chunkStart; i <= chunkEnd; i++) {
        chunkResult.push({
          page: i,
          panels: Array.from({ length: panelsPerPage }, (_, j) => ({
            scene: (i - 1) * panelsPerPage + j + 1,
            caption: "……",
            prompt: defaultPanelPrompt(storyGenre, stylePreset),
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

  let finalPages = pages;
  if (allSegments.length > 0) {
    finalPages = enrichPagesFromSegmentDialogues(finalPages, allSegments);
  }

  return { pages: finalPages, provider: providerUsed, model: modelUsed };
}

async function generateComicPagesLong(params: {
  model: string;
  novelTitle: string;
  novelPrompt: string;
  novelSummary: string;
  novelContent: string;
  pageCount: number;
  storyGenre: CoverGenre;
  stylePreset: ComicStylePresetId;
  novelMeta: NovelGenerationMeta | null;
  emit?: ComicStreamEmitter;
}): Promise<{ pages: ComicPage[]; director: ComicDirectorPack; provider: string; model: string }> {
  const { model, emit, stylePreset } = params;
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
    stylePreset,
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
      stylePreset,
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

  const segments = splitNovelIntoSegments(params.novelContent);
  if (segments.length > 0) {
    pages = enrichPagesFromSegmentDialogues(pages, segments);
  }

  return { pages, director, provider: "", model };
}

async function resolveComicRosterAndDigest(opts: {
  model: string;
  readMode: ComicReadMode;
  novelTitle: string;
  novelSummary: string;
  novelContent: string;
  novelMeta: NovelGenerationMeta | null;
  userRoster?: ComicCharacterRoster | null;
  emit?: ComicStreamEmitter;
}): Promise<{ roster: ComicCharacterRoster | null; plotDigest: ComicPlotDigest | null }> {
  const send = opts.emit ?? (() => {});
  let plotDigest: ComicPlotDigest | null = null;
  let roster = opts.userRoster?.characters.length ? opts.userRoster : null;

  if (opts.readMode === "full") {
    send({ step: "preread_start", message: "全书精读：正在通读剧情并锁定人设…" });
    const pack = await buildComicPrereadPack({
      model: opts.model,
      novelTitle: opts.novelTitle,
      novelSummary: opts.novelSummary,
      novelContent: opts.novelContent,
      novelMeta: opts.novelMeta,
      userRoster: roster,
    });
    if (pack) {
      plotDigest = pack.plotDigest;
      roster = pack.characterRoster;
      send({ step: "preread_done", message: "精读完成，开始分镜…" });
    }
  }

  if (!roster) {
    roster = rosterFromNovelMeta(opts.novelMeta);
  }
  if (!roster?.characters.length) {
    send({ step: "roster_start", message: "正在提取主要角色人设…" });
    roster = await fetchComicCharacterRoster({
      model: opts.model,
      novelTitle: opts.novelTitle,
      novelSummary: opts.novelSummary,
      contentExcerpt: opts.novelContent.slice(0, 14_000),
    });
    if (roster) send({ step: "roster_done", message: `已锁定 ${roster.characters.length} 位角色` });
  }

  return { roster, plotDigest };
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
  stylePreset: ComicStylePresetId;
  layoutId: ComicLayoutId;
  readMode?: ComicReadMode;
  characterRoster?: ComicCharacterRoster | null;
  lengthTier: NovelLengthTier;
  novelMeta: NovelGenerationMeta | null;
  emit?: ComicStreamEmitter;
}): Promise<ComicPagesGenerateResult> {
  const readMode = opts.readMode ?? "segment";
  const layoutId = opts.layoutId;
  const useLong = shouldUseLongComicPipeline(opts.pageCount, opts.lengthTier);
  const send = opts.emit ?? (() => {});

  const { roster, plotDigest } = await resolveComicRosterAndDigest({
    model: opts.model,
    readMode,
    novelTitle: opts.novelTitle,
    novelSummary: opts.novelSummary,
    novelContent: opts.novelContent,
    novelMeta: opts.novelMeta,
    userRoster: opts.characterRoster,
    emit: send,
  });

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
      stylePreset: opts.stylePreset,
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

    const longRoster = director ? rosterFromDirectorPack(director) : roster;

    return {
      pages,
      pipeline: "long_director",
      director,
      provider: "",
      model,
      consistencyIssues: report.issues,
      readMode,
      layoutId,
      ...(longRoster ? { characterRoster: longRoster } : {}),
      ...(plotDigest ? { plotDigest } : {}),
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
    stylePreset: opts.stylePreset,
    layoutId,
    plotDigest,
    characterRoster: roster,
    emit: opts.emit,
  });

  return {
    pages,
    pipeline: "light",
    director: null,
    provider,
    model,
    consistencyIssues: [],
    readMode,
    layoutId,
    ...(roster ? { characterRoster: roster } : {}),
    ...(plotDigest ? { plotDigest } : {}),
  };
}
