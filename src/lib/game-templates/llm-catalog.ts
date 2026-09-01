import { GAME_TEMPLATE_IDS } from "@/lib/game-templates/registry";
export function buildLlmTemplateCatalogLines(): string { return GAME_TEMPLATE_IDS.join(", "); }
export function llmTemplateIdEnum(): string[] { return [...GAME_TEMPLATE_IDS]; }
