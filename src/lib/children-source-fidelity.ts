import { isUntitledLabel } from "@/lib/i18n/chapter-labels";
import { getChildrenAgeTier, parseChildrenTargetAge, type ChildrenTargetAge } from "@/lib/children-age-length";
import type { ChildrenInputKind } from "@/lib/children-novel-creative";

/** 儿童叙事模式：典故类默认复述；日常口语可走听后延伸 */
export type ChildrenNarrativeMode = "retelling" | "listener_extension";

export const CHILDREN_NARRATIVE_MODE_LABELS: Record<ChildrenNarrativeMode, string> = {
  retelling: "典故复述（主人公讲源故事）",
  listener_extension: "听后延伸（孩子+伙伴学寓意）",
};

export function normalizeChildrenNarrativeMode(raw: string | undefined): ChildrenNarrativeMode | null {
  return raw === "retelling" || raw === "listener_extension" ? raw : null;
}

/** 从 buildChildrenBriefSeed / buildNovelBriefSeed 提取家长原话 */
export function extractChildrenParentInputFromSeed(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return "";
  for (const line of trimmed.split(/\n/)) {
    const parentMatch = line.match(/^家长输入(?:[（(][^）)]*[）)])?[：:]\s*(.+)$/);
    if (parentMatch?.[1]) return parentMatch[1].trim();
    const enMatch = line.match(/^Parent input:\s*(.+)$/i);
    if (enMatch?.[1]) return enMatch[1].trim();
    const msMatch = line.match(/^Input ibu bapa:\s*(.+)$/i);
    if (msMatch?.[1]) return msMatch[1].trim();
    const thMatch = line.match(/^ข้อมูลจากผู้ปกครอง:\s*(.+)$/);
    if (thMatch?.[1]) return thMatch[1].trim();
  }
  if (!/^(书名|Title|类型|Genre|读者|Target readers|Sasaran pembaca|กลุ่มผู้อ่าน)[：:]/m.test(trimmed)) {
    return trimmed;
  }
  const lastLine = trimmed.split(/\n/).pop()?.trim();
  return lastLine || trimmed;
}

/** 家长输入是否像完整故事梗概（而非一句日常话/成语/典故名） */
export function looksLikeDirectStoryConcept(userLine: string): boolean {
  const t = userLine.trim();
  if (t.length < 10) return false;
  if (/的故事$|童话$|寓言$/.test(t)) return true;
  const hasCharacter = /小(?:白)?兔|大灰狼|小(?:熊|猫|狗|狐|松鼠|象|猴|鸭|鸟|猪|羊)|(?:狼|狐狸|老虎|狮子)(?:想|要|在)/.test(
    t,
  );
  const hasPlot =
    /遇见|碰到|遇到|脱险|机智|聪明|打败|逃跑|冒险|采|找|帮助|分享|吵架|和好|想吃|抓住|逃脱/.test(t);
  if (hasCharacter && hasPlot) return true;
  if (hasPlot && t.split(/[，,。；;]/).filter(Boolean).length >= 2) return true;
  return false;
}

/**
 * 源材料类：3 岁及以上默认复述；0-3 与日常口语用听后延伸。
 * 完整故事梗概（如「小白兔遇大灰狼脱险」）走直接复述，不用「孩子听完再学」模板。
 */
export function resolveChildrenNarrativeMode(
  userLine: string,
  kind: ChildrenInputKind,
  targetAge: ChildrenTargetAge | number,
  explicit?: string,
): ChildrenNarrativeMode {
  const fromBrief = normalizeChildrenNarrativeMode(explicit);
  if (fromBrief) return fromBrief;
  if (!requiresChildrenSourceFidelity(kind)) {
    return looksLikeDirectStoryConcept(userLine) ? "retelling" : "listener_extension";
  }
  const tier = getChildrenAgeTier(parseChildrenTargetAge(targetAge));
  if (tier.tierId === "infant_0_3") return "listener_extension";
  return "retelling";
}

