import { GAME_TEMPLATE_IDS, type GameTemplateId } from "@/lib/game-templates/registry";
export type InferTemplateOptions = { fallback?: GameTemplateId; hint?: string; sampleId?: string };
export const SAMPLE_TEMPLATE_OVERRIDES: Partial<Record<string, GameTemplateId>> = {};
export function inferTemplateFromPrompt(prompt: string, opts: InferTemplateOptions = {}): GameTemplateId {
  const normalized = prompt.toLowerCase();
  return GAME_TEMPLATE_IDS.find((id) => normalized.includes(id.replaceAll("-", " ").toLowerCase())) ?? opts.fallback ?? "avoider";
}
