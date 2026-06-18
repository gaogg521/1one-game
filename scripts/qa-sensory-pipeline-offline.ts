/**
 * Phase D：视听管线离线契约（Brief 封面开关 · Comfy 输出尺寸）
 * npm run qa:sensory-pipeline-offline
 */
import { PRODUCT } from "@/lib/product-config";
import {
  assertComfySpriteOutputPxAllowed,
  resolveSpriteOutputPx,
} from "@/lib/comfy-game-sprite-gen";
import type { CreativeBrief } from "@/lib/creative-brief/types";

if (typeof PRODUCT.game.autoCoverFromBrief !== "boolean") {
  console.error("[FAIL] PRODUCT.game.autoCoverFromBrief must be boolean");
  process.exit(1);
}

if (!assertComfySpriteOutputPxAllowed()) {
  console.error("[FAIL] GAME_SPRITE_OUTPUT_PX must be 512 or 1024");
  process.exit(1);
}

const brief: CreativeBrief = {
  version: 1,
  userPrompt: "test",
  logline: "test",
  packId: "test",
  packLabel: "test",
  intent: {
    genreId: "platformer",
    genreLabel: "平台",
    templateHint: "platformer",
    tone: "playful",
    difficulty: "normal",
    keywords: [],
  },
  world: "w",
  scenes: [],
  factions: [],
  units: [],
  weapons: [],
  vfx: [],
  artStyle: [],
  mood: [],
  gameplayHints: [],
  themeHints: {},
  negatives: [],
  expandSource: "pack",
};

function shouldGenerateBriefCover(
  auto: boolean,
  b: CreativeBrief | null,
  existingCoverPath: string | null | undefined,
): boolean {
  return auto && Boolean(b) && !existingCoverPath;
}

if (!shouldGenerateBriefCover(PRODUCT.game.autoCoverFromBrief, brief, null)) {
  console.error("[FAIL] expected cover generation when no existing cover");
  process.exit(1);
}
if (shouldGenerateBriefCover(PRODUCT.game.autoCoverFromBrief, brief, "/covers/existing.jpg")) {
  console.error("[FAIL] should skip cover when existingCoverPath is set");
  process.exit(1);
}

console.log(`[OK] autoCoverFromBrief=${PRODUCT.game.autoCoverFromBrief}`);
console.log(`[OK] sprite output px=${resolveSpriteOutputPx()}`);
console.log("[OK] qa:sensory-pipeline-offline");