/** 从输入推断典故主人公称呼（通用，非典故白名单） */
export function childrenProtagonistHintFromUserPrompt(userLine: string): string | undefined {
  const t = userLine.trim();
  const animalMatch = t.match(
    /(小(?:白)?兔(?:子|兔)?|大灰狼|小(?:熊|猫|狗|狐|松鼠|象|猴|鸭|鸟|猪|羊)(?:子|子|宝宝)?|(?:狼|狐狸|老虎|狮子)(?:想|要|在|把)?)/,
  );
  if (animalMatch?.[1]) return animalMatch[1].replace(/(?:想|要|在|把)$/, "");
  const verbLead = t.match(
    /([\u4e00-\u9fff]{2,4})(?:移山|尝百草|让梨|填海|补天|射日|治水|奔月|磨针|学步|射箭|画蛇|负荆|完璧)/,
  );
  if (verbLead?.[1]) return verbLead[1];
  const core = childrenCoreSubjectFromUserPrompt(userLine)
    .replace(/的故事|传说|典故|成语/g, "")
    .trim();
  if (core.length >= 2 && core.length <= 5) return core;
  return undefined;
}

export function defaultCastForNarrativeMode(
  userLine: string,
  mode: ChildrenNarrativeMode,
): string {
  if (mode === "retelling") {
    const who = childrenProtagonistHintFromUserPrompt(userLine);
    return who ? `${who}和故事里帮忙的人` : "故事里的主人公和帮手";
  }
  return "听故事的孩子和小伙伴";
}

/**
 * 儿童短篇「源材料忠实」— 举一反三的通用规则，不针对单篇典故硬编码。
 * 依据：家长 userPrompt + Brief.inputKind（LLM 分类优先，启发式兜底）。
 */

export function normalizeChildrenInputKind(raw: string | undefined): ChildrenInputKind | null {
  const k = raw?.trim();
  if (
    k === "daily_phrase" ||
    k === "idiom" ||
    k === "classic_allusion" ||
    k === "classic_quote" ||
    k === "mixed"
  ) {
    return k;
  }
  return null;
}

/** 是否需要忠于家长输入的典故/成语/名句（不可擅自换主题） */
export function requiresChildrenSourceFidelity(kind: ChildrenInputKind): boolean {
  return kind === "classic_allusion" || kind === "idiom" || kind === "classic_quote" || kind === "mixed";
}

/** 启发式分类（Brief 未给出 inputKind 时兜底） */
export function inferChildrenInputKind(userLine: string): ChildrenInputKind {
  const t = userLine.trim();
  if (!t) return "daily_phrase";

  // 完整故事梗概（小白兔遇狼等）是家长原创情节，不是成语/典故名
  if (looksLikeDirectStoryConcept(t)) return "daily_phrase";

  if (/神话|传说|典故|古代|传统|经典|名著|寓言|民间故事|历史人物|史传|演义/.test(t)) {
    return "classic_allusion";
  }
  if (/成语/.test(t) && /故事|典故|传说|神话/.test(t)) return "mixed";
  if (/成语/.test(t) || /^[\u4e00-\u9fff]{4}$/.test(t.replace(/\s/g, ""))) return "idiom";
  if (/子曰|诗词|古诗|名句|古文|之乎者也|国学|经典名句/.test(t)) return "classic_quote";
  if (looksLikeNamedClassicSubject(t)) return "classic_allusion";

  return "daily_phrase";
}

export function resolveChildrenInputKind(
  userLine: string,
  briefInputKind?: string,
): ChildrenInputKind {
  return normalizeChildrenInputKind(briefInputKind) ?? inferChildrenInputKind(userLine);
}

/** 短而专名的输入，多半是典故/神话/成语主题 */
export function looksLikeNamedClassicSubject(text: string): boolean {
  const s = text.trim().replace(/\s+/g, "");
  if (s.length < 3 || s.length > 28) return false;
  if (looksLikeDirectStoryConcept(s)) return false;
  if (/我|你|不想|幼儿园|玩具|妈妈|爸爸|宝贝|今天|明天|分享|吵架|害怕|遇见|碰到|遇到|脱险|机智|采|躲|逃/.test(s)) {
    return false;
  }
  if (/神话|传说|典故|成语|故事|古代|经典|传统/.test(s)) return true;
  const cjk = s.replace(/[^\u4e00-\u9fff]/g, "");
  return cjk.length >= 3 && cjk.length / Math.max(s.length, 1) >= 0.75 && !/[吗呢啊吧呀]/.test(s);
}

/** 从家长输入提取核心主题（≤12 字），用作书名建议与偏离检测 */
export function childrenCoreSubjectFromUserPrompt(userLine: string): string {
  const t = userLine.trim().replace(/\s+/g, "");
  if (!t) return "";
  const clause = t.split(/[，,。；;：:\n]/)[0]?.trim() ?? t;
  const core = clause.length <= 12 ? clause : clause.slice(0, 12);
  return core;
}

