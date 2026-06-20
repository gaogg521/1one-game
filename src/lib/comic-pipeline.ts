import type { AppLocale } from "@/i18n/routing";
import { progressComicMessage } from "@/lib/i18n/progress-message";
import type { ComicPage, ComicReadMode } from "@/lib/comic-format";
import type { CoverGenre } from "@/lib/cover-genre";
import {
  buildComicJsonSchema,
  buildComicSystemPrompt,
  defaultPanelPrompt,
  normalizeComicPagesForGeneration,
  panelsPerPageForLayout,
  shouldUseLongComicPipeline,
} from "@/lib/comic-generate-config";
import {
  buildComicLightUserMessage,
  lightStoryboardHeaderLabels,
  panelContinuationSuffix,
  resolveComicOutputLocale,
  resolveStoryboardChunkPages,
  resolveStoryboardChunkPagesForTier,
} from "@/lib/comic-locale-prompts";
import { type ComicLayoutId } from "@/lib/comic-layout";
import { fetchComicDirectorPack } from "@/lib/comic-director";
import type { ComicDirectorPack } from "@/lib/comic-director-types";
import {
  checkComicPanelsConsistency,
  formatComicConsistencyIssues,
  type ComicConsistencyIssue,
} from "@/lib/comic-panel-consistency";
import { ComicGenerationRunError, resolveComicRunErrorMessage } from "@/lib/comic-run-errors";
import type { ComicStreamEmitter } from "@/lib/comic-pipeline-events";
import { applyShotPlanToPages } from "@/lib/comic-shot-plan";
import { fetchComicStoryboardChunk } from "@/lib/comic-storyboard-long";
import {
  accumulateDirectorStoryboardStats,
  formatDirectorStoryboardStatsLine,
  type DirectorStoryboardChunkStat,
  type DirectorStoryboardRunStats,
} from "@/lib/comic-director-chunk-stats";
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
import { enrichPagesFromNovelSegments } from "@/lib/comic-dialogue-extract";
import {
  buildComicPrereadPack,
  formatPlotDigestForPrompt,
  type ComicPlotDigest,
} from "@/lib/comic-preread";
import {
  fetchComicAdaptationBlueprint,
  formatAdaptationBlueprintForPrompt,
  scopedChapterNums as blueprintScopedChapterNums,
  selectBlueprintBeatsForChunk,
  shouldBuildAdaptationBlueprint,
  type ComicAdaptationBlueprint,
} from "@/lib/comic-adaptation-blueprint";
import type { NovelChapter } from "@/lib/novel-chapters";
import { parseNovelChapters } from "@/lib/novel-chapters";
import {
  logComicModeFallback,
  recordComicModeFallback,
  type ComicFallbackEvent,
} from "@/lib/comic-pipeline-fallback-tracker";
import {
  checkIncrementalConsistency,
  formatIncrementalConsistencyIssues,
  type IncrementalConsistencyIssue,
} from "@/lib/comic-consistency-incremental";

export type { ComicStreamEmitter } from "@/lib/comic-pipeline-events";

export type ComicPagesGenerateResult = {
  pages: ComicPage[];
  pipeline: "long_director" | "light";
  storyboardSource: "llm" | "emergency";
  director: ComicDirectorPack | null;
  provider: string;
  model: string;
  consistencyIssues: ComicConsistencyIssue[];
  readMode: ComicReadMode;
  layoutId: ComicLayoutId;
  characterRoster?: ComicCharacterRoster;
  plotDigest?: ComicPlotDigest;
  adaptationBlueprint?: ComicAdaptationBlueprint;
  directorStoryboardStats?: DirectorStoryboardRunStats;
  fallbackEvent?: ComicFallbackEvent;
};

