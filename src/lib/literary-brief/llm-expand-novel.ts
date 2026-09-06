import { z } from "zod";
import { detectBriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { getNovelStyleTextModelCascade, llmJson } from "@/lib/llm";
import { runtimeLocaleGroup } from "@/lib/runtime-locale-routing";
import { PRODUCT } from "@/lib/product-config";
import { reasoningAwareTimeoutMs } from "@/lib/llm/openai-token-param";
import { coerceNovelBriefShape } from "@/lib/literary-brief/coerce-novel-brief";
import {
  NOVEL_CREATIVE_BRIEF_SCHEMA,
  type NovelCreativeBrief,
} from "@/lib/literary-brief/novel-types";

/** One reasoning-model call for this schema measured ~40s; leave real margin. */
const BRIEF_EXPAND_REASONING_BUDGET_MS = 75_000;

const LLM_NOVEL_PARTIAL = z.object({
  logline: z.string().optional(),
  setting: z.string().optional(),
  world: z.string().optional(),
  protagonist: z.string().optional(),
  characters: z.array(z.string()).optional(),
  antagonists: z.array(z.string()).optional(),
  coreConflict: z.string().optional(),
  protagonistGoal: z.string().optional(),
  plotBeats: z.array(z.string()).optional(),
  keyScenes: z.array(z.string()).optional(),
  tone: z.string().optional(),
  writingStyle: z.array(z.string()).optional(),
  narrativeHints: z.array(z.string()).optional(),
  negatives: z.array(z.string()).optional(),
});

const NOVEL_BRIEF_JSON_SCHEMA = {
  name: "novel_creative_brief",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      logline: { type: "string" },
      setting: { type: "string" },
      world: { type: "string" },
      protagonist: { type: "string" },
      characters: { type: "array", items: { type: "string" } },
      antagonists: { type: "array", items: { type: "string" } },
      coreConflict: { type: "string" },
      protagonistGoal: { type: "string" },
      plotBeats: { type: "array", items: { type: "string" } },
      keyScenes: { type: "array", items: { type: "string" } },
      tone: { type: "string" },
      writingStyle: { type: "array", items: { type: "string" } },
      narrativeHints: { type: "array", items: { type: "string" } },
      negatives: { type: "array", items: { type: "string" } },
    },
    required: [
      "logline",
      "setting",
      "world",
      "protagonist",
      "characters",
      "antagonists",
      "coreConflict",
      "protagonistGoal",
      "plotBeats",
      "keyScenes",
      "tone",
      "writingStyle",
      "narrativeHints",
      "negatives",
    ],
  },
} as const;

function mergeNovelBrief(base: NovelCreativeBrief, patch: z.infer<typeof LLM_NOVEL_PARTIAL>): NovelCreativeBrief {
  const uniq = (a: string[], b?: string[]) => Array.from(new Set([...a, ...(b ?? [])])).slice(0, 12);
  return {
    ...base,
    logline: patch.logline?.trim() || base.logline,
    setting: patch.setting?.trim() || base.setting,
    world: patch.world?.trim() || base.world,
    protagonist: patch.protagonist?.trim() || base.protagonist,
    characters: patch.characters?.length ? patch.characters : base.characters,
    antagonists: patch.antagonists?.length ? patch.antagonists : base.antagonists,
    coreConflict: patch.coreConflict?.trim() || base.coreConflict,
    protagonistGoal: patch.protagonistGoal?.trim() || base.protagonistGoal,
    plotBeats: patch.plotBeats?.length ? patch.plotBeats : base.plotBeats,
    keyScenes: patch.keyScenes?.length ? patch.keyScenes : base.keyScenes,
    tone: patch.tone?.trim() || base.tone,
    writingStyle: uniq(base.writingStyle, patch.writingStyle),
    narrativeHints: uniq(base.narrativeHints, patch.narrativeHints),
    negatives: uniq(base.negatives, patch.negatives),
    expandSource: "pack+llm",
  };
}

