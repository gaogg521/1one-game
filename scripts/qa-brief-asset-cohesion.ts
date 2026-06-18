/**
 * Phase D：Brief 视觉导演注入背景/精灵 prompt
 * npm run qa:brief-asset-cohesion
 */
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { buildBackgroundPrompt } from "@/lib/game-background-gen";
import { buildSpritePrompt } from "@/lib/game-sprite-gen";
import {
  appendBriefVisualDirection,
  buildBriefVisualDirection,
} from "@/lib/assets/brief-visual-direction";
import type { CreativeBrief } from "@/lib/creative-brief/types";

const brief: CreativeBrief = {
  version: 1,
  userPrompt: "史诗横版平台跳跃，三关选角，最终 Boss Thanos",
  logline: "星辉遗迹的三阶远征",
  packId: "space-epic",
  packLabel: "太空史诗",
  intent: {
    genreId: "platformer",
    genreLabel: "平台跳跃",
    templateHint: "platformer",
    tone: "epic",
    difficulty: "normal",
    keywords: ["platformer", "boss", "levels"],
  },
  world: "破碎的星辉遗迹浮岛链",
  scenes: ["第一关熔岩走廊", "Boss  Thanos 王座"],
  factions: ["星辉守卫", "虚空军团"],
  units: ["跃行者", "Thanos Boss"],
  weapons: ["星刃"],
  vfx: ["粒子尾迹", "冲击波"],
  artStyle: ["cel-shaded", "epic fantasy", "mobile game key art"],
  mood: ["epic", "urgent", "heroic"],
  gameplayHints: ["三关", "选角"],
  themeHints: {},
  negatives: ["text", "watermark", "UI"],
  expandSource: "pack",
};

const spec = mockSpecFromPrompt("史诗横版平台跳跃三关 Boss Thanos", { templateId: "platformer" });

const bg = buildBackgroundPrompt(spec, brief);
const sp = appendBriefVisualDirection(
  buildSpritePrompt(spec, "player"),
  buildBriefVisualDirection(brief),
);

if (!bg.includes("星辉遗迹") && !bg.includes("Creative brief")) {
  console.error("[FAIL] background prompt missing brief anchor");
  process.exit(1);
}
if (!sp.includes("Art direction") && !sp.includes("cel-shaded")) {
  console.error("[FAIL] sprite prompt missing brief art direction");
  process.exit(1);
}

console.log("[OK] qa:brief-asset-cohesion");
