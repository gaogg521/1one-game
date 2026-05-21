import { z } from "zod";
import {
  buildChildrenBriefExtractUser,
  CHILDREN_BRIEF_EXTRACT_SYSTEM,
  CHILDREN_FORBIDDEN_PRESETS,
} from "@/lib/children-novel-creative";
import { parseChildrenTargetAge, type ChildrenTargetAge } from "@/lib/children-age-length";
import { detectBriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { llmJson, getProviderModelCascade } from "@/lib/llm";
import { PRODUCT } from "@/lib/product-config";
import {
  NOVEL_CREATIVE_BRIEF_SCHEMA,
  type NovelCreativeBrief,
} from "@/lib/literary-brief/novel-types";

const LLM_CHILDREN_PARTIAL = z.object({
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

const CHILDREN_BRIEF_JSON_SCHEMA = {
  name: "children_story_creative_brief",
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

function mergeChildrenBrief(
  base: NovelCreativeBrief,
  patch: z.infer<typeof LLM_CHILDREN_PARTIAL>,
): NovelCreativeBrief {
  const uniq = (a: string[], b?: string[]) =>
    Array.from(new Set([...a, ...(b ?? []), ...CHILDREN_FORBIDDEN_PRESETS])).slice(0, 16);
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
    writingStyle: patch.writingStyle?.length ? patch.writingStyle : base.writingStyle,
    narrativeHints: uniq(base.narrativeHints, patch.narrativeHints),
    negatives: uniq(base.negatives, patch.negatives),
    expandSource: "pack+llm",
  };
}

export async function llmExpandChildrenBrief(
  base: NovelCreativeBrief,
  targetAge: ChildrenTargetAge,
): Promise<NovelCreativeBrief> {
  if (!PRODUCT.novel.creativeBriefLlm) return base;

  const models = getProviderModelCascade();
  if (!models.length) return base;

  const age = parseChildrenTargetAge(targetAge);
  const title = base.title?.trim() || base.userPrompt.trim().slice(0, 20);
  const timeoutMs = Math.max(4_000, Math.min(28_000, PRODUCT.novel.briefExpandTimeoutMs));

  for (const model of models.slice(0, 2)) {
    try {
      const res = await llmJson({
        model,
        system: CHILDREN_BRIEF_EXTRACT_SYSTEM,
        user: buildChildrenBriefExtractUser(title, base.userPrompt, age),
        temperature: 0.4,
        mode: "json_schema",
        jsonSchema: CHILDREN_BRIEF_JSON_SCHEMA,
        timeoutMs,
      });
      if (!res.ok || !res.raw || typeof res.raw !== "object") continue;
      const parsed = LLM_CHILDREN_PARTIAL.safeParse(res.raw);
      if (!parsed.success) continue;
      const merged = mergeChildrenBrief(base, parsed.data);
      const checked = NOVEL_CREATIVE_BRIEF_SCHEMA.safeParse(merged);
      if (checked.success) return checked.data;
    } catch {
      continue;
    }
  }
  return base;
}
