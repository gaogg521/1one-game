import type { GameSpec } from "@/lib/game-spec";

/** Astrocade 级：各 template 背景/场景视觉短语（背景与精灵 prompt 共用） */
export const TEMPLATE_VISUAL_STYLES: Partial<Record<GameSpec["templateId"], string>> = {
  avoider: "vertical dodge arcade, falling hazards from above, open sky arena",
  collector: "top-down collect-a-thon arena, gems scattered on playfield",
  survivor: "survival dodge arena, escalating hazard waves",
  platformer: "side-scrolling platformer background, layered parallax scenery",
  towerDefense: "top-down tactical lane/path, tower defense grid terrain",
  shooter: "top-down space shooter, starfield with nebulae",
  sniper: "blocky low-poly sniper range, distant targets, over-shoulder mood",
  coaster: "bright cartoon 3D sky, aerial roller-coaster track in clouds",
  racing: "aerial race track, speed lines, vibrant sky",
  puzzle: "soft pastel puzzle board backdrop, match-3 or tile grid mood",
  farming: "cozy garden farm field, plots and crops, sunny pastoral",
  physics: "stress-relief workshop, dummy target zone, playful arcade",
  chess: "elegant chess hall, stylized board perspective backdrop",
  customization: "car showroom studio, clean floor, soft studio lighting",
  strategy: "strategy war map table, nodes and territories, tactical mood",
  stealth: "shadowy platformer rooftops, patrol lights, night mood",
  // 卡牌/棋类
  "dou-dizhu": "green felt card table, playing cards layout, cozy indoor lighting",
  poker: "casino card table, green felt, poker chips and cards",
  "mahjong-solitaire": "mahjong tile board, Chinese tile pattern, lantern lighting",
  mahjong: "mahjong round table, tiles stacked, cozy Chinese interior",
  uno: "colorful UNO card table, bright game-night mood",
  "chess-board": "elegant chess board, stylized pieces, soft indoor lighting",
  blackjack: "casino blackjack table, green felt, cards and chips",
  solitaire: "solitaire card layout, clean table, calm game mood",
};

export function templateVisualStyle(
  templateId: GameSpec["templateId"],
  fallback = "abstract geometric game background, clean flat design",
): string {
  return TEMPLATE_VISUAL_STYLES[templateId] ?? fallback;
}

export function buildAssetMoodLine(spec: GameSpec): string {
  const title = spec.title || "game";
  const subtitle = spec.labels?.subtitle?.trim() || "";
  return subtitle || title;
}

export function specTextForStyleDetection(spec: GameSpec): string {
  const mood = buildAssetMoodLine(spec);
  return `${spec.title} ${mood} ${spec.labels?.player || ""} ${spec.labels?.hazard || ""} ${spec.labels?.collectible || ""}`.toLowerCase();
}
