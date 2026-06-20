import type { CreativeBrief } from "@/lib/creative-brief/types";
import type { GameSpec } from "@/lib/game-spec";
import type { CoverGenre } from "@/lib/cover-genre";
import { resolveAssetStyle } from "@/lib/cohesive-presentation";

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
/** assetStyle → 封面关键画风词，与游戏视觉一致 */
const ASSET_STYLE_COVER_WORDS: Record<string, string> = {
  "cute-cartoon": "cute cartoon illustration, vibrant flat colors, soft rounded shapes, friendly characters",
  "blocky-pixel": "8-bit pixel art, retro game aesthetic, chunky sprites, limited color palette",
  "neon-cyber": "cyberpunk neon glow, dark futuristic cityscape, electric colors, chrome and glass",
  "classic-arcade": "classic arcade poster art, bold outlines, vivid primary colors, retro game ad style",
  "bullet-hell": "dark action shooter art, glowing projectiles, explosive energy, intense dynamic composition",
  "wuxia-flight": "Chinese ink wash painting style, misty mountains, flowing robes, sword energy streaks",
  "nature-organic": "painterly nature illustration, soft watercolor textures, earthy tones, peaceful botanical",
  "paper-craft": "paper cut-out art style, layered depth, pastel tones, handcrafted whimsy",
  "hand-drawn": "hand-drawn sketch style, expressive linework, warm tones, artisan feel",
};

/**
 * 模板 → 封面元素/场景关键词（独立于 assetStyle 的玩法特定元素）。
 * 即使 LLM 没输出 assetStyle，也能让封面体现"这是节奏游戏/卡牌/格斗"等玩法特征。
 */
const TEMPLATE_COVER_WORDS: Partial<Record<string, string>> = {
  rhythm:
    "rhythm music game cover, glowing musical notes, beat streaks, neon lane tracks, dynamic audio visualizer elements",
  sports:
    "sports game cover, athletic arena, dynamic action pose, ball trajectory motion blur, stadium lights, energetic competitive mood",
  card:
    "card battle game cover, floating playing cards, magical card glow, strategic table layout, hand of cards fan, mana crystal accents",
  fighting:
    "fighting game cover, two combatants clash, dynamic martial arts pose, impact energy burst, dramatic spotlight, versus composition",
  moba:
    "MOBA hero game cover, fantasy champion portrait, ability energy effects, tower silhouette in background, epic battle arena",
  horror:
    "horror game cover, dark eerie surveillance room, flickering monitor glow, ominous shadow figure, security camera POV, unsettling atmosphere",
};

export function buildGameKeyArtPromptFromBrief(brief: CreativeBrief, spec: GameSpec): string {
  const genre = briefPackToCoverGenre(brief.packId);
  const scene = brief.scenes[0] ?? brief.world;
  const units = brief.units.slice(0, 3).join(", ");
  const briefStyle = brief.artStyle.slice(0, 5).join(", ");
  const mood = brief.mood.slice(0, 4).join(", ");
  const negatives = brief.negatives.slice(0, 6).join(", ");

  // assetStyle 优先注入画风关键词，保证封面与游戏视觉一致
  const assetStyle = resolveAssetStyle(spec);
  const styleOverride = ASSET_STYLE_COVER_WORDS[assetStyle] ?? "";
  // 模板特定元素（让封面体现"是什么玩法"）
  const templateElement = TEMPLATE_COVER_WORDS[spec.templateId] ?? "";

  const visualStyle = [styleOverride, templateElement, briefStyle].filter(Boolean).join(", ");

  return [
    `Mobile game key art for "${spec.title}".`,
    brief.logline,
    `Scene: ${scene}.`,
    units ? `Key units: ${units}.` : "",
    `Visual style: ${visualStyle}.`,
    `Mood: ${mood}.`,
    `Genre bucket: ${genre}.`,
    "Composition: hero readable at thumbnail size, clean lower third for title overlay.",
    "Absolutely no text, no logos, no watermarks, no UI mockup.",
    negatives ? `Avoid: ${negatives}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1400);
}
