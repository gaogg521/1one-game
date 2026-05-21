import { z } from "zod";

export const COMIC_DIRECTOR_VERSION = 1 as const;

export const comicCharacterVisualSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  appearanceEn: z.string().min(12),
  outfitEn: z.string().min(8),
  hairEn: z.string().optional(),
  notes: z.string().optional(),
});

export const comicLocationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  descriptionEn: z.string().min(12),
});

export const comicPageBeatSchema = z.object({
  page: z.number().int().positive(),
  progressPercent: z.number().int().min(0).max(100),
  chapterRefs: z.string().optional(),
  mood: z.string().min(2),
  keyEvents: z.string().min(8),
});

export const comicDirectorPackSchema = z.object({
  version: z.literal(COMIC_DIRECTOR_VERSION),
  title: z.string().min(1),
  visualStyleEn: z.string().min(16),
  colorPalette: z.string().optional(),
  characters: z.array(comicCharacterVisualSchema).min(2).max(10),
  locations: z.array(comicLocationSchema).min(1).max(12),
  pageBeats: z.array(comicPageBeatSchema).min(1),
  taboos: z.array(z.string()).optional(),
});

export type ComicCharacterVisual = z.infer<typeof comicCharacterVisualSchema>;
export type ComicLocation = z.infer<typeof comicLocationSchema>;
export type ComicPageBeat = z.infer<typeof comicPageBeatSchema>;
export type ComicDirectorPack = z.infer<typeof comicDirectorPackSchema>;

export const comicShotTypeSchema = z.enum([
  "wide",
  "medium",
  "close",
  "over_shoulder",
  "extreme_close",
]);

export type ComicShotType = z.infer<typeof comicShotTypeSchema>;

export const comicPanelTextTypeSchema = z.enum([
  "dialogue",
  "narration",
  "inner",
  "scene_note",
  "time_place",
]);

export const comicStoryboardPanelSchema = z.object({
  scene: z.number().int().positive(),
  caption: z.string().min(1),
  textType: comicPanelTextTypeSchema.optional(),
  speaker: z.string().optional(),
  sourceSegmentIndex: z.number().int().min(0).optional(),
  sceneDescriptionEn: z.string().min(12),
  characterIds: z.array(z.string()).min(0).max(4),
  locationId: z.string().min(1),
  shotType: comicShotTypeSchema,
});

export type ComicStoryboardPanel = z.infer<typeof comicStoryboardPanelSchema>;

export function buildComicDirectorJsonSchema(pageCount: number) {
  return {
    name: "comic_director_pack",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        version: { type: "integer", const: COMIC_DIRECTOR_VERSION },
        title: { type: "string" },
        visualStyleEn: { type: "string" },
        colorPalette: { type: "string" },
        characters: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              appearanceEn: { type: "string" },
              outfitEn: { type: "string" },
              hairEn: { type: "string" },
              notes: { type: "string" },
            },
            required: ["id", "name", "appearanceEn", "outfitEn"],
          },
        },
        locations: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              descriptionEn: { type: "string" },
            },
            required: ["id", "name", "descriptionEn"],
          },
        },
        pageBeats: {
          type: "array",
          minItems: pageCount,
          maxItems: pageCount + 2,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              page: { type: "integer" },
              progressPercent: { type: "integer" },
              chapterRefs: { type: "string" },
              mood: { type: "string" },
              keyEvents: { type: "string" },
            },
            required: ["page", "progressPercent", "mood", "keyEvents"],
          },
        },
        taboos: { type: "array", items: { type: "string" } },
      },
      required: ["version", "title", "visualStyleEn", "characters", "locations", "pageBeats"],
    },
  };
}

export function buildComicStoryboardJsonSchema(chunkPages: number) {
  const panelSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      scene: { type: "integer" },
      sourceSegmentIndex: { type: "integer" },
      textType: {
        type: "string",
        enum: ["dialogue", "narration", "inner", "scene_note", "time_place"],
      },
      speaker: { type: "string" },
      caption: { type: "string" },
      sceneDescriptionEn: { type: "string" },
      characterIds: { type: "array", items: { type: "string" } },
      locationId: { type: "string" },
      shotType: {
        type: "string",
        enum: ["wide", "medium", "close", "over_shoulder", "extreme_close"],
      },
    },
    required: [
      "scene",
      "textType",
      "caption",
      "sceneDescriptionEn",
      "characterIds",
      "locationId",
      "shotType",
    ],
  };
  return {
    name: "comic_storyboard_chunk",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        pages: {
          type: "array",
          minItems: 1,
          maxItems: chunkPages,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              page: { type: "integer" },
              panels: {
                type: "array",
                minItems: 1,
                maxItems: 4,
                items: panelSchema,
              },
            },
            required: ["page", "panels"],
          },
        },
      },
      required: ["pages"],
    },
  };
}

export function parseComicDirectorPack(raw: unknown): ComicDirectorPack | null {
  const r = comicDirectorPackSchema.safeParse(raw);
  if (!r.success) return null;
  const beats = [...r.data.pageBeats].sort((a, b) => a.page - b.page);
  return { ...r.data, pageBeats: beats };
}