function buildKeyBeatsForChunk(opts: {
  plotDigest?: ComicPlotDigest | null;
  adaptationBlueprint?: ComicAdaptationBlueprint | null;
  scopedChapterNums?: number[];
  allSegments: ReturnType<typeof splitNovelIntoSegments>;
  chunkStart: number;
  chunkEnd: number;
  pageCount: number;
  panelsPerPage: number;
}): string[] {
  const target = Math.max(1, (opts.chunkEnd - opts.chunkStart + 1) * opts.panelsPerPage);

  if (opts.adaptationBlueprint) {
    const fromBlueprint = selectBlueprintBeatsForChunk({
      blueprint: opts.adaptationBlueprint,
      scopedChapterNums: opts.scopedChapterNums ?? [],
      chunkStart: opts.chunkStart,
      chunkEnd: opts.chunkEnd,
      pageCount: opts.pageCount,
      panelsPerPage: opts.panelsPerPage,
    });
    if (fromBlueprint.length >= Math.min(target, 2)) return fromBlueprint.slice(0, target);
  }

  const digestBeats = opts.plotDigest?.keyBeats?.filter(Boolean) ?? [];
  if (digestBeats.length >= target) return digestBeats.slice(0, target);

  const segs = segmentsForPageChunk(opts.allSegments, opts.chunkStart, opts.chunkEnd, opts.pageCount);
  const picked = segs
    .map((seg) => seg.text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, target);
  return [...digestBeats, ...picked].slice(0, target);
}

/** 为本批构建关键情节摘要源，而不是线性逐段铺格。 */
function buildLightStoryboardSource(opts: {
  novelContent: string;
  novelPrompt: string;
  novelSummary: string;
  chunkStart: number;
  chunkEnd: number;
  pageCount: number;
  panelsPerPage: number;
  maxChars: number;
  plotDigest?: ComicPlotDigest | null;
  adaptationBlueprint?: ComicAdaptationBlueprint | null;
  scopedChapterNums?: number[];
  outputLocale: ReturnType<typeof resolveComicOutputLocale>;
}): string {
  const labels = lightStoryboardHeaderLabels(opts.outputLocale);
  const headerParts: string[] = [];
  const prompt = opts.novelPrompt.trim();
  const summary = opts.novelSummary.trim();
  if (prompt.length >= 2) {
    headerParts.push(`${labels.prompt}\n${prompt.slice(0, 4000)}`);
  }
  if (summary.length >= 2) {
    headerParts.push(`${labels.summary}\n${summary.slice(0, 1200)}`);
  }
  if (opts.adaptationBlueprint) {
    headerParts.push(
      formatAdaptationBlueprintForPrompt(opts.adaptationBlueprint, opts.scopedChapterNums),
    );
  } else if (opts.plotDigest) {
    headerParts.push(formatPlotDigestForPrompt(opts.plotDigest));
  }
  const header = headerParts.join("\n\n");
  const segments = splitNovelIntoSegments(opts.novelContent, 24, opts.outputLocale);
  const chunkSegs = segmentsForPageChunk(segments, opts.chunkStart, opts.chunkEnd, opts.pageCount);
  const chunkBeats = buildKeyBeatsForChunk({
    plotDigest: opts.plotDigest,
    adaptationBlueprint: opts.adaptationBlueprint,
    scopedChapterNums: opts.scopedChapterNums,
    allSegments: segments,
    chunkStart: opts.chunkStart,
    chunkEnd: opts.chunkEnd,
    pageCount: opts.pageCount,
    panelsPerPage: opts.panelsPerPage,
  });
  let body = formatSegmentsForStoryboardPrompt(chunkSegs, opts.outputLocale);
  const budget = Math.max(2500, opts.maxChars - header.length - 120);
  if (body.length > budget) body = `${body.slice(0, budget)}\n${labels.truncated}`;
  const beatBlock = chunkBeats.length
    ? `${labels.beats}\n${chunkBeats.map((beat, i) => `${i + 1}. ${beat}`).join("\n")}`
    : "";
  if (!header) return `${beatBlock}\n\n${labels.segments}\n\n${body}`.trim();
  return `${header}\n\n${beatBlock}\n\n${labels.segments}\n\n${body}`.trim();
}

export type ComicChunkCheckpoint = {
  pages: ComicPage[];
  chunkIndex: number;
  chunkCount: number;
};

function buildEmergencyComicPages(params: {
  pageCount: number;
  layoutId: ComicLayoutId;
  storyGenre: CoverGenre;
  stylePreset: ComicStylePresetId;
  novelSummary: string;
  novelPrompt: string;
  outputLocale: ReturnType<typeof resolveComicOutputLocale>;
}): ComicPage[] {
  const panelsPerPage = panelsPerPageForLayout(params.layoutId);
  const fallbackPrompt = defaultPanelPrompt(params.storyGenre, params.stylePreset);
  const captionSeed = (params.novelSummary || params.novelPrompt).replace(/\s+/g, " ").trim() || "Story beat";
  const cont = panelContinuationSuffix(params.outputLocale);
  return Array.from({ length: params.pageCount }, (_, pageIdx) => ({
    page: pageIdx + 1,
    panels: Array.from({ length: panelsPerPage }, (_, panelIdx) => ({
      scene: pageIdx * panelsPerPage + panelIdx + 1,
      caption: `${captionSeed.slice(0, 36)}${panelIdx === 0 ? "" : cont}`,
      prompt: fallbackPrompt,
      textType: "narration" as const,
      shotType: (panelIdx % 3 === 0 ? "wide" : panelIdx % 3 === 1 ? "medium" : "close") as "wide" | "medium" | "close",
    })),
  }));
}

