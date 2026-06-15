import { z } from "zod";
import { childrenTierBriefSkeletonContract } from "@/lib/children-age-tier-prompts";
import {
  childrenCoreSubjectFromUserPrompt,
  childrenProtagonistHintFromUserPrompt,
  defaultCastForNarrativeMode,
  defaultStoryBeatsForDirectPlot,
  defaultStoryBeatsForSourceFidelity,
  extractChildrenParentInputFromSeed,
  inferChildrenInputKind,
  looksLikeDirectStoryConcept,
  requiresChildrenSourceFidelity,
  resolveChildrenNarrativeMode,
} from "@/lib/children-source-fidelity";
import {
  getChildrenAgeTier,
  parseChildrenTargetAge,
  type ChildrenTargetAge,
} from "@/lib/children-age-length";
import {
  CHILDREN_FORBIDDEN_PRESETS,
  CHILDREN_INPUT_KIND_LABELS,
  type ChildrenInputKind,
} from "@/lib/children-novel-creative";

/** 儿童短篇专用构思（与网文 NovelCreativeBrief 完全分离） */
export const CHILDREN_CREATIVE_BRIEF_SCHEMA = z.object({
  kind: z.literal("children"),
  version: z.literal(1),
  userPrompt: z.string(),
  title: z.string().optional(),
  genreLabel: z.string(),
  targetAge: z.number(),
  inputKind: z.string(),
  narrativeMode: z.enum(["retelling", "listener_extension"]).optional(),
  interpretation: z.string(),
  cast: z.string(),
  storyBeats: z.array(z.string()),
  scene: z.string(),
  moral: z.string(),
  avoid: z.array(z.string()),
  expandSource: z.enum(["seed", "seed+llm"]),
});

export type ChildrenCreativeBrief = z.infer<typeof CHILDREN_CREATIVE_BRIEF_SCHEMA>;

export const CHILDREN_BRIEF_LIGHT_JSON_SCHEMA = {
  name: "children_story_brief_light",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      inputKind: { type: "string" },
      narrativeMode: {
        type: "string",
        enum: ["retelling", "listener_extension"],
      },
      interpretation: { type: "string" },
      cast: { type: "string" },
      storyBeats: { type: "array", items: { type: "string" } },
      scene: { type: "string" },
      moral: { type: "string" },
      avoid: { type: "array", items: { type: "string" } },
    },
    required: [
      "inputKind",
      "narrativeMode",
      "interpretation",
      "cast",
      "storyBeats",
      "scene",
      "moral",
      "avoid",
    ],
  },
} as const;

const CHILDREN_BRIEF_LLM_PARTIAL = z.object({
  inputKind: z.string(),
  narrativeMode: z.enum(["retelling", "listener_extension"]),
  interpretation: z.string(),
  cast: z.string(),
  storyBeats: z.array(z.string()),
  scene: z.string(),
  moral: z.string(),
  avoid: z.array(z.string()),
});

export type ChildrenBriefUserRevision = {
  /** 三句话故事，分号分隔 */
  storyLine?: string;
  addonNotes?: string;
};

export type ExpandChildrenBriefParams = {
  prompt: string;
  title?: string;
  childrenTargetAge?: number;
  skipLlm?: boolean;
  userRevision?: ChildrenBriefUserRevision | null;
};

export type ExpandChildrenBriefResult = {
  brief: ChildrenCreativeBrief;
  augmentedPrompt: string;
  oneLineSummary: string;
};

export function childrenInputKindLabel(kind: string | undefined): string {
  if (!kind?.trim()) return "日常口语";
  const k = kind.trim() as ChildrenInputKind;
  return CHILDREN_INPUT_KIND_LABELS[k] ?? kind.trim();
}

