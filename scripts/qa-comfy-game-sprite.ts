/**
 * Comfy 精灵 workflow 离线 QA（256→512 管线）
 * npm run qa:comfy-game-sprite
 */
import {
  assertComfySpriteOutputPxAllowed,
  assertComfySpriteWorkflowPreviewSize,
  resolveSpriteOutputPx,
} from "@/lib/comfy-game-sprite-gen";

if (!assertComfySpriteWorkflowPreviewSize()) {
  console.error("[FAIL] comfy sprite workflow preview size != 256");
  process.exit(1);
}

if (!assertComfySpriteOutputPxAllowed()) {
  console.error("[FAIL] GAME_SPRITE_OUTPUT_PX must be 512 or 1024");
  process.exit(1);
}

console.log(`[OK] comfy sprite output px=${resolveSpriteOutputPx()}`);
console.log("[OK] qa:comfy-game-sprite");
