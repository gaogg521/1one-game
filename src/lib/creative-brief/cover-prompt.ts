import type { CreativeBrief } from "@/lib/creative-brief/types";
import type { GameSpec } from "@/lib/game-spec";
import type { CoverGenre } from "@/lib/cover-genre";

/** Brief 题材包 → 封面 genre 映射 */
export function briefPackToCoverGenre(packId: string): CoverGenre {
  switch (packId) {
    case "space-epic":
      return "scifi";
    case "wuxia-jianghu":
      return "wuxia";
    case "horror-survival":
      return "mystery";
    case "anime-action":
      return "fantasy";
    case "tower-defense":
      return "historical";
    case "cozy-collect":
      return "romance";
    case "folklore-festival":
      return "historical";
    case "sports-arcade":
      return "urban";
    case "puzzle-logic":
      return "mystery";
    default:
      return "general";
  }
}

/**
 * 由 Creative Brief + GameSpec 生成游戏 key art / 封面背景 prompt（英文，无文字）。
 * 供文生图、Comfy 或未来独立封面 API 使用。
 */
export function buildGameKeyArtPromptFromBrief(brief: CreativeBrief, spec: GameSpec): string {
  const genre = briefPackToCoverGenre(brief.packId);
  const scene = brief.scenes[0] ?? brief.world;
  const units = brief.units.slice(0, 3).join(", ");
  const style = brief.artStyle.slice(0, 5).join(", ");
  const mood = brief.mood.slice(0, 4).join(", ");
  const negatives = brief.negatives.slice(0, 6).join(", ");

  return [
    `Mobile game key art for "${spec.title}".`,
    brief.logline,
    `Scene: ${scene}.`,
    units ? `Key units: ${units}.` : "",
    `Visual style: ${style}.`,
    `Mood: ${mood}.`,
    `Genre bucket: ${genre}.`,
    "Composition: hero readable at thumbnail size, clean lower third for title overlay.",
    "Absolutely no text, no logos, no watermarks, no UI mockup.",
    negatives ? `Avoid: ${negatives}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1200);
}
