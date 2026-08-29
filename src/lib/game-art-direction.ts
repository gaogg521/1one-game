import type { CreativeBrief } from "@/lib/creative-brief/types";
import type { GameSpec } from "@/lib/game-spec";

export type GameArtDirection = {
  version: 1;
  kind: "game_art_direction";
  visualLanguage: string;
  camera: string;
  sceneComposition: string;
  requiredAssetSlots: Array<"background" | "player" | "enemy" | "collectible" | "ui">;
  promptSuffix: string;
  negativePrompt: string;
};

const TEMPLATE_DIRECTION: Partial<Record<GameSpec["templateId"], Omit<GameArtDirection, "version" | "kind" | "promptSuffix">>> = {
  towerDefense: {
    visualLanguage: "premium illustrated casual strategy art with readable silhouettes and layered depth",
    camera: "three-quarter elevated playfield camera",
    sceneComposition: "reserve a clean tactical lane in the centre; place decoration only at the perimeter",
    requiredAssetSlots: ["background", "player", "enemy", "collectible", "ui"],
    negativePrompt: "flat placeholder geometry, text, logo, watermark, collage, cluttered battlefield",
  },
  farming: {
    visualLanguage: "warm painterly casual simulation art with tactile materials and soft sunlight",
    camera: "elevated isometric garden camera",
    sceneComposition: "leave a readable central grid and frame it with a living environment",
    requiredAssetSlots: ["background", "player", "collectible", "ui"],
    negativePrompt: "flat placeholder geometry, text, logo, watermark, empty grid, UI mockup",
  },
  puzzle: {
    visualLanguage: "polished readable casual puzzle art with distinct object families and rich board material",
    camera: "front-facing board camera with a shallow environmental backdrop",
    sceneComposition: "high contrast interactive board, restrained background and obvious piece silhouettes",
    requiredAssetSlots: ["background", "player", "collectible", "ui"],
    negativePrompt: "flat placeholder geometry, text, logo, watermark, indistinguishable pieces",
  },
  shooter: {
    visualLanguage: "dynamic arcade action art with strong depth, glow and high-contrast actors",
    camera: "top-down action camera",
    sceneComposition: "keep the combat lane readable and reserve safe contrast behind player and enemies",
    requiredAssetSlots: ["background", "player", "enemy", "collectible", "ui"],
    negativePrompt: "flat placeholder geometry, text, logo, watermark, static UI mockup",
  },
};

/** A durable visual brief created before asset generation, never reconstructed from a finished screenshot. */
export function buildGameArtDirection(spec: GameSpec, brief?: CreativeBrief | null): GameArtDirection {
  const fallback: Omit<GameArtDirection, "version" | "kind" | "promptSuffix"> = {
    visualLanguage: "premium cohesive game illustration with material depth, directional light and readable silhouettes",
    camera: "gameplay-first camera selected for the interaction plane",
    sceneComposition: "keep the primary interaction area clear and use scenery to frame play rather than cover it",
    requiredAssetSlots: ["background", "player", "enemy", "collectible", "ui"],
    negativePrompt: "flat placeholder geometry, text, logo, watermark, generic UI mockup, unrelated collage",
  };
  const base = TEMPLATE_DIRECTION[spec.templateId] ?? fallback;
  const briefStyle = brief?.artStyle.filter(Boolean).join(", ").trim();
  const direction = briefStyle ? `${base.visualLanguage}; ${briefStyle}` : base.visualLanguage;
  return {
    version: 1,
    kind: "game_art_direction",
    ...base,
    visualLanguage: direction,
    promptSuffix: [
      `art direction: ${direction}`,
      `camera: ${base.camera}`,
      `composition: ${base.sceneComposition}`,
      "Create a real production game asset, not a concept sheet or a UI screenshot.",
    ].join("; "),
  };
}
