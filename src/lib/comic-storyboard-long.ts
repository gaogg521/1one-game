import { llmJson } from "@/lib/llm";
import type { ComicPage } from "@/lib/comic-format";
import type { CoverGenre } from "@/lib/cover-genre";
import { PRODUCT } from "@/lib/product-config";
import { formatComicDirectorForPrompt } from "@/lib/comic-director";
import type { ComicDirectorPack } from "@/lib/comic-director-types";
import { buildComicStoryboardJsonSchema, type ComicStoryboardPanel } from "@/lib/comic-director-types";
import {
  COMIC_MASTER_QUALITY_BLOCK,
  PANELS_PER_PAGE,
  defaultPanelPrompt,
  normalizeComicPagesForGeneration,
} from "@/lib/comic-generate-config";
import { normalizePanelTextFields } from "@/lib/comic-panel-text";
import type { ComicStylePresetId } from "@/lib/comic-style-presets";
import type { PlannedComicPanel } from "@/lib/comic-shot-plan";

const STORYBOARD_SYSTEM = `你是漫画分镜师。必须严格使用导演包中的角色 id、场景 id 与页节拍，不得发明新主角外貌。

${COMIC_MASTER_QUALITY_BLOCK}

每格输出：textType、speaker（对白时）、caption、sceneDescriptionEn、characterIds、locationId、shotType、sourceSegmentIndex（若提供段落编号）。
全片 ${PANELS_PER_PAGE} 格/页；格间叙事连贯；约 1 段落 1～2 格。`;

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
}): Promise<ComicPage[]> {
  const { model, director, chunkStart, chunkEnd, totalPages, genre, stylePreset } = params;
  const chunkPages = chunkEnd - chunkStart + 1;

  const result = await llmJson({
    model,
    system: STORYBOARD_SYSTEM,
    user: `${formatComicDirectorForPrompt(director, { from: chunkStart, to: chunkEnd })}

请输出第 ${chunkStart}～${chunkEnd} 页分镜 JSON（共 ${chunkPages} 页，全书 ${totalPages} 页）。
每页尽量 4 格；scene 为全书递增格序号。`,
    jsonSchema: buildComicStoryboardJsonSchema(chunkPages),
    temperature: 0.72,
    mode: "json_schema",
    timeoutMs: Math.min(PRODUCT.comic.storyboardTimeoutMs, 30_000 + chunkPages * 12_000),
  });

  if (result.ok && result.raw && typeof result.raw === "object" && "pages" in result.raw) {
    const rawPages = (result.raw as { pages: Array<{ page?: number; panels: ComicStoryboardPanel[] }> }).pages;
    if (Array.isArray(rawPages) && rawPages.length > 0) {
      const mapped: ComicPage[] = rawPages.map((rp, i) =>
        storyboardPanelsToComicPage(rp.page ?? chunkStart + i, rp.panels ?? [], genre, stylePreset),
      );
      return normalizeComicPagesForGeneration(mapped, chunkPages, genre, stylePreset);
    }
  }

  const placeholder: ComicPage[] = [];
  for (let i = chunkStart; i <= chunkEnd; i++) {
    const beat = director.pageBeats.find((b) => b.page === i);
    placeholder.push({
      page: i,
      panels: Array.from({ length: PANELS_PER_PAGE }, (_, j) => {
        const scene = (i - 1) * PANELS_PER_PAGE + j + 1;
        const planned: PlannedComicPanel = {
          scene,
          caption: beat?.keyEvents.slice(0, 40) ?? "……",
          prompt: defaultPanelPrompt(genre),
          characterIds: [director.characters[0]?.id ?? "char_1"],
          locationId: director.locations[0]?.id ?? "loc_1",
          shotType: j === 0 ? "wide" : "medium",
          sceneDescriptionEn: beat?.keyEvents.slice(0, 80) ?? "story scene",
        };
        return planned;
      }),
    });
  }
  return placeholder;
}