async function fetchLightStoryboardChunk(params: {
  model: string;
  chunkStart: number;
  chunkEnd: number;
  chunkPages: number;
  panelsPerPage: number;
  pageCount: number;
  novelTitle: string;
  storySource: string;
  storyGenre: CoverGenre;
  stylePreset: ComicStylePresetId;
  layoutId: ComicLayoutId;
  outputLocale: ReturnType<typeof resolveComicOutputLocale>;
  characterRoster?: ComicCharacterRoster | null;
  plotDigest?: ComicPlotDigest | null;
  llmTemperature: number;
  uiLocale: AppLocale;
  /** 构建本批 storySource（批大小可变时用于二分降级） */
  buildStorySource?: (chunkStart: number, chunkEnd: number, chunkPages: number) => string;
}): Promise<{ pages: ComicPage[]; provider: string; model: string }> {
  const buildSource =
    params.buildStorySource ??
    ((_start: number, _end: number, _pages: number) => params.storySource);

  const tryOnce = async (pagesInChunk: number, startPage: number) => {
    const chunkPanels = pagesInChunk * params.panelsPerPage;
    const comicSystem = buildComicSystemPrompt(pagesInChunk, params.storyGenre, params.stylePreset, {
      roster: params.characterRoster,
      plotDigest: params.plotDigest,
      layoutId: params.layoutId,
      outputLocale: params.outputLocale,
    });
    const comicSchema = buildComicJsonSchema(pagesInChunk, params.layoutId);
    const storySource = buildSource(startPage, startPage + pagesInChunk - 1, pagesInChunk);
    const result = await llmJson({
      model: params.model,
      system: comicSystem,
      user: buildComicLightUserMessage({
        locale: params.outputLocale,
        chunkStart: startPage,
        chunkEnd: startPage + pagesInChunk - 1,
        chunkPages: pagesInChunk,
        panelsPerPage: params.panelsPerPage,
        chunkPanels,
        pageCount: params.pageCount,
        novelTitle: params.novelTitle,
        storySource,
      }),
      jsonSchema: comicSchema,
      temperature: params.llmTemperature,
      mode: "json_schema",
      timeoutMs: Math.min(
        PRODUCT.comic.storyboardTimeoutMs,
        Math.max(120_000, 35_000 + pagesInChunk * params.panelsPerPage * 4_500),
      ),
    });
    if (result.ok && result.raw && typeof result.raw === "object" && "pages" in result.raw) {
      const rawPages = (result.raw as { pages: ComicPage[] }).pages;
      if (Array.isArray(rawPages) && rawPages.length > 0) {
        return {
          pages: normalizeComicPagesForGeneration(
            rawPages,
            pagesInChunk,
            params.storyGenre,
            params.stylePreset,
            params.layoutId,
            params.outputLocale,
          ),
          provider: result.provider,
          model: result.model,
        };
      }
    }
    return null;
  };

  const fetchRange = async (
    chunkStart: number,
    chunkPages: number,
  ): Promise<{ pages: ComicPage[]; provider: string; model: string }> => {
    const batch = await tryOnce(chunkPages, chunkStart);
    if (batch) return batch;

    if (chunkPages <= 1) {
      throw new ComicGenerationRunError("storyboardPageJsonFailed", { page: chunkStart });
    }

    const half = Math.ceil(chunkPages / 2);
    const left = await fetchRange(chunkStart, half);
    const right = await fetchRange(chunkStart + half, chunkPages - half);
    return {
      pages: [...left.pages, ...right.pages],
      provider: right.provider || left.provider,
      model: right.model || left.model,
    };
  };

  return fetchRange(params.chunkStart, params.chunkPages);
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
  adaptationBlueprint?: ComicAdaptationBlueprint | null;
  scopedChapterNums?: number[];
  lengthTier: NovelLengthTier;
  outputLocale: ReturnType<typeof resolveComicOutputLocale>;
  uiLocale: AppLocale;
  emit?: ComicStreamEmitter;
  existingPages?: ComicPage[];
  startChunkIndex?: number;
  onChunkCheckpoint?: (ev: ComicChunkCheckpoint) => void | Promise<void>;
}): Promise<{ pages: ComicPage[]; provider: string; model: string; storyboardSource: "llm" }> {
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
    adaptationBlueprint,
    scopedChapterNums,
    outputLocale,
    uiLocale,
    emit,
  } = params;
  const panelsPerPage = panelsPerPageForLayout(layoutId);
  const allSegments = splitNovelIntoSegments(novelContent, 24, outputLocale);
  const send = emit ?? (() => {});
  const CHUNK_SIZE = resolveStoryboardChunkPagesForTier(
    params.lengthTier,
    outputLocale,
    PRODUCT.comic.storyboardChunkPages,
  );
  const pages: ComicPage[] = params.existingPages?.length ? [...params.existingPages] : [];
  let providerUsed = "";
  let modelUsed = model;

  const chunkCount = Math.ceil(pageCount / CHUNK_SIZE);
  const startChunk = Math.min(
    Math.max(0, params.startChunkIndex ?? 0),
    Math.max(0, chunkCount - 1),
  );
  if (startChunk > 0) {
    send({
      step: "resume_storyboard",
      index: startChunk + 1,
      total: chunkCount,
      pagesSoFar: pages.length,
      message: progressComicMessage(uiLocale, "resumeChunk", {
        start: startChunk + 1,
        total: chunkCount,
        pages: pages.length,
      }),
    });
  }
  for (let chunkIdx = startChunk; chunkIdx < chunkCount; chunkIdx++) {
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
      message: progressComicMessage(uiLocale, "lightChunk", {
        index: chunkIdx + 1,
        total: chunkCount,
        from: chunkStart,
        to: chunkEnd,
      }),
    });

    let chunkResult: ComicPage[] = [];
    const llmTemperature = ["zh", "zh-Hant", "ja"].includes(outputLocale) ? 0.7 : 0.55;
    const fetched = await fetchLightStoryboardChunk({
      model,
      chunkStart,
      chunkEnd,
      chunkPages,
      panelsPerPage,
      pageCount,
      novelTitle,
      storySource: "",
      storyGenre,
      stylePreset,
      layoutId,
      outputLocale,
      characterRoster,
      plotDigest,
      llmTemperature,
      uiLocale,
      buildStorySource: (start, end, pagesInChunk) =>
        buildLightStoryboardSource({
          novelContent,
          novelPrompt,
          novelSummary,
          chunkStart: start,
          chunkEnd: end,
          pageCount,
          panelsPerPage,
          maxChars: PRODUCT.comic.lightPathContentMaxChars,
          plotDigest,
          adaptationBlueprint,
          scopedChapterNums,
          outputLocale,
        }),
    });
    chunkResult = fetched.pages;
    providerUsed = fetched.provider;
    modelUsed = fetched.model;

    if (chunkResult.length < 1) {
      throw new ComicGenerationRunError("storyboardChunkEmpty", {
        index: chunkIdx + 1,
        total: chunkCount,
      });
    }

    for (let i = 0; i < chunkResult.length; i++) {
      chunkResult[i] = { ...chunkResult[i]!, page: chunkStart + i };
    }
    pages.push(...chunkResult);

    // 产品优化：每 chunk 完成后做增量一致性检查（角色连续性/场景衔接）
    if (pages.length > chunkResult.length) {
      const consistencyReport = checkIncrementalConsistency({
        existingPages: pages.slice(0, pages.length - chunkResult.length),
        newPages: chunkResult,
      });
      if (!consistencyReport.ok) {
        send({
          step: "consistency_warning",
          issues: consistencyReport.issues.map((i) => ({ code: i.code, message: i.message, severity: i.severity })),
          message: `增量一致性检查发现 ${consistencyReport.issues.length} 个问题`,
        });
      }
    }

    send({
      step: "light_chunk_done",
      index: chunkIdx + 1,
      total: chunkCount,
      pagesSoFar: pages.length,
      message: progressComicMessage(uiLocale, "chunkDone", { index: chunkIdx + 1 }),
    });
    await params.onChunkCheckpoint?.({
      pages: [...pages],
      chunkIndex: chunkIdx + 1,
      chunkCount,
    });
  }

  let finalPages = pages.slice(0, pageCount);
  if (allSegments.length > 0) {
    finalPages = enrichPagesFromNovelSegments(finalPages, allSegments);
  }

  return { pages: finalPages, provider: providerUsed, model: modelUsed, storyboardSource: "llm" as const };
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
  layoutId: ComicLayoutId;
  novelMeta: NovelGenerationMeta | null;
  outputLocale: ReturnType<typeof resolveComicOutputLocale>;
  uiLocale: AppLocale;
  emit?: ComicStreamEmitter;
  existingPages?: ComicPage[];
  existingDirector?: ComicDirectorPack | null;
  startChunkIndex?: number;
  onChunkCheckpoint?: (ev: ComicChunkCheckpoint) => void | Promise<void>;
  adaptationBlueprint?: ComicAdaptationBlueprint | null;
}): Promise<{
  pages: ComicPage[];
  director: ComicDirectorPack;
  provider: string;
  model: string;
  directorStoryboardStats: DirectorStoryboardRunStats;
}> {
  const { model, emit, stylePreset } = params;
  const send = emit ?? (() => {});
  const uiLocale = params.uiLocale;

  let director = params.existingDirector ?? null;
  if (director) {
    send({
      step: "director_ready",
      message: progressComicMessage(uiLocale, "reuseDirector", {
        chars: director.characters.length,
        locs: director.locations.length,
      }),
      characterCount: director.characters.length,
      resumed: true,
    });
  } else {
    send({ step: "director_start", message: progressComicMessage(uiLocale, "directorStart") });
    director = await fetchComicDirectorPack({
      model,
      novelTitle: params.novelTitle,
      novelPrompt: params.novelPrompt,
      novelSummary: params.novelSummary,
      novelContent: params.novelContent,
      pageCount: params.pageCount,
      genre: params.storyGenre,
      stylePreset,
      novelMeta: params.novelMeta,
      layoutId: params.layoutId,
      outputLocale: params.outputLocale,
    });
    send({
      step: "director_ready",
      message: progressComicMessage(uiLocale, "directorDone", {
        chars: director.characters.length,
        locs: director.locations.length,
        beats: director.pageBeats.length,
      }),
      characterCount: director.characters.length,
    });
  }

  const CHUNK_SIZE = resolveStoryboardChunkPages(params.outputLocale, PRODUCT.comic.storyboardChunkPages);
  let pages: ComicPage[] = params.existingPages?.length ? [...params.existingPages] : [];
  const chunkCount = Math.ceil(params.pageCount / CHUNK_SIZE);
  const chunkStats: DirectorStoryboardChunkStat[] = [];
  const startChunk = Math.min(
    Math.max(0, params.startChunkIndex ?? 0),
    Math.max(0, chunkCount - 1),
  );
  if (startChunk > 0) {
    send({
      step: "resume_storyboard",
      index: startChunk + 1,
      total: chunkCount,
      pagesSoFar: pages.length,
      message: progressComicMessage(uiLocale, "resumeChunk", {
        start: startChunk + 1,
        total: chunkCount,
        pages: pages.length,
      }),
    });
  }

  for (let chunkIdx = startChunk; chunkIdx < chunkCount; chunkIdx++) {
    const chunkStart = chunkIdx * CHUNK_SIZE + 1;
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, params.pageCount);

    send({
      step: "storyboard_chunk_start",
      index: chunkIdx + 1,
      total: chunkCount,
      chunkStart,
      chunkEnd,
      message: progressComicMessage(uiLocale, "storyboardChunk", {
        index: chunkIdx + 1,
        total: chunkCount,
        from: chunkStart,
        to: chunkEnd,
      }),
    });

    const { pages: chunkResult, stat } = await fetchComicStoryboardChunk({
      model,
      director,
      chunkStart,
      chunkEnd,
      totalPages: params.pageCount,
      genre: params.storyGenre,
      stylePreset,
      layoutId: params.layoutId,
      outputLocale: params.outputLocale,
    });
    chunkStats.push(stat);

    for (let i = 0; i < chunkResult.length; i++) {
      chunkResult[i] = { ...chunkResult[i]!, page: chunkStart + i };
    }
    pages.push(...chunkResult);

    // 产品优化：每 chunk 完成后做增量一致性检查（角色连续性/场景衔接）
    if (pages.length > chunkResult.length) {
      const consistencyReport = checkIncrementalConsistency({
        existingPages: pages.slice(0, pages.length - chunkResult.length),
        newPages: chunkResult,
      });
      if (!consistencyReport.ok) {
        send({
          step: "consistency_warning",
          issues: consistencyReport.issues.map((i) => ({ code: i.code, message: i.message, severity: i.severity })),
          message: `增量一致性检查发现 ${consistencyReport.issues.length} 个问题`,
        });
      }
    }

    send({
      step: "storyboard_chunk_done",
      index: chunkIdx + 1,
      total: chunkCount,
      pagesSoFar: pages.length,
      chunkStrategy: stat.strategy,
      message: progressComicMessage(uiLocale, "chunkDone", { index: chunkIdx + 1 }),
    });
    await params.onChunkCheckpoint?.({
      pages: [...pages],
      chunkIndex: chunkIdx + 1,
      chunkCount,
    });
  }

  const directorStoryboardStats = accumulateDirectorStoryboardStats(chunkStats);
  const statsLocale = params.outputLocale === "en" ? "en" : "zh";
  send({
    step: "director_storyboard_stats",
    ...directorStoryboardStats,
    message: formatDirectorStoryboardStatsLine(directorStoryboardStats, statsLocale),
  });

  send({ step: "shot_plan_start", message: progressComicMessage(uiLocale, "shotPlanStart") });
  pages = applyShotPlanToPages(pages, director, params.storyGenre, params.adaptationBlueprint);
  send({ step: "shot_plan_done", message: progressComicMessage(uiLocale, "shotPlanDone") });

  const segments = splitNovelIntoSegments(params.novelContent, 24, params.outputLocale);
  if (segments.length > 0) {
    pages = enrichPagesFromNovelSegments(pages, segments);
  }

  return { pages, director, provider: "", model, directorStoryboardStats };
}

