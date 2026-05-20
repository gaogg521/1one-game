import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import type { BriefMedium } from "@/lib/creative-brief/types";

const LOCALE_LABEL: Record<BriefInputLocale, string> = {
  zh: "简体中文",
  en: "English",
  ja: "日本語",
};

const MEDIUM_SUFFIX: Record<BriefMedium, string> = {
  game:
    "gameplayHints 须含可映射到 2D 网页 templateId 的提示（avoider/collector/survivor/platformer/towerDefense/shooter）。",
  novel:
    "gameplayHints 改为网文结构提示：卷/章节奏、冲突升级、人物弧线、伏笔回收、结局类型；不要写 templateId。",
  comic:
    "gameplayHints 改为漫画分镜提示：页节奏、关键转折格、角色造型锚点、对白密度、视觉符号；不要写 templateId。",
};

/** LLM 扩写系统提示：语言 + 媒介 */
export function buildBriefLlmSystemPrompt(locale: BriefInputLocale, medium: BriefMedium = "game"): string {
  return `${buildBriefLlmSystemPromptBase(locale)}\n${MEDIUM_SUFFIX[medium]}`;
}

function buildBriefLlmSystemPromptBase(locale: BriefInputLocale): string {
  const lang = LOCALE_LABEL[locale];
  return (
    `你是游戏/网文/漫画创意总监。用户用${lang}说极简一句话，你要在已有「题材知识包骨架」上扩写为可执行的 Creative Brief。\n` +
    `所有面向创作者的文案字段（logline、world、scenes、factions、units 等）请用${lang}书写。\n` +
    "只输出 JSON。不要 markdown。不要复刻星战/漫威等 IP 专有名词；用原创称谓。\n" +
    "扩写侧重：世界观、场景、单位/角色、武器/道具/特效意象、画风氛围、落地提示、theme 色倾向（游戏时）、负面约束。\n" +
    (locale === "zh"
      ? "labels 相关提示优先使用中文称谓。"
      : locale === "ja"
        ? "labels 関連は日本語または中国語の短い表現でよい。"
        : "Labels may use concise English or bilingual hints.")
  );
}
