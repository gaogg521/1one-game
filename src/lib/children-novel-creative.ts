import {
  childrenSourceFidelityBlock,
  inferChildrenInputKind,
  resolveChildrenNarrativeMode,
  type ChildrenNarrativeMode,
} from "@/lib/children-source-fidelity";
import {
  childrenAgeLabel,
  childrenCharRangeLabel,
  childrenMaxCharsForAge,
  childrenMinCharsForAge,
  childrenStageLabel,
  childrenTargetCharsForAge,
  getChildrenAgeTier,
  parseChildrenTargetAge,
  type ChildrenTargetAge,
} from "@/lib/children-age-length";
import {
  childrenTierBriefRules,
  childrenTierBriefSkeletonContract,
  childrenTierCreationRules,
  childrenTierNarrativeCraft,
  childrenTierOutputFormatBlock,
  childrenTierRoleLine,
} from "@/lib/children-age-tier-prompts";
import { buildChildrenBriefLightExtractUser } from "@/lib/literary-brief/children-brief-types";

/** @deprecated 请用 getChildrenAgeTier(age).interpretMark */
export const CHILDREN_INTERPRETATION_MARK = "【创意/典故深度解读】";

export const CHILDREN_PRODUCT_POSITIONING = `【产品定位】
专为家长打造的 0–10 岁儿童分龄专属故事创作 AI。五档读者（0-3 / 3-6 / 6-8 / 9 / 10 岁），全面兼容日常话语、成语、国学典故与传统故事。`;

export const CHILDREN_INPUT_KIND_LABELS = {
  daily_phrase: "日常口语/随口一句",
  idiom: "成语",
  classic_allusion: "国学典故/古代传统故事",
  classic_quote: "古文短句/经典名句",
  mixed: "混合输入",
} as const;

export type ChildrenInputKind = keyof typeof CHILDREN_INPUT_KIND_LABELS;

export const CHILDREN_FORBIDDEN_PRESETS = [
  "禁止使用任何平台或行业常见的模板角色名（如「小兔豆豆」「小熊宝宝」「小狐狸奇奇」等）",
  "禁止套用固定默认场景（如「总是那片森林」「固定幼儿园」等），场景须由本次创意推导",
  "禁止照搬其他作品的知名角色或情节桥段",
  "禁止恐怖、暴力、血腥、成人化讽刺",
  "禁止篡改成语/典故原本寓意（低幼档可极致简化表达，但寓意方向不得相反）",
];

export const CHILDREN_THEME_HINTS = [
  "勇敢",
  "分享",
  "友谊",
  "诚实",
  "亲情",
  "克服恐惧",
  "接纳自己",
  "帮助他人",
  "管理情绪",
  "好奇心",
  "守规矩",
  "感恩",
  "谦让",
  "守信",
  "孝顺",
  "勤学",
  "担当",
  "尊师",
];

export function childrenLanguageBand(
  age: ChildrenTargetAge,
): "infant" | "kindergarten" | "primary" | "upper_primary" {
  const id = getChildrenAgeTier(age).tierId;
  if (id === "infant_0_3") return "infant";
  if (id === "kindergarten_3_6") return "kindergarten";
  if (id === "primary_6_8") return "primary";
  return "upper_primary";
}

export function childrenInnerMonologueHint(age: ChildrenTargetAge): string {
  const band = childrenLanguageBand(age);
  if (band === "infant") return "不写内心独白，用动作与叠词表现情绪";
  if (band === "kindergarten") return "内心：最多 1 句短心里话，禁止两条心想/又想";
  if (band === "primary") return "内心线：开篇、尝试中、结局后各至少 1 句";
  return "内心与行动交织，体现成长与思考";
}

export function buildChildrenBriefExtractSystem(
  targetAge: ChildrenTargetAge,
  userLine?: string,
): string {
  const age = parseChildrenTargetAge(targetAge);
  const kind = userLine?.trim() ? inferChildrenInputKind(userLine) : "daily_phrase";
  const narrativeMode = userLine?.trim()
    ? resolveChildrenNarrativeMode(userLine, kind, age)
    : "listener_extension";
  const skeleton = childrenTierBriefSkeletonContract(age, narrativeMode);
  const fidelity = userLine?.trim()
    ? childrenSourceFidelityBlock(userLine, kind, age, narrativeMode)
    : "";
  return `${childrenTierRoleLine(age)}

${CHILDREN_PRODUCT_POSITIONING}

${childrenTierBriefRules(age)}
${skeleton ? `\n${skeleton}\n` : ""}
${fidelity ? `\n${fidelity}\n` : ""}
【共通要求】
- 只输出轻量 JSON：interpretation、cast、storyBeats、scene、moral、avoid（不要网文大纲字段）
- Brief 供 100–900 字正文扩写，不是成人小说；低幼档尤其要短、少角色、少转折
- 禁止模板角色名；典故输入时须忠于典故，不得偷换主题`;
}

