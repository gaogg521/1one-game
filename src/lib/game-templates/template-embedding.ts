import type { GameTemplateId } from "@/lib/game-templates/registry";
export function resolveTemplateSemantic(_text: string): { templateId: GameTemplateId; confidence: number; source: "none" | "keyword" } { return { templateId: "avoider", confidence: 0, source: "none" }; }