export async function llmExpandNovelBrief(
  base: NovelCreativeBrief,
  referenceSnippet?: string,
): Promise<NovelCreativeBrief> {
  if (!PRODUCT.novel.creativeBriefLlm) return base;

  // 创意 Brief 是小说流水线的一部分，必须与正文使用同一可配置模型池。
  const locale = base.inputLocale ?? detectBriefInputLocale(base.userPrompt);
  const models = getNovelStyleTextModelCascade(runtimeLocaleGroup(locale));
  if (!models.length) return base;

  const lang =
    locale === "zh"
      ? "简体中文"
      : locale === "zh-Hant"
        ? "繁體中文"
      : locale === "ja"
        ? "日本語"
        : locale === "ms"
          ? "Bahasa Melayu"
          : locale === "th"
            ? "ภาษาไทย"
            : "English";
  /**
   * Brief expansion is an enhancement with a working fallback: if it does not
   * land, generation proceeds from the static genre pack. It therefore must
   * not dominate the creator's wait.
   *
   * Measured on this gateway: one minimax-2-7 call for this schema is ~40s,
   * but the old shape — two models, each retrying a second response_format —
   * turned that into 3-6 minutes that usually ended in the fallback anyway.
   * One model, one attempt, a budget that fits a reasoning model, and skip.
   */
  const baseTimeoutMs = Math.max(PRODUCT.novel.briefExpandTimeoutMs, BRIEF_EXPAND_REASONING_BUDGET_MS);
  const refBlock = referenceSnippet?.trim()
    ? `\n【参考摘录】\n${referenceSnippet.trim().slice(0, 1200)}\n`
    : "";

  const system =
    `你是资深中文网文策划编辑。用户给出书名、类型或一句话创意，你要扩写为可连载小说的「创意构思 Brief」。\n` +
    `用${lang}书写所有字段。只输出 JSON，不要 markdown。\n` +
    "这是小说/网文策划，不是游戏设计：禁止出现 templateId、HUD、关卡、玩家单位、2D 网页小游戏、director 四幕等游戏术语。\n" +
    "侧重：时代背景、人物关系、核心矛盾、情节节拍、章节奏与文风。";

  // One candidate only: a second model doubles the wait for an optional step.
  for (const model of models.slice(0, 1)) {
    try {
      const res = await llmJson({
        model,
        scene: "novel",
        localeGroup: runtimeLocaleGroup(locale),
        system,
        user:
          `类型：${base.genreLabel}\n` +
          (base.title ? `书名：${base.title}\n` : "") +
          `用户输入：\n${base.userPrompt}\n` +
          `骨架 logline：${base.logline}\n` +
          refBlock +
          "\n请输出完整 JSON，写得更具体、更可执行。",
        temperature: 0.35,
        mode: "json_schema",
        jsonSchema: NOVEL_BRIEF_JSON_SCHEMA,
        // Optional step: one mode only. A json_object retry would double the wait.
        singleModeOnly: true,
        timeoutMs: reasoningAwareTimeoutMs(model, baseTimeoutMs),
      });
      // Every failure below used to `continue` silently, so a brief that never
      // got LLM-expanded was indistinguishable from one that was — the caller
      // just saw expandSource="pack". Keep the fallback, but say why.
      const debug = process.env.LITERARY_DEBUG === "1";
      if (!res.ok || !res.raw || typeof res.raw !== "object") {
        if (debug) console.error(`[literary-debug] novel brief model=${model} call failed: ${res.ok ? "empty raw" : res.error}`);
        continue;
      }
      const parsed = LLM_NOVEL_PARTIAL.safeParse(coerceNovelBriefShape(res.raw));
      if (!parsed.success) {
        if (debug) console.error(`[literary-debug] novel brief model=${model} partial schema invalid: ${JSON.stringify(parsed.error.issues.slice(0, 5))}`);
        continue;
      }
      const merged = mergeNovelBrief(base, parsed.data);
      const checked = NOVEL_CREATIVE_BRIEF_SCHEMA.safeParse(merged);
      if (checked.success) return checked.data;
      if (debug) console.error(`[literary-debug] novel brief model=${model} merged brief invalid: ${JSON.stringify(checked.error.issues.slice(0, 5))}`);
    } catch (e) {
      if (process.env.LITERARY_DEBUG === "1") console.error(`[literary-debug] novel brief model=${model} threw: ${(e as Error).message}`);
      continue;
    }
  }
  return base;
}
