import { z } from "zod";
import type { GameSpec } from "@/lib/game-spec";

export const PARSED_INTENT_SCHEMA = z.object({
  genreId: z.string(),
  genreLabel: z.string(),
  templateHint: z.enum([
    "auto",
    "avoider",
    "collector",
    "survivor",
    "platformer",
    "towerDefense",
    "shooter",
  ]),
  tone: z.enum(["epic", "casual", "hardcore", "cozy", "neutral"]),
  difficulty: z.enum(["easy", "normal", "hard"]),
  keywords: z.array(z.string()),
});

export type ParsedIntent = z.infer<typeof PARSED_INTENT_SCHEMA>;

export const CREATIVE_BRIEF_SCHEMA = z.object({
  version: z.literal(1),
  userPrompt: z.string(),
  logline: z.string(),
  packId: z.string(),
  packLabel: z.string(),
  intent: PARSED_INTENT_SCHEMA,
  world: z.string(),
  scenes: z.array(z.string()),
  factions: z.array(z.string()),
  units: z.array(z.string()),
  weapons: z.array(z.string()),
  vfx: z.array(z.string()),
  artStyle: z.array(z.string()),
  mood: z.array(z.string()),
  gameplayHints: z.array(z.string()),
  themeHints: z.object({
    backgroundColor: z.string().optional(),
    playerColor: z.string().optional(),
    hazardColor: z.string().optional(),
    collectibleColor: z.string().optional(),
    musicProfile: z.enum(["organic", "pulse", "minimal", "neon"]).optional(),
  }),
  negatives: z.array(z.string()),
  expandSource: z.enum(["pack", "pack+llm", "llm"]),
  /** 用户原话主要语言（规则检测） */
  inputLocale: z.enum(["zh", "en", "ja"]).optional(),
});

export type CreativeBrief = z.infer<typeof CREATIVE_BRIEF_SCHEMA>;

export type BriefMedium = "game" | "novel" | "comic";

export type ExpandCreativeBriefParams = {
  prompt: string;
  templateHint?: "auto" | GameSpec["templateId"];
  referenceSnippet?: string;
  /** 跳过 LLM 扩写（测试 / 离线） */
  skipLlm?: boolean;
  /** 目标媒介：决定注入块格式与 LLM 系统提示 */
  medium?: BriefMedium;
  /** 强制使用指定题材知识包 id（小说类型标签等） */
  packId?: string;
};

export type ExpandCreativeBriefResult = {
  brief: CreativeBrief;
  /** 注入 GameSpec 生成管线的完整用户侧上下文 */
  augmentedPrompt: string;
  oneLineSummary: string;
};