/** @deprecated 使用 buildChildrenBriefExtractSystem(age) */
export const CHILDREN_BRIEF_EXTRACT_SYSTEM = buildChildrenBriefExtractSystem(4);

/** @deprecated 请用 buildChildrenBriefLightExtractUser */
export function buildChildrenBriefExtractUser(
  title: string,
  userLine: string,
  targetAge: ChildrenTargetAge,
): string {
  return buildChildrenBriefLightExtractUser(title, userLine, targetAge);
}

export function getChildrenNovelSystemPrompt(
  targetAge: ChildrenTargetAge,
  userLine?: string,
): string {
  const age = parseChildrenTargetAge(targetAge);
  const tier = getChildrenAgeTier(age);
  const minChars = childrenMinCharsForAge(age);
  const maxChars = childrenMaxCharsForAge(age);
  const target = childrenTargetCharsForAge(age);
  const kind = userLine?.trim() ? inferChildrenInputKind(userLine) : "daily_phrase";
  const narrativeMode: ChildrenNarrativeMode = userLine?.trim()
    ? resolveChildrenNarrativeMode(userLine, kind, age)
    : "listener_extension";
  const fidelity = userLine?.trim()
    ? childrenSourceFidelityBlock(userLine, kind, age, narrativeMode)
    : "";

  return `${childrenTierRoleLine(age)}

${CHILDREN_PRODUCT_POSITIONING}

${childrenTierCreationRules(age)}

${childrenTierNarrativeCraft(age, narrativeMode)}
${fidelity ? `\n${fidelity}\n` : ""}

【读者】${childrenAgeLabel(age)} · ${childrenStageLabel(age)} · 正文 ${childrenCharRangeLabel(age)}（严格 ${minChars}–${maxChars} 字，优先 ${target} 字）

【安全】积极温暖；禁止恐怖暴力；低幼档无冲突惊吓。

${childrenTierOutputFormatBlock(age)}`;
}

export function buildChildrenNovelUserMessage(
  pipelinePrompt: string,
  suggestedTitle: string | undefined,
  targetAge: ChildrenTargetAge,
): string {
  const age = parseChildrenTargetAge(targetAge);
  const tier = getChildrenAgeTier(age);
  const t = suggestedTitle?.trim();
  return [
    `请把下方 Brief 写成**${tier.label}**儿童成稿，严格按本档三块输出格式顺序：`,
    `${tier.interpretMark} → ${tier.bodyMark} → ${tier.closingMark}`,
    "",
    pipelinePrompt.trim(),
    t ? `\n（家长建议书名：${t}，可在故事首行用 ≤12 字童趣标题）` : "",
    `\n正文须 ${childrenCharRangeLabel(age)}，优先约 ${tier.targetChars} 字；解读与结尾块不计入正文字数。`,
  ].join("\n");
}

export const CHILDREN_NOVEL_LLM_TEMPERATURE = 0.72;

export const CHILDREN_ADDON_NOTES_PLACEHOLDER =
  "例如：随口一句「宝贝不肯分享玩具」；或成语「守株待兔」；或典故「孔融让梨」…";

/** 入库正文：解读 + 故事 + 结尾块 */
export function formatChildrenPublishedContent(
  interpretation: string,
  body: string,
  closing: string,
  targetAge: ChildrenTargetAge,
): string {
  const tier = getChildrenAgeTier(parseChildrenTargetAge(targetAge));
  const parts: string[] = [];
  const interp = interpretation.trim();
  const story = body.trim();
  const end = closing.trim();
  if (interp) parts.push(`${tier.interpretMark}\n${interp}`);
  if (story) parts.push(`${tier.bodyMark}\n${story}`);
  if (end) parts.push(`${tier.closingMark}\n${end}`);
  return parts.join("\n\n");
}