/** 提取家长输入中的关键词（连续中文 ≥2 字），用于重叠检测 */
export function childrenPromptKeywords(userLine: string): string[] {
  const t = userLine.trim();
  const bigrams: string[] = [];
  const cjk = t.replace(/[^\u4e00-\u9fff]/g, "");
  for (let i = 0; i < cjk.length - 1; i += 1) {
    bigrams.push(cjk.slice(i, i + 2));
  }
  const core = childrenCoreSubjectFromUserPrompt(userLine);
  if (core.length >= 2) bigrams.unshift(core.slice(0, Math.min(4, core.length)));
  return [...new Set(bigrams)].filter((w) => w.length >= 2);
}

/** 生成标题是否明显偏离家长输入主题 */
export function isChildrenTitleOffTopic(
  userLine: string,
  generatedTitle: string,
  kind?: ChildrenInputKind,
): boolean {
  const k = kind ?? resolveChildrenInputKind(userLine);
  if (!requiresChildrenSourceFidelity(k)) return false;
  const title = generatedTitle.trim();
  if (!title || isUntitledLabel(title)) return false;

  const keywords = childrenPromptKeywords(userLine);
  if (keywords.some((w) => title.includes(w))) return false;

  const core = childrenCoreSubjectFromUserPrompt(userLine);
  if (core.length >= 2) {
    const shared = [...core].filter((c) => title.includes(c)).length;
    if (shared >= Math.min(2, Math.ceil(core.length * 0.35))) return false;
  }

  return true;
}

/** 文本是否包含家长输入中的片段（用于低幼 sanitize 勿误删典故词） */
export function textAlignsWithUserPrompt(fragment: string, userLine: string): boolean {
  const f = fragment.trim();
  const u = userLine.trim();
  if (!f || !u) return false;
  if (u.includes(f) || f.includes(u.slice(0, Math.min(8, u.length)))) return true;
  return childrenPromptKeywords(u).some((w) => f.includes(w));
}