async function resolveComicRosterAndDigest(opts: {
  model: string;
  readMode: ComicReadMode;
  novelTitle: string;
  novelSummary: string;
  /** 全书正文（改编前勿切片），用于精读与分章关键情节 */
  fullNovelContent: string;
  scopedChapters: NovelChapter[];
  novelMeta: NovelGenerationMeta | null;
  lengthTier: NovelLengthTier;
  userRoster?: ComicCharacterRoster | null;
  uiLocale: AppLocale;
  emit?: ComicStreamEmitter;
}): Promise<{
  roster: ComicCharacterRoster | null;
  plotDigest: ComicPlotDigest | null;
  adaptationBlueprint: ComicAdaptationBlueprint | null;
}> {
  const send = opts.emit ?? (() => {});
  const uiLocale = opts.uiLocale;
  let plotDigest: ComicPlotDigest | null = null;
  let adaptationBlueprint: ComicAdaptationBlueprint | null = null;
  let roster = opts.userRoster?.characters.length ? opts.userRoster : null;

  const allChapters = parseNovelChapters(opts.fullNovelContent, uiLocale);
  const shouldAdapt =
    shouldBuildAdaptationBlueprint(opts.fullNovelContent.length, allChapters.length, opts.lengthTier);

  if (shouldAdapt) {
    send({ step: "preread_start", message: progressComicMessage(uiLocale, "prereadStart") });
    const pack = await buildComicPrereadPack({
      model: opts.model,
      novelTitle: opts.novelTitle,
      novelSummary: opts.novelSummary,
      novelContent: opts.fullNovelContent,
      novelMeta: opts.novelMeta,
      userRoster: roster,
    });
    if (pack) {
      plotDigest = pack.plotDigest;
      roster = pack.characterRoster;
      send({ step: "preread_done", message: progressComicMessage(uiLocale, "prereadDone") });
    }
  }

  if (!roster) {
    roster = rosterFromNovelMeta(opts.novelMeta);
  }
  if (!roster?.characters.length) {
    send({ step: "roster_start", message: progressComicMessage(uiLocale, "rosterStart") });
    roster = await fetchComicCharacterRoster({
      model: opts.model,
      novelTitle: opts.novelTitle,
      novelSummary: opts.novelSummary,
      contentExcerpt: opts.fullNovelContent.slice(0, 14_000),
    });
    if (roster) {
      send({
        step: "roster_done",
        message: progressComicMessage(uiLocale, "rosterDone", { count: roster.characters.length }),
      });
    }
  }

  if (shouldAdapt && plotDigest && roster?.characters.length) {
    send({ step: "blueprint_start", message: progressComicMessage(uiLocale, "blueprintStart") });
    adaptationBlueprint = await fetchComicAdaptationBlueprint({
      model: opts.model,
      novelTitle: opts.novelTitle,
      chapters: allChapters,
      plotDigest,
      characterRoster: roster,
    });
    if (adaptationBlueprint) {
      send({
        step: "blueprint_done",
        message: progressComicMessage(uiLocale, "blueprintDone", {
          chapters: adaptationBlueprint.chapters.length,
        }),
      });
    }
  }

  return { roster, plotDigest, adaptationBlueprint };
}

