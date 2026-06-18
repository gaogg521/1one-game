import type { CreativeBrief } from "@/lib/creative-brief/types";

/** Brief 提炼的视觉导演句，供背景/精灵/封面 prompt 共用（Phase D 视听一致） */
export type BriefVisualDirection = {
  logline: string;
  worldLine: string;
  sceneLine: string;
  unitsLine: string;
  styleLine: string;
  moodLine: string;
  vfxLine: string;
  negativesLine: string;
};

export function buildBriefVisualDirection(
  brief: CreativeBrief | null | undefined,
): BriefVisualDirection | null {
  if (!brief) return null;
  return {
    logline: brief.logline.slice(0, 240),
    worldLine: brief.world.slice(0, 280),
    sceneLine: (brief.scenes[0] ?? brief.world).slice(0, 200),
    unitsLine: brief.units.slice(0, 4).join(", "),
    styleLine: brief.artStyle.slice(0, 6).join(", "),
    moodLine: brief.mood.slice(0, 5).join(", "),
    vfxLine: brief.vfx.slice(0, 4).join(", "),
    negativesLine: brief.negatives.slice(0, 8).join(", "),
  };
}

/** 将 Brief 视觉锚点追加到文生图 prompt（与 key art 同源语义） */
export function appendBriefVisualDirection(base: string, dir: BriefVisualDirection | null): string {
  if (!dir) return base;
  const chunks = [
    base,
    `Creative brief — ${dir.logline}`,
    `World: ${dir.worldLine}`,
    `Scene focus: ${dir.sceneLine}`,
    dir.unitsLine ? `Key units: ${dir.unitsLine}` : "",
    `Art direction: ${dir.styleLine}`,
    `Mood: ${dir.moodLine}`,
    dir.vfxLine ? `VFX tone: ${dir.vfxLine}` : "",
    dir.negativesLine ? `Avoid: ${dir.negativesLine}` : "",
  ].filter(Boolean);
  return chunks.join(". ").slice(0, 3800);
}
