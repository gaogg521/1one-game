import { COMIC_IMAGE_NO_TEXT_SUFFIX } from "@/lib/comic-generate-config";
import type { ComicPanel, ComicPage } from "@/lib/comic-format";
import type { CoverGenre } from "@/lib/cover-genre";
import { getComicPanelStyleLock } from "@/lib/cover-genre";
import type { ComicDirectorPack, ComicShotType } from "@/lib/comic-director-types";
import type { ComicAdaptationBlueprint } from "@/lib/comic-adaptation-blueprint";

export const SHOT_FRAMING: Record<ComicShotType, string> = {
  wide: "wide establishing shot, full environment visible",
  medium: "medium shot, waist-up, clear body language",
  close: "close-up shot, face and shoulders, emotional expression",
  over_shoulder: "over-the-shoulder shot, depth between characters",
  extreme_close: "extreme close-up on eyes or key detail",
};

export function shotFramingHint(shotType?: ComicShotType): string {
  return SHOT_FRAMING[shotType ?? "medium"];
}

export type PlannedComicPanel = ComicPanel & {
  characterIds?: string[];
  locationId?: string;
  shotType?: ComicShotType;
  sceneDescriptionEn?: string;
};

/** 用导演包 + 镜头类型生成稳定英文生图 prompt。 */
export function buildFinalPanelImagePrompt(
  director: ComicDirectorPack,
  panel: PlannedComicPanel,
  genre: CoverGenre,
  consistencyLock?: string,
): string {
  const style = director.visualStyleEn || getComicPanelStyleLock(genre);
  const shot = SHOT_FRAMING[panel.shotType ?? "medium"];

  const charLines: string[] = [];
  const ids = panel.characterIds ?? [];
  for (const id of ids) {
    const c = director.characters.find((x) => x.id === id);
    if (c) {
      charLines.push(
        `${c.name} (same character as always): ${c.appearanceEn}, wearing ${c.outfitEn}${c.hairEn ? `, hair: ${c.hairEn}` : ""}`,
      );
    }
  }
  if (charLines.length === 0 && director.characters[0]) {
    const c = director.characters[0]!;
    charLines.push(`${c.name}: ${c.appearanceEn}, ${c.outfitEn}`);
  }

  const loc = director.locations.find((l) => l.id === panel.locationId) ?? director.locations[0];
  const locLine = loc ? `Setting — ${loc.name}: ${loc.descriptionEn}` : "";

  const action =
    panel.sceneDescriptionEn?.trim() ||
    panel.prompt?.trim() ||
    "story moment matching the caption mood";

  const consistencyBlock = consistencyLock ? `[VISUAL CONSISTENCY LOCK]: ${consistencyLock}` : "";

  const parts = [
    style,
    shot,
    charLines.join(". "),
    locLine,
    `Action: ${action.slice(0, 280)}`,
    director.colorPalette ? `Color palette: ${director.colorPalette}` : "",
    consistencyBlock,
    COMIC_IMAGE_NO_TEXT_SUFFIX,
  ].filter(Boolean);

  return parts.join(". ");
}

export function applyShotPlanToPages(
  pages: ComicPage[],
  director: ComicDirectorPack,
  genre: CoverGenre,
  adaptationBlueprint?: ComicAdaptationBlueprint | null,
): ComicPage[] {
  const consistencyLock = adaptationBlueprint?.consistencyLock ?? "";
  return pages.map((page) => ({
    ...page,
    panels: page.panels.map((panel) => {
      const planned = panel as PlannedComicPanel;
      const prompt = buildFinalPanelImagePrompt(director, planned, genre, consistencyLock);
      return { ...panel, prompt };
    }),
  }));
}
