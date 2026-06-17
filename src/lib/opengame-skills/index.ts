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
  buildTemplateSkillRepairAppend,
  buildTemplateSkillSystemAppend,
  buildTemplateSkillUserAppend,
} from "@/lib/opengame-skills/template-skill";
