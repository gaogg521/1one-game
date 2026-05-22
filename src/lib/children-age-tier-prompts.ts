import type { ChildrenNarrativeMode } from "@/lib/children-source-fidelity";
import {
  childrenCharRangeLabel,
  childrenStageLabel,
  childrenTargetCharsForAge,
  getChildrenAgeTier,
  type ChildrenTargetAge,
} from "@/lib/children-age-length";

/** 各档专属 AI 角色一句 */
export function childrenTierRoleLine(age: ChildrenTargetAge): string {
  const t = getChildrenAgeTier(age);
  switch (t.tierId) {
    case "infant_0_3":
      return "你是 0-3 岁婴幼儿专属故事创作 AI，可识别家长输入：日常话语、简单成语、浅显国学短句。";
    case "kindergarten_3_6":
      return "你是 3-6 岁幼儿园儿童专属故事 AI，支持识别日常想法、常用成语、启蒙国学小故事。";
    case "primary_6_8":
      return "你是 6-8 岁一二年级小学生专属故事 AI，可识别日常心愿、常用成语、传统启蒙典故、民俗小故事。";
    case "grade_9":
      return "你是 9 岁三年级儿童专属故事创作 AI，支持日常语句、全品类成语、完整古代经典典故、传统历史小故事。";
    case "grade_10":
      return "你是 10 岁四年级儿童专属故事创作 AI，适配日常创意、各类成语、正史经典典故、传统名著童趣改编。";
  }
}

/** Brief 扩写：该档解读深度与规划侧重 */
export function childrenTierBriefRules(age: ChildrenTargetAge): string {
  const t = getChildrenAgeTier(age);
  const range = childrenCharRangeLabel(age);
  const common = `目标读者：${t.label}（${t.stage}）· 故事正文 ${range} · 侧重：${t.features}`;
  switch (t.tierId) {
    case "infant_0_3":
      return `${common}
- 极简直白解读，不做复杂深度讲解
- 成语/典故只留表层童趣寓意，剔除历史背景与深奥含义
- 规划温馨画面线：可爱小动物、简单动作、无复杂剧情与冲突`;
    case "kindergarten_3_6":
      return `${common}
- 通俗拆解；典故/神话可童趣化，须忠于家长输入的核心人物与情节
- **Brief 轻量**：听典故的孩子 + 1 动物伙伴，或绘本式讲述者（须与输入相关）；单场景、3 拍；源材料禁止改题`;
    case "primary_6_8":
      return `${common}
- 完整梳理思路；可简单标注成语释义、典故基础由来
- 结构完整：起因、经过、结局；诚信、孝顺、友善、知错就改等正向三观
- 适当优美词句，助力阅读积累`;
    case "grade_9":
      return `${common}
- 深度解析输入；简要说明成语出处、典故基础背景与文化含义
- 剧情层次清晰，人物鲜明；可作文素材；融入传统文化小知识点
- 品格侧重：坚持、担当、明辨是非、尊师重道`;
    case "grade_10":
      return `${common}
- 全方位拆解立意；讲解成语源流、典故文化背景与深层思想
- 叙事饱满、人物立体、情节有起伏与思考；词汇句式丰富
- 保留历史脉络与文化精髓；家国情怀、处世智慧、修身立德`;
  }
}

