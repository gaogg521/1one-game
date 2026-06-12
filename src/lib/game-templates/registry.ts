import { GAME_TEMPLATE_DEFINITIONS } from "@/lib/game-templates/definitions";
import type {
  GameTemplateDefinition,
  ResolvedTemplateRuntime,
} from "@/lib/game-templates/types";

export const GAME_TEMPLATE_IDS = GAME_TEMPLATE_DEFINITIONS.map((d) => d.id) as [
  string,
  ...string[],
];

export type GameTemplateId = (typeof GAME_TEMPLATE_IDS)[number];

const BY_ID = new Map<string, GameTemplateDefinition>(
  GAME_TEMPLATE_DEFINITIONS.map((d) => [d.id, d]),
);

export function isGameTemplateId(id: string): id is GameTemplateId {
  return BY_ID.has(id);
}

export function getTemplateDefinition(id: string): GameTemplateDefinition {
  return BY_ID.get(id) ?? BY_ID.get("avoider")!;
}

export function resolveTemplateRuntime(templateId: string): ResolvedTemplateRuntime {
  const def = getTemplateDefinition(templateId);
  return {
    templateId: def.id,
    phaser: def.phaser,
    godot: def.godot,
    arenaMode: def.arenaMode,
    godotExport: def.godotExport,
    blueprint: def.blueprint,
  };
}

/** Godot Web 导出支持的 templateId 列表（语义 id，非 runtime key） */
export function godotExportTemplateIds(): readonly string[] {
  return GAME_TEMPLATE_DEFINITIONS.filter((d) => d.godotExport).map((d) => d.id);
}

export function listTemplateDefinitions(): readonly GameTemplateDefinition[] {
  return GAME_TEMPLATE_DEFINITIONS;
}

/** 供 discover / games 筛选项 */
export function listDiscoverTemplateIds(): readonly GameTemplateId[] {
  return GAME_TEMPLATE_IDS;
}
