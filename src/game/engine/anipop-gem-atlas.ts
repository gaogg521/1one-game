import Phaser from "phaser";
import { ANIPOP_GEM_KINDS, type AnipopGemKind } from "@/game/engine/anipop-visual";

export const ANIPOP_GEM_SHEET_KEY = "anipop-gems-v1";
const SHEET_URL = "/game-sprites/sample-color-bloom/anipop-gems-v1.png";
export const ANIPOP_GEM_FRAME_SIZE = 64;

export function registerAnipopGemAtlasLoader(scene: Phaser.Scene): void {
  if (scene.textures.exists(ANIPOP_GEM_SHEET_KEY)) return;
  scene.load.spritesheet(ANIPOP_GEM_SHEET_KEY, SHEET_URL, {
    frameWidth: ANIPOP_GEM_FRAME_SIZE,
    frameHeight: ANIPOP_GEM_FRAME_SIZE,
  });
}

export function hasAnipopGemAtlas(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(ANIPOP_GEM_SHEET_KEY)) return false;
  const tex = scene.textures.get(ANIPOP_GEM_SHEET_KEY);
  return tex.frameTotal > ANIPOP_GEM_KINDS.length;
}

export function anipopGemFrameIndex(kind: AnipopGemKind): number {
  const idx = ANIPOP_GEM_KINDS.indexOf(kind);
  return idx >= 0 ? idx : 0;
}

export function anipopGemAtlasKey(): string {
  return ANIPOP_GEM_SHEET_KEY;
}
