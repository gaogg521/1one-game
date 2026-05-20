import { z } from "zod";

export const NOVEL_PIPELINE_VERSION = 1 as const;

export const novelCharacterSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  traits: z.string().min(1),
  relationships: z.string().optional(),
});

export const novelBibleSchema = z.object({
  title: z.string().min(1),
  worldSetting: z.string().min(8),
  tone: z.string().optional(),
  characters: z.array(novelCharacterSchema).min(2).max(12),
  coreConflict: z.string().min(8),
  endingDirection: z.string().min(8),
  taboos: z.array(z.string()).optional(),
});

export const chapterPlanItemSchema = z.object({
  num: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().min(8),
  phase: z.enum(["opening", "rising", "climax", "resolution"]),
  targetChars: z.number().int().positive().optional(),
});

export const novelChapterPlanSchema = z.object({
  chapters: z.array(chapterPlanItemSchema).min(3),
});

export type NovelCharacter = z.infer<typeof novelCharacterSchema>;
export type NovelBible = z.infer<typeof novelBibleSchema>;
export type ChapterPlanItem = z.infer<typeof chapterPlanItemSchema>;
export type NovelChapterPlan = z.infer<typeof novelChapterPlanSchema>;

export type NovelGenerationMeta = {
  version: typeof NOVEL_PIPELINE_VERSION;
  bible: NovelBible;
  chapterPlan: NovelChapterPlan;
  segmentCount: number;
  createdAt: string;
};

export function buildNovelBibleJsonSchema() {
  return {
    name: "novel_bible",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        worldSetting: { type: "string" },
        tone: { type: "string" },
        characters: {
          type: "array",
          minItems: 2,
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              role: { type: "string" },
              traits: { type: "string" },
              relationships: { type: "string" },
            },
            required: ["name", "role", "traits"],
          },
        },
        coreConflict: { type: "string" },
        endingDirection: { type: "string" },
        taboos: { type: "array", items: { type: "string" } },
      },
      required: ["title", "worldSetting", "characters", "coreConflict", "endingDirection"],
    },
  };
}

export function buildNovelChapterPlanJsonSchema(chapterCount: number) {
  return {
    name: "novel_chapter_plan",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        chapters: {
          type: "array",
          minItems: chapterCount,
          maxItems: chapterCount + 2,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              num: { type: "integer" },
              title: { type: "string" },
              summary: { type: "string" },
              phase: { type: "string", enum: ["opening", "rising", "climax", "resolution"] },
              targetChars: { type: "integer" },
            },
            required: ["num", "title", "summary", "phase"],
          },
        },
      },
      required: ["chapters"],
    },
  };
}

export function parseNovelBible(raw: unknown): NovelBible | null {
  const r = novelBibleSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export function parseNovelChapterPlan(raw: unknown): NovelChapterPlan | null {
  const r = novelChapterPlanSchema.safeParse(raw);
  if (!r.success) return null;
  const chapters = [...r.data.chapters].sort((a, b) => a.num - b.num);
  return { chapters };
}

export function serializeNovelGenerationMeta(meta: NovelGenerationMeta): string {
  return JSON.stringify(meta);
}

export function parseNovelGenerationMeta(raw: string | null | undefined): NovelGenerationMeta | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const o = j as Record<string, unknown>;
    const bible = parseNovelBible(o.bible);
    const chapterPlan = parseNovelChapterPlan(o.chapterPlan);
    if (!bible || !chapterPlan) return null;
    return {
      version: NOVEL_PIPELINE_VERSION,
      bible,
      chapterPlan,
      segmentCount: typeof o.segmentCount === "number" ? o.segmentCount : 0,
      createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
