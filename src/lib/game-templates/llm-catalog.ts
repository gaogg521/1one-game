import { listTemplateDefinitions } from "@/lib/game-templates/registry";

/** 供 LLM / generate-spec 系统提示：自动随 registry 扩展 */
export function buildLlmTemplateCatalogLines(): string {
  return listTemplateDefinitions()
    .map((d) => `  · ${d.id}：${d.llmSummary ?? d.defaultSubtitle ?? d.id}`)
    .join("\n");
}

export function llmTemplateIdEnum(): string[] {
  return listTemplateDefinitions().map((d) => d.id);
}
