import { z } from "zod";
import { GAME_TEMPLATE_IDS } from "@/lib/game-templates/registry";

export const GAMEPLAY_EVENT_NAMES = ["start", "first_action", "first_minute", "end", "retry"] as const;

export const GameplayEventPayloadSchema = z.object({
  projectId: z.string().min(1).max(96).optional(),
  creativeRevisionId: z.string().min(1).max(96).optional(),
  templateId: z.enum(GAME_TEMPLATE_IDS),
  event: z.enum(GAMEPLAY_EVENT_NAMES),
  sessionId: z.string().min(12).max(96),
  elapsedMs: z.number().int().min(0).max(4 * 60 * 60 * 1000).optional(),
  activeMs: z.number().int().min(0).max(4 * 60 * 60 * 1000).optional(),
  actionCount: z.number().int().min(0).max(1_000_000).optional(),
  deviceClass: z.enum(["mobile", "desktop"]).optional(),
  orientation: z.enum(["portrait", "landscape"]).optional(),
  touchCapable: z.boolean().optional(),
  score: z.number().int().min(0).max(10_000_000).optional(),
  won: z.boolean().optional(),
  verticalSliceScore: z.number().int().min(0).max(100).optional(),
}).superRefine((value, ctx) => {
  if (value.creativeRevisionId && !value.projectId) {
    ctx.addIssue({ code: "custom", path: ["creativeRevisionId"], message: "revision_requires_project" });
  }
});

export type GameplayEventPayload = z.infer<typeof GameplayEventPayloadSchema>;
