import { z } from "zod";

export const CREATIVE_PROJECT_KINDS = ["game", "novel", "comic"] as const;
export const CREATIVE_VISIBILITIES = ["private", "pending_review", "public", "hidden"] as const;
export const CREATIVE_REVISION_CAUSES = ["user_prompt", "generate", "refine", "import", "restore"] as const;
export const CREATIVE_ARTIFACT_MEDIA_TYPES = ["text", "json", "image", "audio", "binary", "report"] as const;

export const CreativeProjectInputSchema = z.object({
  ownerKey: z.string().min(1).max(160),
  kind: z.enum(CREATIVE_PROJECT_KINDS),
  title: z.string().trim().min(1).max(160),
  visibility: z.enum(CREATIVE_VISIBILITIES).default("private"),
  legacyType: z.string().trim().min(1).max(32).optional(),
  legacyId: z.string().trim().min(1).max(128).optional(),
});

export const CreativeRevisionInputSchema = z.object({
  cause: z.enum(CREATIVE_REVISION_CAUSES),
  parentRevisionId: z.string().min(1).max(96).optional(),
  intent: z.unknown().optional(),
  summary: z.string().trim().min(1).max(800).optional(),
});

export const CreativeArtifactInputSchema = z.object({
  kind: z.string().trim().min(1).max(64),
  mediaType: z.enum(CREATIVE_ARTIFACT_MEDIA_TYPES),
  content: z.unknown().optional(),
  textContent: z.string().max(2_000_000).optional(),
  storageUri: z.string().trim().max(2048).optional(),
  contentHash: z.string().trim().min(8).max(128).optional(),
  provider: z.string().trim().max(128).optional(),
  sourceArtifactId: z.string().trim().max(96).optional(),
  metadata: z.unknown().optional(),
}).superRefine((value, ctx) => {
  if (value.content === undefined && !value.textContent && !value.storageUri) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "artifact requires content, textContent, or storageUri" });
  }
});

export const ArtifactWritePayloadSchema = z.object({
  artifact: CreativeArtifactInputSchema,
});

export const ComicPanelJobPayloadSchema = z.object({
  comicId: z.string().min(1).max(96),
  ownerKey: z.string().min(1).max(160),
  regenerate: z.boolean().default(false),
  page: z.number().int().positive().optional(),
  panel: z.number().int().positive().optional(),
  uiLocale: z.string().min(2).max(16).default("zh-Hans"),
});

/** Immutable game-asset input kept with the revision that requested it. */
export const GameAssetJobPayloadSchema = z.object({
  projectId: z.string().min(1).max(96),
  ownerKey: z.string().min(1).max(160),
  spec: z.unknown(),
  brief: z.unknown().nullable().optional(),
  uiLocale: z.string().min(2).max(16).default("zh-Hans"),
});

export type CreativeProjectInput = z.infer<typeof CreativeProjectInputSchema>;
export type CreativeRevisionInput = z.infer<typeof CreativeRevisionInputSchema>;
export type CreativeArtifactInput = z.infer<typeof CreativeArtifactInputSchema>;
export type ComicPanelJobPayload = z.infer<typeof ComicPanelJobPayloadSchema>;
export type GameAssetJobPayload = z.infer<typeof GameAssetJobPayloadSchema>;