/** 生成漫画分镜（短篇轻量 / 长篇导演流水线）。 */
export async function generateComicPages(opts: {
  model: string;
  novelTitle: string;
  novelPrompt: string;
  novelSummary: string;
  novelContent: string;
  fullNovelContent?: string;
  scopedChapters?: NovelChapter[];
  pageCount: number;
  storyGenre: CoverGenre;
  stylePreset: ComicStylePresetId;
  layoutId: ComicLayoutId;
  readMode?: ComicReadMode;
  characterRoster?: ComicCharacterRoster | null;
  lengthTier: NovelLengthTier;
  novelMeta: NovelGenerationMeta | null;
  uiLocale: AppLocale;
  emit?: ComicStreamEmitter;
  existingPages?: ComicPage[];
  existingDirector?: ComicDirectorPack | null;
  startChunkIndex?: number;
  onChunkCheckpoint?: (ev: ComicChunkCheckpoint) => void | Promise<void>;
  /** 跳过导演包，直接轻量分镜（长篇试跑 / 降低失败率） */
  forceLightStoryboard?: boolean;
}): Promise<ComicPagesGenerateResult> {
  const readMode = opts.readMode ?? "segment";
  const layoutId = opts.layoutId;
  const outputLocale = resolveComicOutputLocale(opts.novelPrompt, opts.novelContent);
  const useLong = shouldUseLongComicPipeline(opts.pageCount, opts.lengthTier, outputLocale, {
    forceLightStoryboard: opts.forceLightStoryboard,
  });
  const send = opts.emit ?? (() => {});
  const uiLocale = opts.uiLocale;

  const fullNovelContent = opts.fullNovelContent?.trim() || opts.novelContent;
  const scopedChapters = opts.scopedChapters ?? parseNovelChapters(fullNovelContent, uiLocale);
  const chapterNums = blueprintScopedChapterNums(scopedChapters);

  let roster: ComicCharacterRoster | null = null;
  let plotDigest: ComicPlotDigest | null = null;
  let adaptationBlueprint: ComicAdaptationBlueprint | null = null;
  let fallbackEvent: ComicFallbackEvent | undefined = undefined;

  if (useLong) {
    ({ roster, plotDigest, adaptationBlueprint } = await resolveComicRosterAndDigest({
      model: opts.model,
      readMode,
      novelTitle: opts.novelTitle,
      novelSummary: opts.novelSummary,
      fullNovelContent,
      scopedChapters,
      novelMeta: opts.novelMeta,
      lengthTier: opts.lengthTier,
      userRoster: opts.characterRoster,
      uiLocale,
      emit: send,
    }));
  } else {
    roster = opts.characterRoster?.characters.length ? opts.characterRoster : null;
    if (!roster) {
      roster = rosterFromNovelMeta(opts.novelMeta);
    }
    if (!roster?.characters.length) {
      send({ step: "roster_start", message: progressComicMessage(uiLocale, "rosterStart") });
      roster = await fetchComicCharacterRoster({
        model: opts.model,
        novelTitle: opts.novelTitle,
        novelSummary: opts.novelSummary,
        contentExcerpt: opts.novelContent.slice(0, 8000),
      });
      if (roster) {
        send({
          step: "roster_done",
          message: progressComicMessage(uiLocale, "rosterDone", { count: roster.characters.length }),
        });
      }
    }
  }

  send({
    step: "pipeline_mode",
    pipeline: useLong ? "long_director" : "light",
    message: progressComicMessage(uiLocale, useLong ? "pipelineLong" : "pipelineLight"),
  });

  if (useLong) {
    try {
      const { pages, director, model, directorStoryboardStats } = await generateComicPagesLong({
        model: opts.model,
        novelTitle: opts.novelTitle,
        novelPrompt: opts.novelPrompt,
        novelSummary: opts.novelSummary,
        novelContent: opts.novelContent,
        pageCount: opts.pageCount,
        storyGenre: opts.storyGenre,
        stylePreset: opts.stylePreset,
        layoutId,
        novelMeta: opts.novelMeta,
        outputLocale,
        uiLocale,
        emit: opts.emit,
        existingPages: opts.existingPages,
        existingDirector: opts.existingDirector,
        startChunkIndex: opts.startChunkIndex,
        onChunkCheckpoint: opts.onChunkCheckpoint,
        adaptationBlueprint,
      });

      send({ step: "consistency_start", message: progressComicMessage(uiLocale, "consistencyStart") });
      const report = checkComicPanelsConsistency(pages, director, uiLocale);
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
        storyboardSource: "llm",
        director,
        provider: "",
        model,
        consistencyIssues: report.issues,
        readMode,
        layoutId,
        ...(longRoster ? { characterRoster: longRoster } : {}),
        ...(plotDigest ? { plotDigest } : {}),
        ...(adaptationBlueprint ? { adaptationBlueprint } : {}),
        ...(directorStoryboardStats ? { directorStoryboardStats } : {}),
      };
    } catch (error) {
      fallbackEvent = recordComicModeFallback({
        fromMode: "long_director",
        toMode: "light",
        error,
        context: "director_pack",
      });
      logComicModeFallback(fallbackEvent);
      send({
        step: "pipeline_fallback",
        pipeline: "light",
        fallbackEvent,
        message: progressComicMessage(uiLocale, "directorFallback", {
          error: resolveComicRunErrorMessage(uiLocale, error),
        }),
      });
    }
  }

  try {
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
      adaptationBlueprint,
      scopedChapterNums: chapterNums,
      lengthTier: opts.lengthTier,
      outputLocale,
      uiLocale,
      emit: opts.emit,
      existingPages: opts.existingPages,
      startChunkIndex: opts.startChunkIndex,
      onChunkCheckpoint: opts.onChunkCheckpoint,
    });

    // ★ 增量一致性检查：新生成分页与既有分页的衔接
    let incrementalIssues: IncrementalConsistencyIssue[] = [];
    if (opts.existingPages && opts.existingPages.length > 0) {
      const incremental = checkIncrementalConsistency({
        existingPages: opts.existingPages,
        newPages: pages,
        directorCharacterIds: roster?.characters ? new Set(roster.characters.map((c) => c.id)) : undefined,
      });

      incrementalIssues = incremental.issues;
      if (!incremental.ok || incremental.issues.length > 0) {
        send({
          step: "incremental_consistency_warning",
          issues: incremental.issues,
          sampledPairs: incremental.sampledPagePairs,
          message: formatIncrementalConsistencyIssues(incremental.issues),
        });
      }
    }

    return {
      pages,
      pipeline: "light",
      storyboardSource: "llm",
      director: null,
      provider,
      model,
      consistencyIssues: incrementalIssues,
      readMode,
      layoutId,
      ...(roster ? { characterRoster: roster } : {}),
      ...(plotDigest ? { plotDigest } : {}),
      ...(adaptationBlueprint ? { adaptationBlueprint } : {}),
      ...(fallbackEvent ? { fallbackEvent } : {}),
    };
  } catch (error) {
    const emergencyFallbackEvent = recordComicModeFallback({
      fromMode: "light",
      toMode: "emergency",
      error,
      context: "light_generation",
    });
    logComicModeFallback(emergencyFallbackEvent);
    send({
      step: "pipeline_fallback",
      pipeline: "emergency",
      fallbackEvent: emergencyFallbackEvent,
      message: progressComicMessage(uiLocale, "lightFallback", {
        error: resolveComicRunErrorMessage(uiLocale, error),
      }),
    });
    const emergencyPages = buildEmergencyComicPages({
      pageCount: opts.pageCount,
      layoutId,
      storyGenre: opts.storyGenre,
      stylePreset: opts.stylePreset,
      novelSummary: opts.novelSummary,
      novelPrompt: opts.novelPrompt,
      outputLocale,
    });
    return {
      pages: emergencyPages,
      pipeline: "light",
      storyboardSource: "emergency",
      director: null,
      provider: "",
      model: opts.model,
      consistencyIssues: [],
      readMode,
      layoutId,
      ...(roster ? { characterRoster: roster } : {}),
      ...(plotDigest ? { plotDigest } : {}),
      ...(adaptationBlueprint ? { adaptationBlueprint } : {}),
      fallbackEvent: emergencyFallbackEvent,
    };
  }
}
