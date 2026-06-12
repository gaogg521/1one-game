export type {
  ArenaMode,
  GameTemplateDefinition,
  GodotRuntimeKey,
  PhaserRuntimeFamily,
  ResolvedTemplateRuntime,
  TemplateBlueprintKind,
} from "@/lib/game-templates/types";

export {
  GAME_TEMPLATE_IDS,
  getTemplateDefinition,
  godotExportTemplateIds,
  isGameTemplateId,
  listDiscoverTemplateIds,
  listTemplateDefinitions,
  resolveTemplateRuntime,
  type GameTemplateId,
} from "@/lib/game-templates/registry";

export {
  SAMPLE_TEMPLATE_OVERRIDES,
  inferTemplateFromPrompt,
  type InferTemplateOptions,
} from "@/lib/game-templates/infer";

export {
  buildGodotRuntimePayload,
  createPhaserSceneForSpec,
  isGodotExportSupportedForTemplate,
  phaserFamilyFor,
  specJsonForGodotExport,
  toPhaserPlaySpec,
  type GodotRuntimePayload,
} from "@/lib/game-templates/runtime";

export { buildLlmTemplateCatalogLines, llmTemplateIdEnum } from "@/lib/game-templates/llm-catalog";
