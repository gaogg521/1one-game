export type {
  DebugCheckResult,
  DebugProtocol,
  DebugProtocolEntry,
  TemplateArchetype,
  TemplateArchetypeId,
} from "@/lib/opengame-skills/types";
export { OPERONE_DEBUG_PROTOCOL } from "@/lib/opengame-skills/debug-protocol";
export {
  buildDebugSkillRepairHints,
  getDebugProtocolEntryCount,
  matchDebugSkillReactive,
  runDebugSkillPipeline,
  runDebugSkillProactive,
  type DebugSkillPipelineResult,
} from "@/lib/opengame-skills/debug-skill";
export {
  listTemplateArchetypeIds,
  resolveTemplateArchetype,
  TEMPLATE_ARCHETYPES,
} from "@/lib/opengame-skills/template-archetypes";
export {
  classifyPromptComplexity,
  shouldSkipTemplateFirstForPrompt,
  type OpenGameGenerationTier,
  type PromptComplexityResult,
} from "@/lib/opengame-skills/complexity-route";
export {
  readOpenGameAgenticRouteMode,
  resolveAgenticPlayRoute,
  shouldUseDedicatedSceneForTemplateFirst,
  stampAgenticPlayRoute,
  stripAgenticModuleForDedicatedRoute,
  type AgenticPlayRoute,
  type OpenGameAgenticRouteMode,
  type ResolveAgenticPlayRouteOptions,
} from "@/lib/opengame-skills/play-route";
export { maybeVerifyAgenticModuleInBrowser } from "@/lib/opengame-skills/browser-bench-generate";
export {
  buildOpenGameRecapFromTrace,
  buildGameModelRecapFromTrace,
  extractGameModelRoute,
  summarizeOpenGameGeneration,
  type GameModelRouteSummary,
  type OpenGameGenerationSummary,
} from "@/lib/opengame-skills/generation-trace";
export {
  agenticBenchPath,
  browserBenchToDebugChecks,
  buildSpecForAgenticBench,
  decodeAgenticBenchPayload,
  encodeAgenticBenchPayload,
  runAgenticBrowserBench,
  type AgenticBrowserBenchProbe,
} from "@/lib/opengame-skills/browser-bench";
export {
  buildTemplateSkillRepairAppend,
  buildTemplateSkillSystemAppend,
  buildTemplateSkillUserAppend,
} from "@/lib/opengame-skills/template-skill";