/** 正文生成：该档创作规则编号列表 */
export function childrenTierCreationRules(age: ChildrenTargetAge): string {
  const t = getChildrenAgeTier(age);
  const range = childrenCharRangeLabel(age);
  const target = childrenTargetCharsForAge(age);
  switch (t.tierId) {
    case "infant_0_3":
      return `【本档规则 — ${t.label}｜${t.stage}】
1. 极简直白解读内容，不做复杂深度讲解。
2. 故事正文严格 ${range}，优先 ${target} 字；多用短句、叠词，语气软糯轻柔。
3. 只用简单动作与温馨画面，无复杂剧情、无冲突；主角以可爱小动物为主。
4. 成语、国学典故极致简化，只留表层童趣寓意，剔除历史背景与深奥含义。
5. 风格舒缓治愈，适合哄睡、语言启蒙、亲子轻声朗读。`;
    case "kindergarten_3_6":
      return `【本档规则 — ${t.label}｜${t.stage}】
1. 通俗拆解；成语/典故/神话须忠于家长输入，可简化不说恐怖与中毒细节。
2. 正文严格 ${range}，短句顺口，单场景一条线；**禁止**「=== 第N章 ===」分章。
3. 听典故的孩子 + 1 动物伙伴，或绘本式讲述者（须与输入相关）；禁止改成无关现代原创。
4. 内心最多 1 句；禁止「心想…又想…」。
5. 温馨治愈，适合睡前亲子共读。`;
    case "primary_6_8":
      return `【本档规则 — ${t.label}｜${t.stage}】
1. 完整梳理创作思路，简单标注成语释义、典故基础由来。
2. 故事正文严格 ${range}，结构完整，有起因、经过、完整结局。
3. 贴合低年级识字量，适当加入优美词句，助力语文阅读与词句积累。
4. 忠于成语原意与传统故事内核；融入诚信、孝顺、友善、知错就改等正向三观。
5. 兼顾趣味性与知识性，适合日常课外阅读。`;
    case "grade_9":
      return `【本档规则 — ${t.label}｜${t.stage}】
1. 深度解析输入内涵，简要说明成语出处、典故基础历史背景与文化含义。
2. 故事正文严格 ${range}，剧情层次清晰，人物形象鲜明，叙事流畅自然。
3. 用词规范贴合小学中段语文水准，内容可直接用作作文写作素材。
4. 不歪曲经典国学寓意，自然融入传统文化小知识点，拓展课外学识。
5. 侧重培养坚持、担当、明辨是非、尊师重道等优秀品格。`;
    case "grade_10":
      return `【本档规则 — ${t.label}｜${t.stage}】
1. 全方位拆解创作立意，完整讲解成语源流、典故文化背景与深层思想内涵。
2. 故事正文严格 ${range}，叙事饱满流畅，人物性格立体，情节有起伏有思考性。
3. 词汇丰富、句式多变，贴合高年级阅读理解与作文提升需求。
4. 完整保留传统故事历史脉络与中华传统文化精髓；融入家国情怀、处世智慧。
5. 道理偏向格局眼界、责任担当、修身立德，提升综合人文素养。`;
  }
}

export function childrenTierInterpretHint(age: ChildrenTargetAge): string {
  const t = getChildrenAgeTier(age);
  switch (t.tierId) {
    case "infant_0_3":
      return "解读 2–3 句极短大白话，不超过 80 字";
    case "kindergarten_3_6":
      return "解读 3–4 句通俗话，不超过 120 字";
    case "primary_6_8":
      return "解读 4–5 句，可含成语释义一句，不超过 180 字";
    case "grade_9":
      return "解读 5–6 句，含出处/背景要点，不超过 280 字";
    case "grade_10":
      return "解读 6–8 句，含源流与文化背景，不超过 360 字";
  }
}

export function childrenTierClosingHint(age: ChildrenTargetAge): string {
  const t = getChildrenAgeTier(age);
  switch (t.tierId) {
    case "infant_0_3":
      return `一句暖心软语，≤${t.closingMax} 字，适合轻声念给孩子`;
    case "kindergarten_3_6":
      return `启蒙小道理一句，≤${t.closingMax} 字，孩子能听懂`;
    case "primary_6_8":
      return `成长感悟 1–2 句，≤${t.closingMax} 字，正向不说教`;
    case "grade_9":
      return `学识感悟 2–3 句，≤${t.closingMax} 字，可含文化常识`;
    case "grade_10":
      return `素养心得 2–3 句，≤${t.closingMax} 字，有格局与思辨`;
  }
}

/** 叙事补充（在通用铁律之上按档裁剪） */
export function childrenTierNarrativeCraft(
  age: ChildrenTargetAge,
  narrativeMode: ChildrenNarrativeMode = "listener_extension",
): string {
  const t = getChildrenAgeTier(age);
  switch (t.tierId) {
    case "infant_0_3":
      return `【叙事要点 — 0-3 岁】
- 一条温馨画面线，无冲突无转折惊吓
- 可重复句式、叠词、拟声；每句 3–10 字为主
- 不必写「心想」，用动作与语气表现情绪`;
    case "kindergarten_3_6":
      return narrativeMode === "retelling"
        ? `【叙事要点 — 3-6 岁 · 典故复述】
- 正文**直接讲**家长输入的典故/成语，主人公是典故中人物（如愚公、孔融等）
- 一条线、单场景；起因→坚持做事→温暖结局；禁止「朵朵听完再搬石头」式换角
- 不说中毒吐血；可简化神奇结局；内心最多 1 句`
        : `【叙事要点 — 3-6 岁 · 听后延伸】
- 听故事的孩子 + 1 动物伙伴，在听完源材料后温和学寓意
- 单场景、好朗读；禁止偷换成无关现代桥段；内心最多 1 句`;
    case "primary_6_8":
      return `【叙事要点 — 6-8 岁】
- 起因→经过→结局完整；用「因为/所以」串联
- 内心 2–3 处；至少 1 处感官描写与 1 处优美词句
- 一条故事线，禁止多线并行`;
    case "grade_9":
    case "grade_10":
      return `【叙事要点 — ${t.label}】
- 人物动机清楚，情节有起伏但温暖收束
- 对话与描写并重；可适度分章（${childrenStageLabel(age)}阅读水平）
- 结尾自然带出寓意或文化启示，不说教`;
  }
}

