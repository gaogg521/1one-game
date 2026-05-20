import { z } from "zod";

/** 网文创意构思 Brief（与游戏 CreativeBrief 无关） */
export const NOVEL_CREATIVE_BRIEF_SCHEMA = z.object({
  version: z.literal(1),
  userPrompt: z.string(),
  title: z.string().optional(),
  genreId: z.string(),
  genreLabel: z.string(),
  logline: z.string(),
  setting: z.string(),
  world: z.string(),
  protagonist: z.string(),
  characters: z.array(z.string()),
  antagonists: z.array(z.string()),
  coreConflict: z.string(),
  protagonistGoal: z.string(),
  plotBeats: z.array(z.string()),
  keyScenes: z.array(z.string()),
  tone: z.string(),
  writingStyle: z.array(z.string()),
  narrativeHints: z.array(z.string()),
  negatives: z.array(z.string()),
  expandSource: z.enum(["pack", "pack+llm", "llm"]),
  inputLocale: z.enum(["zh", "en", "ja"]).optional(),
});

export type NovelCreativeBrief = z.infer<typeof NOVEL_CREATIVE_BRIEF_SCHEMA>;

export type ExpandNovelBriefParams = {
  /** 用户原话或 buildNovelBriefSeed 全文 */
  prompt: string;
  title?: string;
  genreId?: string;
  skipLlm?: boolean;
};

export type ExpandNovelBriefResult = {
  brief: NovelCreativeBrief;
  augmentedPrompt: string;
  oneLineSummary: string;
};

export type NovelBriefUserRevision = {
  logline?: string;
  world?: string;
  addonNotes?: string;
};
