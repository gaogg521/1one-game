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
}): Promise<ComicPage[]> {
  const { model, director, chunkStart, chunkEnd, totalPages, genre, stylePreset } = params;
  const outputLocale = params.outputLocale ?? "zh";
  const layoutId = params.layoutId ?? "grid_8";
  const panelsPerPage = panelsPerPageForLayout(layoutId);
  const chunkPages = chunkEnd - chunkStart + 1;
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
    temperature: 0.72,
    mode: "json_schema",
    timeoutMs: Math.min(
      PRODUCT.comic.storyboardTimeoutMs,
      Math.max(150_000, 40_000 + chunkPages * 35_000),
    ),
  });

  if (result.ok && result.raw && typeof result.raw === "object" && "pages" in result.raw) {
    const rawPages = (result.raw as { pages: Array<{ page?: number; panels: ComicStoryboardPanel[] }> }).pages;
    if (Array.isArray(rawPages) && rawPages.length > 0) {
      const mapped: ComicPage[] = rawPages.map((rp, i) =>
        storyboardPanelsToComicPage(rp.page ?? chunkStart + i, rp.panels ?? [], genre, stylePreset),
      );
      return normalizeComicPagesForGeneration(mapped, chunkPages, genre, stylePreset, layoutId);
    }
  }

  throw new Error(
    `长篇分镜第 ${chunkStart}～${chunkEnd} 页生成失败：模型未返回有效 JSON，请重试或切换阅读模式`,
  );
}