export function childrenTierOutputFormatBlock(age: ChildrenTargetAge): string {
  const t = getChildrenAgeTier(age);
  const interp = childrenTierInterpretHint(age);
  const close = childrenTierClosingHint(age);
  const min = t.minChars;
  const max = t.maxChars;
  const target = t.targetChars;
  const bodyNote =
    t.tierId === "infant_0_3"
      ? "仅温馨小故事正文，可在首行写 ≤12 字童趣标题"
      : t.tierId === "grade_9" || t.tierId === "grade_10"
        ? "完整故事正文；对话用「」；高年级可 2–3 章「=== 第1章 标题 ===」"
        : "故事正文单篇连贯，禁止分章；对话用「」；首行可用 ≤12 字标题";

  return `【输出格式 — 严格遵守，顺序不可调换】
${t.interpretMark}
（${interp}）

${t.bodyMark}
（${bodyNote}；正文 **${min}–${max}** 字，优先约 **${target}** 字）

${t.closingMark}
（${close}）`;
}

export function childrenTierBriefExtractFields(age: ChildrenTargetAge): string {
  const interp = childrenTierInterpretHint(age);
  const t = getChildrenAgeTier(age);
  const range = childrenCharRangeLabel(age);
  const conflictHint =
    t.tierId === "infant_0_3"
      ? "无复杂冲突，仅温馨日常或小好奇"
      : t.tierId === "kindergarten_3_6"
        ? "无强冲突：好奇观察、温柔发现（禁止肚子痛/吃苦/放弃）"
        : "一个具体可感的小问题或小挑战";
  const charRule =
    t.tierId === "infant_0_3" || t.tierId === "kindergarten_3_6"
      ? "- characters：最多 1 项（仅 1 个可爱动物伙伴名+特质），禁止老人/老师/同学群"
      : "- characters：配角 1–3 个";
  const beatRule =
    t.tierId === "infant_0_3"
      ? "- plotBeats：恰好 2 条，每条 ≤20 字"
      : t.tierId === "kindergarten_3_6"
        ? "- plotBeats：恰好 3 条，每条 ≤25 字，一条线、无负面转折"
        : "- plotBeats：3 条";
  const sceneRule =
    t.tierId === "infant_0_3" || t.tierId === "kindergarten_3_6"
      ? "- keyScenes：最多 2 个，同一场景"
      : "- keyScenes：2–3 个";
  const antRule =
    t.tierId === "infant_0_3" || t.tierId === "kindergarten_3_6"
      ? "- antagonists：填空数组 []"
      : "- antagonists：软性困境或留空";
  return [
    `- sourceInterpretation：${interp}`,
    `- coreConflict：${conflictHint}`,
    charRule,
    beatRule,
    sceneRule,
    antRule,
    `- logline：1 句 ≤${t.tierId === "kindergarten_3_6" ? "45" : "40"} 字，轻快不重`,
    `- 正文篇幅：${range}（优先 ${t.targetChars} 字）`,
  ].join("\n");
}

/** Brief 扩写骨架合同（低幼档强制） */
export function childrenTierBriefSkeletonContract(
  age: ChildrenTargetAge,
  narrativeMode: ChildrenNarrativeMode = "listener_extension",
): string {
  const t = getChildrenAgeTier(age);
  if (t.tierId === "infant_0_3") {
    return `【0-3 岁 Brief 骨架 — 必须遵守】
仅 1 主角（优先小动物）+ 最多 1 伙伴；单场景；2 拍；无冲突无苦味；解读 ≤80 字。`;
  }
  if (t.tierId === "kindergarten_3_6") {
    if (narrativeMode === "retelling") {
      return `【3-6 岁 Brief 骨架 — 典故复述（100-250 字故事）】
1. **直接讲源典故**：三句话情节是典故本身（起因→坚持→结局），禁止改成现代孩子听完再模仿。
2. **角色**：典故核心主人公 + 故事内帮手（如愚公与家人）；禁止朵朵/现代孩子顶替主角。
3. **场景**：典故发生的一处（如山脚、门前），禁止多场景跳转。
4. **情节**：3 拍 ① 难题挡路 ② 主人公坚持一年年做事 ③ 难题解决、大家高兴。
5. **禁止**：换题、惨烈细节、与输入无关的书名。
6. **解读**：≤100 字大白话，点出寓意。`;
    }
    return `【3-6 岁 Brief 骨架 — 听后延伸（100-250 字故事）】
1. **忠于输入**：围绕家长输入的寓意，可用孩子+伙伴听完再学。
2. **角色**：听故事的孩子 + 1 动物伙伴；禁止无关路人/导师。
3. **场景**：单一场景；情节 3 拍：听/认识 → 感受寓意 → 问大人收束。
4. **解读**：≤100 字；禁止两条「心想/又想」。`;
  }
  return "";
}
