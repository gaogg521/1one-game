import { z } from "zod";
import { llmJson } from "@/lib/llm";
import { getNovelStyleTextModelCascade } from "@/lib/model-config";
import { resolveGameModelRoute } from "@/lib/game-model-route";
import { PRODUCT } from "@/lib/product-config";
import type { CreativeBrief } from "@/lib/creative-brief/types";
import { detectBriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { buildBriefLlmSystemPrompt } from "@/lib/creative-brief/locale-prompts";
import type { BriefMedium } from "@/lib/creative-brief/types";
import { CREATIVE_BRIEF_SCHEMA } from "@/lib/creative-brief/types";

const LLM_BRIEF_PARTIAL = z.object({
  logline: z.string().optional(),
  world: z.string().optional(),
  scenes: z.array(z.string()).optional(),
  factions: z.array(z.string()).optional(),
  units: z.array(z.string()).optional(),
  weapons: z.array(z.string()).optional(),
  vfx: z.array(z.string()).optional(),
  artStyle: z.array(z.string()).optional(),
  mood: z.array(z.string()).optional(),
  gameplayHints: z.array(z.string()).optional(),
  themeHints: z
    .object({
      backgroundColor: z.string().optional(),
      playerColor: z.string().optional(),
      hazardColor: z.string().optional(),
      collectibleColor: z.string().optional(),
      musicProfile: z.enum(["organic", "pulse", "minimal", "neon"]).optional(),
    })
    .optional(),
  negatives: z.array(z.string()).optional(),
});

const BRIEF_JSON_SCHEMA = {
  name: "creative_brief_expand",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      logline: { type: "string" },
      world: { type: "string" },
      scenes: { type: "array", items: { type: "string" } },
      factions: { type: "array", items: { type: "string" } },
      units: { type: "array", items: { type: "string" } },
      weapons: { type: "array", items: { type: "string" } },
      vfx: { type: "array", items: { type: "string" } },
      artStyle: { type: "array", items: { type: "string" } },
      mood: { type: "array", items: { type: "string" } },
      gameplayHints: { type: "array", items: { type: "string" } },
      themeHints: {
        type: "object",
        additionalProperties: false,
        properties: {
          backgroundColor: { type: "string" },
          playerColor: { type: "string" },
          hazardColor: { type: "string" },
          collectibleColor: { type: "string" },
          musicProfile: { type: "string", enum: ["organic", "pulse", "minimal", "neon"] },
        },
        required: [],
      },
      negatives: { type: "array", items: { type: "string" } },
    },
    required: [
      "logline",
      "world",
      "scenes",
      "factions",
      "units",
      "weapons",
      "vfx",
      "artStyle",
      "mood",
      "gameplayHints",
      "themeHints",
      "negatives",
    ],
  },
} as const;

function mergeBrief(base: CreativeBrief, patch: z.infer<typeof LLM_BRIEF_PARTIAL>): CreativeBrief {
  const uniq = (a: string[], b?: string[]) => Array.from(new Set([...a, ...(b ?? [])])).slice(0, 12);
  return {
    ...base,
    logline: patch.logline?.trim() || base.logline,
    world: patch.world?.trim() || base.world,
    scenes: patch.scenes?.length ? patch.scenes : base.scenes,
    factions: uniq(base.factions, patch.factions),
    units: uniq(base.units, patch.units),
    weapons: uniq(base.weapons, patch.weapons),
    vfx: uniq(base.vfx, patch.vfx),
    artStyle: uniq(base.artStyle, patch.artStyle),
    mood: uniq(base.mood, patch.mood),
    gameplayHints: uniq(base.gameplayHints, patch.gameplayHints),
    themeHints: { ...base.themeHints, ...(patch.themeHints ?? {}) },
    negatives: uniq(base.negatives, patch.negatives),
    expandSource: "pack+llm",
  };
}

/** 在题材包骨架上用 LLM 润色与补细节；失败则返回原 brief */
function briefLlmEnabled(medium: BriefMedium): boolean {
  if (medium === "novel") return PRODUCT.novel.creativeBriefLlm;
  if (medium === "comic") return PRODUCT.comic.creativeBriefLlm;
  return PRODUCT.game.creativeBriefLlm;
}

function briefExpandTimeoutMs(medium: BriefMedium): number {
  if (medium === "novel") return PRODUCT.novel.briefExpandTimeoutMs;
  if (medium === "comic") return PRODUCT.comic.briefExpandTimeoutMs;
  return PRODUCT.game.briefExpandTimeoutMs;
}

export async function llmExpandCreativeBrief(
  base: CreativeBrief,
  referenceSnippet?: string,
  medium: BriefMedium = "game",
): Promise<CreativeBrief> {
  if (!briefLlmEnabled(medium)) return base;

  const route =
    medium === "game"
      ? resolveGameModelRoute({
          prompt: base.userPrompt,
          hasReferenceAssets: Boolean(referenceSnippet?.trim()),
        })
      : null;
  const models =
    medium === "game"
      ? (route?.models ?? [])
      : getNovelStyleTextModelCascade();
  if (!models.length) return base;

  const timeoutMs = Math.max(4_000, Math.min(28_000, briefExpandTimeoutMs(medium)));
  const locale = base.inputLocale ?? detectBriefInputLocale(base.userPrompt);
  const system = buildBriefLlmSystemPrompt(locale, medium);
  const refBlock = referenceSnippet?.trim()
    ? `\n【参考素材摘录】\n${referenceSnippet.trim().slice(0, 1200)}\n`
    : "";

  for (const model of models.slice(0, 2)) {
    try {
      const res = await llmJson({
        model,
        ...(route ? { scene: route.scene } : {}),
        system,
        user:
          `用户原话：\n${base.userPrompt}\n\n` +
          `已选题材包：${base.packLabel}\n` +
          `已解析倾向：模板 ${base.intent.templateHint}，调性 ${base.intent.tone}，难度 ${base.intent.difficulty}\n` +
          `知识包骨架 logline：${base.logline}\n` +
          refBlock +
          `\n请输出完整 JSON 字段（在骨架基础上写得更具体、更「可做游戏」）。`,
        temperature: 0.35,
        mode: "json_schema",
        jsonSchema: BRIEF_JSON_SCHEMA,
        timeoutMs,
      });
      if (!res.ok || !res.raw || typeof res.raw !== "object") continue;
      const parsed = LLM_BRIEF_PARTIAL.safeParse(res.raw);
      if (!parsed.success) continue;
      const merged = mergeBrief(base, parsed.data);
      const checked = CREATIVE_BRIEF_SCHEMA.safeParse(merged);
      if (checked.success) return checked.data;
    } catch {
      continue;
    }
  }
  return base;
}
