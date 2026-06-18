/**
 * Phase D：模板 BGM 资源槽（public/game-bgm/{templateId}-{profile}.ogg 存在则混音，否则纯 procedural）
 */
import type { GameSpec } from "@/lib/game-spec";
import type { MusicProfile } from "@/lib/cohesive-presentation";

export function resolveTemplateBgmUrl(
  templateId: GameSpec["templateId"],
  profile: MusicProfile,
): string {
  return `/game-bgm/${templateId}-${profile}.ogg`;
}

/** 按模板微调 procedural BPM（无文件时仍提升听感差异） */
export function templateBpmBias(templateId: GameSpec["templateId"]): number {
  switch (templateId) {
    case "coaster":
    case "racing":
      return 8;
    case "puzzle":
    case "farming":
      return -12;
    case "shooter":
    case "towerDefense":
      return 4;
    case "physics":
      return -6;
    default:
      return 0;
  }
}
