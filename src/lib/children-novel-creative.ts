import {
  childrenAgeLabel,
  childrenMaxCharsForAge,
  parseChildrenTargetAge,
  type ChildrenTargetAge,
} from "@/lib/children-age-length";

/** 禁止套用的模板角色/场景（写入 Brief 禁忌与生成 prompt） */
export const CHILDREN_FORBIDDEN_PRESETS = [
  "禁止使用任何平台或行业常见的模板角色名（如「小兔豆豆」「小熊宝宝」「小狐狸奇奇」等）",
  "禁止套用固定默认场景（如「总是那片森林」「固定幼儿园」等），场景须由本次创意推导",
  "禁止照搬其他作品的知名角色或情节桥段",
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
];

/** 3岁以下、4–5 岁为学龄前；6–10 岁为学龄 */
export function childrenLanguageBand(age: ChildrenTargetAge): "preschool" | "school" {
  return age <= 5 ? "preschool" : "school";
}

export function childrenLanguageRules(age: ChildrenTargetAge): string {
  const band = childrenLanguageBand(age);
  const common = [
    "- 句子短小，朗朗上口，适合家长朗读",
    "- 全文至少 1 处感官描写（如「手心有点湿」「软软的草地」「蜂蜜甜甜的」）",
  ];
  if (band === "preschool") {
    return [
      ...common,
      "- 读者偏 3–5 岁：多用重复句式、拟声词（哗啦啦、咚咚）、简单叠词（圆圆的、亮亮的）",
      "- 词汇极简，一段一事，情绪直白",
    ].join("\n");
  }
  return [
    ...common,
    "- 读者偏 6–10 岁：适当增加「因为/所以/但是」等连接词",
    "- 可写更具体的动作与表情，仍须温暖易懂",
  ].join("\n");
}

/** Brief 扩写 LLM：从家长一句话提取主题/角色/情节 */
export const CHILDREN_BRIEF_EXTRACT_SYSTEM = `你是儿童绘本与睡前故事策划。家长给出书名与一句话创意，你需要**只根据该创意**做结构化提取与扩写构思。

【必须完成】
1. 从创意中推断可能的**主题**（如勇敢、分享、友谊、诚实、亲情、克服恐惧、接纳自己、帮助他人、管理情绪等，选 1–3 个最贴合的）
2. 推断可能的**角色类型**（小动物、小朋友、小物件、小怪物等均可；角色名与形象须原创，贴合创意）
3. 推断**小困境/情节方向**（具体问题是什么、孩子/角色如何尝试解决）

【硬性禁止】
- 不得引入创意中未暗示的模板角色（如小兔豆豆、小熊宝宝等）
- 不得写游戏、网文连载、系统面板、长篇大纲话术
- 用简体中文 JSON 字段书写`;

export function buildChildrenBriefExtractUser(
  title: string,
  userLine: string,
  targetAge: ChildrenTargetAge,
): string {
  const maxChars = childrenMaxCharsForAge(targetAge);
  return [
    `书名：${title}`,
    `目标读者：${childrenAgeLabel(targetAge)}`,
    `正文目标字数：约 ${maxChars} 字（成稿允许 ±50 字浮动）`,
    `家长一句话创意：\n${userLine}`,
    "",
    "请输出 JSON。logline 用 1–2 句概括「主题+困境+温暖结局方向」；protagonist 写原创主角（类型+名字，名字 2–6 字）；characters 写 1–3 个配角类型；coreConflict 写「小问题/困境」；plotBeats 固定为三步：① 遇到小问题 ② 尝试解决 ③ 温暖闭环结局；narrativeHints 须包含「主题：…」「角色类型：…」「感官点建议：…」；negatives 须包含禁止模板角色。",
  ].join("\n");
}

export function getChildrenNovelSystemPrompt(targetAge: ChildrenTargetAge): string {
  const age = parseChildrenTargetAge(targetAge);
  const maxChars = childrenMaxCharsForAge(age);
  const minChars = Math.max(100, maxChars - 50);
  const ageLabel = childrenAgeLabel(age);

  return `你是一位**儿童睡前故事**作家。家长已提供经策划扩写的创意 Brief；请你**完全依据 Brief 与原创元素**写作，适合朗读给 **${ageLabel}** 孩子。

【创作流程】
1. 以 Brief 中的主题、原创角色、小困境为核心，**自由创作**完整故事；勿使用任何默认角色、默认场景。
2. 结构：**遇到一个小问题/困境 → 尝试解决（可有一次小挫折）→ 温暖闭环的结局**。
3. 角色 2–4 个，名字与形象须来自 Brief，可爱鲜明，便于画 Q 版漫画。

【语言】
${childrenLanguageRules(age)}

【篇幅】
- 正文汉字约 **${maxChars}** 字（允许 ${minChars}–${maxChars + 50} 字）
- ${childrenChapterHintInline(age, maxChars)}

【安全】
禁止血腥、恐怖、色情、辱骂、复杂阴谋；冲突柔软，结局有安全感。

【输出格式 — 必须严格遵守，不要输出其它说明】
第一行起按以下三块输出（不要用 markdown 代码块）：

【故事标题】
（不超过 12 个汉字，童趣易懂）

【正文】
（小说正文；可用「=== 第1章 标题 ===」分 1–3 章；对话用「」；不要在此块写家长提示）

【家长共读】
（一句话，**不超过 20 个汉字**，说明共读时可问孩子什么或关注什么）`;
}

function childrenChapterHintInline(age: ChildrenTargetAge, maxChars: number): string {
  const chapters = maxChars <= 300 ? "1–2" : "2–3";
  return `建议 ${chapters} 章，章标题 2–8 字`;
}

export function buildChildrenNovelUserMessage(
  pipelinePrompt: string,
  suggestedTitle: string | undefined,
  targetAge: ChildrenTargetAge,
): string {
  const maxChars = childrenMaxCharsForAge(parseChildrenTargetAge(targetAge));
  const t = suggestedTitle?.trim();
  return [
    "请根据以下儿童故事创意 Brief 写成稿（严格遵守 system 中的三块输出格式）：",
    "",
    pipelinePrompt.trim(),
    t ? `\n（家长建议书名：${t}，成稿标题可调整但不超过 12 字）` : "",
    `\n目标读者：${childrenAgeLabel(parseChildrenTargetAge(targetAge))} · 正文约 ${maxChars} 字（±50 字）`,
  ].join("\n");
}
