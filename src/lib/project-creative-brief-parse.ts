import { CREATIVE_BRIEF_SCHEMA, type CreativeBrief } from "@/lib/creative-brief/types";

export function parseCreativeBriefBody(raw: unknown): CreativeBrief | null {
  const parsed = CREATIVE_BRIEF_SCHEMA.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function serializeCreativeBrief(brief: CreativeBrief): string {
  return JSON.stringify(brief);
}