export function parseChildrenCastLine(cast: string): { protagonist: string; partner: string | null } {
  const raw = cast.trim();
  if (!raw) return { protagonist: "小可爱", partner: null };
  const parts = raw
    .split(/[+＋、,，]|和|与|跟/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return { protagonist: parts[0] ?? raw, partner: null };
  return { protagonist: parts[0]!, partner: parts[1] ?? null };
}

export function buildChildrenBriefSeed(
  title: string,
  userLine: string,
  targetAge: ChildrenTargetAge,
): string {
  const tier = getChildrenAgeTier(targetAge);
  return [
    `书名：${title.trim()}`,
    `类型：儿童短篇`,
    `读者：${tier.label}（${tier.stage}）· 正文 ${tier.charRangeLabel}`,
    `家长输入：${userLine.trim()}`,
  ].join("\n");
}

export function childrenBriefFromLlmFields(
  base: Pick<
    ChildrenCreativeBrief,
    "userPrompt" | "title" | "genreLabel" | "targetAge" | "expandSource"
  >,
  fields: z.infer<typeof CHILDREN_BRIEF_LLM_PARTIAL>,
): ChildrenCreativeBrief {
  return CHILDREN_CREATIVE_BRIEF_SCHEMA.parse({
    kind: "children",
    version: 1,
    ...base,
    inputKind: fields.inputKind.trim(),
    narrativeMode: fields.narrativeMode,
    interpretation: fields.interpretation.trim(),
    cast: fields.cast.trim(),
    storyBeats: fields.storyBeats.map((b) => b.trim()).filter(Boolean),
    scene: fields.scene.trim(),
    moral: fields.moral.trim(),
    avoid: fields.avoid.map((a) => a.trim()).filter(Boolean),
  });
}

export function seedChildrenCreativeBrief(
  userPrompt: string,
  title: string | undefined,
  targetAge: ChildrenTargetAge,
): ChildrenCreativeBrief {
  const age = parseChildrenTargetAge(targetAge);
  const tier = getChildrenAgeTier(age);
  const beatCount = tier.tierId === "infant_0_3" ? 2 : 3;
  const userLine = extractChildrenParentInputFromSeed(userPrompt);
  const inputKind = inferChildrenInputKind(userLine);
  const directPlot = looksLikeDirectStoryConcept(userLine);
  const fidelity = requiresChildrenSourceFidelity(inputKind) && !directPlot;
  const narrativeMode = resolveChildrenNarrativeMode(userLine, inputKind, age);
  const infant = tier.tierId === "infant_0_3";
  const beats = fidelity
    ? defaultStoryBeatsForSourceFidelity(userLine, beatCount, infant, narrativeMode)
    : directPlot || narrativeMode === "retelling"
      ? defaultStoryBeatsForDirectPlot(userLine, beatCount, infant)
      : infant
        ? ["暖暖的阳光下，轻轻摸一摸小叶子", "笑着和伙伴说晚安"]
        : ["和伙伴完成一件小事", "感受到小小的善意", "遇到困难问大人"].slice(0, beatCount);

  const core = childrenCoreSubjectFromUserPrompt(userLine);
  const who = childrenProtagonistHintFromUserPrompt(userLine);

  return CHILDREN_CREATIVE_BRIEF_SCHEMA.parse({
    kind: "children",
    version: 1,
    userPrompt: userLine.trim(),
    title: title?.trim() || (core.length >= 2 ? core.slice(0, 12) : undefined),
    genreLabel: "儿童短篇",
    targetAge: age,
    inputKind,
    narrativeMode,
    interpretation: fidelity
      ? "源材料（典故/成语/名句），待 AI 童趣解读"
      : directPlot
        ? `家长描述的故事：${core || userLine.slice(0, 40)}`
        : "家长输入待 AI 解读",
    cast: directPlot || narrativeMode === "retelling"
      ? who
        ? `${who}和故事里的其他角色`
        : defaultCastForNarrativeMode(userLine, "retelling")
      : defaultCastForNarrativeMode(userLine, "listener_extension"),
    storyBeats: beats,
    scene:
      fidelity && narrativeMode === "retelling" && core
        ? `${childrenProtagonistHintFromUserPrompt(userLine) ?? "主人公"}遇到难题的地方`
        : fidelity && core
          ? `围绕「${core}」讲故事`
          : directPlot
            ? userLine.match(/森林|幼儿园|家里|草地|河边|山上|田野|花园|厨房|房间|学校/)?.[0] ??
              `${who ?? "小动物"}活动的地方`
            : "温馨日常场景",
    moral: fidelity ? "领会寓意，遇事问大人" : directPlot ? "机智应对，遇事问大人" : "温柔探索，遇到困难问大人",
    avoid: [...CHILDREN_FORBIDDEN_PRESETS.slice(0, 4)],
    expandSource: "seed",
  });
}

export function buildChildrenBriefLightExtractUser(
  title: string,
  userLine: string,
  targetAge: ChildrenTargetAge,
): string {
  const tier = getChildrenAgeTier(parseChildrenTargetAge(targetAge));
  const beatCount = tier.tierId === "infant_0_3" ? 2 : 3;
  const interpMax =
    tier.tierId === "infant_0_3" ? 80 : tier.tierId === "kindergarten_3_6" ? 100 : 180;
  const age = parseChildrenTargetAge(targetAge);
  const inputKind = inferChildrenInputKind(userLine);
  const narrativeMode = resolveChildrenNarrativeMode(userLine, inputKind, age);
  const skeleton = childrenTierBriefSkeletonContract(age, narrativeMode);

  return [
    `书名：${title}`,
    `读者档位：${tier.label}（${tier.stage}）· 正文 ${tier.charRangeLabel}`,
    `家长输入：\n${userLine}`,
    `叙事模式（须遵守）：${narrativeMode === "retelling" ? "典故复述 — 直接讲源故事，主人公是典故人物" : "听后延伸 — 孩子+伙伴学寓意"}`,
    skeleton,
    "",
    "请只输出下列 JSON 字段：",
    `- inputKind：据家长输入判断 daily_phrase | idiom | classic_allusion | classic_quote | mixed（专名典故/神话/成语勿标 daily_phrase）`,
    `- narrativeMode：${narrativeMode}（源材料 3 岁+ 用 retelling；0-3 日常用 listener_extension）`,
    `- interpretation：≤${interpMax} 字`,
    narrativeMode === "retelling"
      ? `- cast：典故核心主人公 + 故事内帮手（如愚公和家人）；禁止现代孩子顶替主角`
      : `- cast：听故事的孩子 + 1 伙伴；禁止无关路人导师`,
    narrativeMode === "retelling"
      ? `- storyBeats：${beatCount} 条，直接讲源典故起因→坚持→结局，禁止「听完故事再模仿」`
      : `- storyBeats：${beatCount} 条，每条 ≤28 字`,
    `- scene：单场景一句`,
    `- moral：结尾寓意一句`,
    `- avoid：3–6 条`,
  ].join("\n");
}

export function parseChildrenBriefLlmOutput(raw: unknown): z.infer<typeof CHILDREN_BRIEF_LLM_PARTIAL> | null {
  const parsed = CHILDREN_BRIEF_LLM_PARTIAL.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
