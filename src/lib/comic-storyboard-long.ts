import { llmJson } from "@/lib/llm";
import type { ComicPage } from "@/lib/comic-format";
import type { CoverGenre } from "@/lib/cover-genre";
import { PRODUCT } from "@/lib/product-config";
import { formatComicDirectorForPrompt, type ComicDirectorPack } from "@/lib/comic-director";
import { buildComicStoryboardJsonSchema, type ComicStoryboardPanel } from "@/lib/comic-director-types";
import { PANELS_PER_PAGE, defaultPanelPrompt, normalizeComicPagesForGeneration } from "@/lib/comic-generate-config";
import type { PlannedComicPanel } from "@/lib/comic-shot-plan";

const STORYBOARD_SYSTEM = `你是漫画分镜师。必须严格使用导演包中的角色 id、场景 id 与页节拍，不得发明新主角外貌。
每格输出：caption（中文对白/旁白）、sceneDescriptionEn（英文画面动作，不含台词文字）、characterIds、locationId、shotType。
全片 ${PANELS_PER_PAGE} 格/页为宜；格间叙事连贯。`;

function storyboardPanelsToComicPage(
  pageNum: number,
  panels: ComicStoryboardPanel[],
  genre: CoverGenre,
): ComicPage {
  const fallback = defaultPanelPrompt(genre);
  return {
    page: pageNum,
    panels: panels.map((p, j) => {
      const planned: PlannedComicPanel = {
        scene: p.scene > 0 ? p.scene : (pageNum - 1) * PANELS_PER_PAGE + j + 1,
        caption: p.caption.trim().slice(0, 120) || "……",
        prompt: p.sceneDescriptionEn.trim() || fallback,
        characterIds: [...p.characterIds],
        locationId: p.locationId,
        shotType: p.shotType,
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
}): Promise<ComicPage[]> {
  const { model, director, chunkStart, chunkEnd, totalPages, genre } = params;
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
        storyboardPanelsToComicPage(rp.page ?? chunkStart + i, rp.panels ?? [], genre),
      );
      return normalizeComicPagesForGeneration(mapped, chunkPages, genre);
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