/** Brief / 正文：源材料忠实约束（通用表述，不举单篇例子） */
export function childrenSourceFidelityBlock(
  userLine: string,
  kind?: ChildrenInputKind,
  targetAge?: ChildrenTargetAge | number,
  narrativeMode?: ChildrenNarrativeMode,
): string {
  const k = kind ?? resolveChildrenInputKind(userLine);
  if (!requiresChildrenSourceFidelity(k)) return "";

  const mode =
    narrativeMode ??
    (targetAge !== undefined
      ? resolveChildrenNarrativeMode(userLine, k, targetAge)
      : "retelling");
  const core = childrenCoreSubjectFromUserPrompt(userLine);
  const kindLabel =
    k === "idiom"
      ? "成语"
      : k === "classic_quote"
        ? "名句/古文"
        : k === "mixed"
          ? "成语或典故"
          : "典故/传统故事/神话";

  const modeRule =
    mode === "retelling"
      ? `- **叙事模式：典故复述**。三句话情节须直接讲源典故（主人公是典故中人物，有起因→坚持→结局），禁止改成「现代孩子听完故事再模仿」。`
      : `- **叙事模式：听后延伸**。可用听故事的孩子 + 1 伙伴，在听完/想象典故后温和学寓意。`;

  return [
    "【源材料忠实 — 必须遵守】",
    `- 家长输入为${kindLabel}，Brief 与正文必须围绕其**核心人物、情节与寓意**，不得擅自换成无关的现代原创故事。`,
    modeRule,
    core ? `- 核心主题：「${core}」；书名与三句话情节须能一眼看出与此相关。` : "",
    `- 低幼可童趣化、省略恐怖与血腥细节，但**不得改题**。`,
    `- 安全：不描写中毒吐血、模仿危险行为；可用「问大人」作温和收束。`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** 日常口语中的完整故事梗概：三拍直接讲家长描述的情节 */
export function defaultStoryBeatsForDirectPlot(
  userLine: string,
  beatCount: number,
  infant: boolean,
): string[] {
  const who = childrenProtagonistHintFromUserPrompt(userLine) || "小动物";
  const clauses = userLine
    .trim()
    .replace(/的故事$|童话$|寓言$/, "")
    .split(/[，,。；;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (clauses.length >= 2) {
    const beats = clauses.map((c) => (c.length <= 28 ? c : c.slice(0, 28)));
    while (beats.length < beatCount) beats.push(beats[beats.length - 1]!);
    return beats.slice(0, beatCount);
  }
  if (infant) {
    return [`${who}出门做一件事`, `${who}遇到小麻烦`, `${who}安全回家`].slice(0, beatCount);
  }
  const beats = [
    `${who}开始一段小冒险`,
    `${who}遇到难题或对手`,
    `${who}想办法解决并平安`,
  ];
  return beats.slice(0, beatCount);
}

/** 典故复述：三拍直接讲源故事线 */
export function defaultStoryBeatsForRetelling(
  userLine: string,
  beatCount: number,
  infant: boolean,
): string[] {
  const core = childrenCoreSubjectFromUserPrompt(userLine);
  const who = childrenProtagonistHintFromUserPrompt(userLine) || "主人公";
  const hint = core || "这个故事";
  if (infant) {
    return [
      `${who}遇到一件难事情`,
      `${who}每天坚持做一点点`,
      "难事情慢慢变小了",
    ].slice(0, beatCount);
  }
  const beats = [
    `${hint}里，${who}被大山/难题挡住了去路`,
    `${who}带着家人日复一日挖呀搬呀不放弃`,
    "大家齐心协力，难题慢慢变小、路通了",
  ];
  while (beats.length < beatCount) beats.push(beats[beats.length - 1]!);
  return beats.slice(0, beatCount);
}

/** 听后延伸：孩子听完源材料再学寓意 */
export function defaultStoryBeatsForListenerExtension(
  userLine: string,
  beatCount: number,
  infant: boolean,
): string[] {
  const core = childrenCoreSubjectFromUserPrompt(userLine);
  const hint = core ? `「${core}」` : "家长说的典故或成语";
  if (infant) {
    return [`听${hint}的小故事`, "温柔感受到故事里的善意"].slice(0, beatCount);
  }
  const beats = [
    `听/认识${hint}`,
    "用童趣方式感受故事里的善意与道理",
    "记得遇事问大人、更安全",
  ];
  while (beats.length < beatCount) beats.push(beats[beats.length - 1]!);
  return beats.slice(0, beatCount);
}

export function defaultStoryBeatsForSourceFidelity(
  userLine: string,
  beatCount: number,
  infant: boolean,
  mode: ChildrenNarrativeMode,
): string[] {
  return mode === "retelling"
    ? defaultStoryBeatsForRetelling(userLine, beatCount, infant)
    : defaultStoryBeatsForListenerExtension(userLine, beatCount, infant);
}

const LISTENER_STYLE_CAST =
  /听故事|小朋友|小可爱|朵朵|孩子.*(?:兔|松鼠|猫|狗)|(?:兔|松鼠|猫|狗).*伙伴/;

/** 复述模式下 cast/beats 被误写成「孩子听完再学」时纠正 */
export function coerceBriefToNarrativeMode(
  brief: {
    userPrompt: string;
    cast: string;
    storyBeats: string[];
    scene: string;
    inputKind: string;
    narrativeMode?: string;
    targetAge: number;
  },
): { cast: string; storyBeats: string[]; scene: string; narrativeMode: ChildrenNarrativeMode } {
  const kind = resolveChildrenInputKind(brief.userPrompt, brief.inputKind);
  const mode = resolveChildrenNarrativeMode(
    brief.userPrompt,
    kind,
    brief.targetAge,
    brief.narrativeMode,
  );
  const tier = getChildrenAgeTier(parseChildrenTargetAge(brief.targetAge));
  const beatCount = tier.tierId === "infant_0_3" ? 2 : 3;
  const infant = tier.tierId === "infant_0_3";

  let cast = brief.cast;
  let storyBeats = brief.storyBeats;
  let scene = brief.scene;

  if (mode === "retelling") {
    const who = childrenProtagonistHintFromUserPrompt(brief.userPrompt);
    if (LISTENER_STYLE_CAST.test(cast) && who && !cast.includes(who)) {
      cast = defaultCastForNarrativeMode(brief.userPrompt, "retelling");
    }
    const firstBeat = storyBeats[0] ?? "";
    if (/^听|听完|听故事|认识.*故事/.test(firstBeat) && who) {
      storyBeats = defaultStoryBeatsForRetelling(brief.userPrompt, beatCount, infant);
    }
    const core = childrenCoreSubjectFromUserPrompt(brief.userPrompt);
    if (core && /听故事|山脚望|望山|草地玩/.test(scene) && who) {
      scene = `${who}和难题挡路的地方`;
    }
  }

  return { cast, storyBeats, scene, narrativeMode: mode };
}
