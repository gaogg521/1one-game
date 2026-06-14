import { llmJson } from "@/lib/llm";
import type { ComicPage } from "@/lib/comic-format";
import type { CoverGenre } from "@/lib/cover-genre";
import { PRODUCT } from "@/lib/product-config";
import { formatComicDirectorForPrompt } from "@/lib/comic-director";
import type { ComicDirectorPack } from "@/lib/comic-director-types";
import { buildComicStoryboardJsonSchema, type ComicStoryboardPanel } from "@/lib/comic-director-types";
import {
  PANELS_PER_PAGE,
  defaultPanelPrompt,
  normalizeComicPagesForGeneration,
  panelsPerPageForLayout,
} from "@/lib/comic-generate-config";
import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import {
  buildStoryboardChunkUserMessage,
  buildStoryboardSystemPrompt,
} from "@/lib/comic-locale-prompts";
import type { ComicLayoutId } from "@/lib/comic-layout";
import { normalizePanelTextFields } from "@/lib/comic-panel-text";
import type { ComicStylePresetId } from "@/lib/comic-style-presets";
import type { PlannedComicPanel } from "@/lib/comic-shot-plan";
import type { DirectorStoryboardChunkStat } from "@/lib/comic-director-chunk-stats";

export type ComicStoryboardChunkResult = {
  pages: ComicPage[];
  stat: DirectorStoryboardChunkStat;
};

function storyboardPanelsToComicPage(
  pageNum: number,
  panels: ComicStoryboardPanel[],
  genre: CoverGenre,
  stylePreset?: ComicStylePresetId,
): ComicPage {
  const fallback = defaultPanelPrompt(genre, stylePreset);
  return {
    page: pageNum,
    panels: panels.map((p, j) => {
      const text = normalizePanelTextFields(p);
      const planned: PlannedComicPanel = {
        scene: p.scene > 0 ? p.scene : (pageNum - 1) * PANELS_PER_PAGE + j + 1,
        caption: text.caption,
        textType: text.textType,
        ...(text.speaker ? { speaker: text.speaker } : {}),
        ...(text.sourceSegmentIndex !== undefined
          ? { sourceSegmentIndex: text.sourceSegmentIndex }
          : {}),
        prompt: p.sceneDescriptionEn.trim() || fallback,
        characterIds: [...p.characterIds],
        locationId: p.locationId,
        shotType: text.shotType,
        sceneDescriptionEn: p.sceneDescriptionEn.trim(),
      };
      return planned;
    }),
  };
}

function storyboardTimeoutMs(pagesInChunk: number): number {
  return Math.min(
    PRODUCT.comic.storyboardTimeoutMs,
    Math.max(150_000, 40_000 + pagesInChunk * 35_000),
  );
}

async function tryDirectorStoryboardOnce(params: {
  model: string;
  director: ComicDirectorPack;
  chunkStart: number;
  chunkEnd: number;
  chunkPages: number;
  totalPages: number;
  genre: CoverGenre;
  stylePreset?: ComicStylePresetId;
  layoutId: ComicLayoutId;
  outputLocale: BriefInputLocale;
  panelsPerPage: number;
  temperature?: number;
}): Promise<ComicPage[] | null> {
  const { model, director, chunkStart, chunkEnd, totalPages, genre, stylePreset, layoutId, outputLocale, panelsPerPage } =
    params;
  const chunkPages = params.chunkPages;
  const storyboardSystem = buildStoryboardSystemPrompt(outputLocale, panelsPerPage);

  const result = await llmJson({
    model,
    system: storyboardSystem,
    user: buildStoryboardChunkUserMessage({
      locale: outputLocale,
      directorBlock: formatComicDirectorForPrompt(director, { from: chunkStart, to: chunkEnd }),
      chunkStart,
      chunkEnd,
      chunkPages,
      totalPages,
      panelsPerPage,
    }),
    jsonSchema: buildComicStoryboardJsonSchema(chunkPages, panelsPerPage),
    temperature: params.temperature ?? 0.72,
    mode: "json_schema",
    timeoutMs: storyboardTimeoutMs(chunkPages),
  });

  if (result.ok && result.raw && typeof result.raw === "object" && "pages" in result.raw) {
    const rawPages = (result.raw as { pages: Array<{ page?: number; panels: ComicStoryboardPanel[] }> }).pages;
    if (Array.isArray(rawPages) && rawPages.length > 0) {
      const mapped: ComicPage[] = rawPages.map((rp, i) =>
        storyboardPanelsToComicPage(rp.page ?? chunkStart + i, rp.panels ?? [], genre, stylePreset),
      );
      return normalizeComicPagesForGeneration(mapped, chunkPages, genre, stylePreset, layoutId, outputLocale);
    }
  }
  return null;
}

function buildDirectorFallbackStoryboardPage(params: {
  pageNum: number;
  director: ComicDirectorPack;
  genre: CoverGenre;
  stylePreset?: ComicStylePresetId;
  layoutId: ComicLayoutId;
  outputLocale: BriefInputLocale;
}): ComicPage {
  const { pageNum, director, genre, stylePreset, layoutId, outputLocale } = params;
  const panelsPerPage = panelsPerPageForLayout(layoutId);
  const fallback = defaultPanelPrompt(genre, stylePreset);
  const beat = director.pageBeats.find((b) => b.page === pageNum) ?? director.pageBeats[pageNum - 1];
  const charIds = director.characters.slice(0, 2).map((c) => c.id);
  const locationId = director.locations[0]?.id ?? "loc_1";
  const eventText = (beat?.keyEvents ?? beat?.mood ?? `Page ${pageNum}`).replace(/\s+/g, " ").trim();
  const chunks = eventText.match(/.{1,28}/g) ?? [eventText.slice(0, 28) || "……"];

  const panels: ComicStoryboardPanel[] = Array.from({ length: panelsPerPage }, (_, j) => ({
    scene: (pageNum - 1) * panelsPerPage + j + 1,
    textType: j === 0 ? "time_place" : j % 3 === 0 ? "narration" : "dialogue",
    speaker: j % 3 === 0 ? undefined : director.characters[j % director.characters.length]?.name,
    caption: chunks[j % chunks.length] ?? chunks[0] ?? "……",
    sceneDescriptionEn: `${director.visualStyleEn}. ${eventText.slice(0, 120)}. Panel ${j + 1}/${panelsPerPage}.`,
    characterIds: charIds,
    locationId,
    shotType: (["wide", "medium", "close", "over_shoulder"] as const)[j % 4]!,
  }));

  return storyboardPanelsToComicPage(pageNum, panels, genre, stylePreset);
}

async function fetchDirectorStoryboardChunkWithRetry(
  base: Omit<Parameters<typeof tryDirectorStoryboardOnce>[0], "chunkStart" | "chunkEnd" | "chunkPages" | "temperature">,
  chunkStart: number,
  chunkEnd: number,
): Promise<ComicPage[] | null> {
  const chunkPages = chunkEnd - chunkStart + 1;
  const temps = [0.72, 0.58, 0.45];
  for (const temperature of temps) {
    const batch = await tryDirectorStoryboardOnce({
      ...base,
      chunkStart,
      chunkEnd,
      chunkPages,
      temperature,
    });
    if (batch) return batch;
  }
  return null;
}

export async function fetchComicStoryboardChunk(params: {
  model: string;
  director: ComicDirectorPack;
  chunkStart: number;
  chunkEnd: number;
  totalPages: number;
  genre: CoverGenre;
  stylePreset?: ComicStylePresetId;
  layoutId?: ComicLayoutId;
  outputLocale?: BriefInputLocale;
}): Promise<ComicStoryboardChunkResult> {
  const { model, director, chunkStart, chunkEnd, totalPages, genre, stylePreset } = params;
  const outputLocale = params.outputLocale ?? "zh";
  const layoutId = params.layoutId ?? "grid_8";
  const panelsPerPage = panelsPerPageForLayout(layoutId);
  const chunkPages = chunkEnd - chunkStart + 1;

  const base = {
    model,
    director,
    totalPages,
    genre,
    stylePreset,
    layoutId,
    outputLocale,
    panelsPerPage,
  };

  const statBase = { chunkStart, chunkEnd, pagesInChunk: chunkPages };

  const batch = await fetchDirectorStoryboardChunkWithRetry(base, chunkStart, chunkEnd);
  if (batch) {
    return { pages: batch, stat: { ...statBase, strategy: "batch" } };
  }

  if (chunkPages <= 1) {
    const fallback = buildDirectorFallbackStoryboardPage({
      pageNum: chunkStart,
      director,
      genre,
      stylePreset,
      layoutId,
      outputLocale,
    });
    return { pages: [fallback], stat: { ...statBase, strategy: "fallback_page" } };
  }

  const merged: ComicPage[] = [];
  let usedFallback = false;
  for (let i = 0; i < chunkPages; i++) {
    const pageNum = chunkStart + i;
    let single = await fetchDirectorStoryboardChunkWithRetry(base, pageNum, pageNum);
    if (!single) {
      single = [
        buildDirectorFallbackStoryboardPage({
          pageNum,
          director,
          genre,
          stylePreset,
          layoutId,
          outputLocale,
        }),
      ];
      usedFallback = true;
    }
    single[0] = { ...single[0]!, page: pageNum };
    merged.push(single[0]!);
  }
  return {
    pages: merged,
    stat: { ...statBase, strategy: usedFallback ? "per_page_fallback" : "per_page" },
  };
}
