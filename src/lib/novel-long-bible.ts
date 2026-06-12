import type { AppLocale } from "@/i18n/routing";
import { untitledNovelLabel } from "@/lib/i18n/chapter-labels";
import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";
import { llmNovelJson } from "@/lib/llm";
import { buildLongNovelBibleSystemPrompt } from "@/lib/novel-locale-prompts";
import type { LongNovelSegmentPlan } from "@/lib/novel-long-config";
import { novelLengthConfig, type NovelLengthTier } from "@/lib/novel-length";
import {
  buildNovelBibleJsonSchema,
  type NovelBible,
  parseNovelBible,
} from "@/lib/novel-long-pipeline-types";
import { estimateLongNovelChapterCount, LONG_NOVEL_PRODUCT } from "@/lib/novel-long-config";

export function formatNovelBibleForPrompt(bible: NovelBible, locale: BriefInputLocale = "zh"): string {
  const chars = bible.characters
    .map(
      (c) =>
        `- ${c.name}（${c.role}）：${c.traits}${c.relationships ? `；${c.relationships}` : ""}`,
    )
    .join("\n");
  const taboos =
    bible.taboos && bible.taboos.length > 0 ? `\n【禁忌】${bible.taboos.join("；")}` : "";
  if (locale === "en") {
    const tabooBlock =
      bible.taboos && bible.taboos.length > 0 ? `\n[Taboos] ${bible.taboos.join("; ")}` : "";
    return `[Title] ${bible.title}
[World] ${bible.worldSetting}
${bible.tone ? `[Tone] ${bible.tone}\n` : ""}[Characters]
${bible.characters.map((c) => `- ${c.name} (${c.role}): ${c.traits}${c.relationships ? `; ${c.relationships}` : ""}`).join("\n")}
[Core conflict] ${bible.coreConflict}
[Ending direction] ${bible.endingDirection}${tabooBlock}`;
  }
  return `【书名】${bible.title}
【世界观】${bible.worldSetting}
${bible.tone ? `【基调】${bible.tone}\n` : ""}【主要人物】
${chars}
【核心矛盾】${bible.coreConflict}
【结局方向】${bible.endingDirection}${taboos}`;
}

export function buildNovelBibleUserMessage(
  prompt: string,
  title: string | undefined,
  plan: LongNovelSegmentPlan,
  locale: BriefInputLocale = "zh",
): string {
  const cfg = novelLengthConfig("long");
  const chapterCount = estimateLongNovelChapterCount(plan);
  if (locale === "en") {
    return `User concept: ${prompt.trim()}
${title?.trim() ? `Suggested title: ${title.trim()}` : ""}

Target length: ${cfg.minChars}–${cfg.maxChars} characters, about ${chapterCount} chapters across ${plan.totalSegments} writing batches.
Output bible JSON (title, worldSetting, at least 3 characters, coreConflict, endingDirection). All strings in English.`;
  }
  if (locale === "ja") {
    return `ユーザー創意：${prompt.trim()}
${title?.trim() ? `推奨タイトル：${title.trim()}` : ""}

目標分量：${cfg.minChars}–${cfg.maxChars} 字、約 ${chapterCount} 章、${plan.totalSegments} 批で完成。
設定聖書 JSON を日本語で出力（title, worldSetting, characters 3人以上, coreConflict, endingDirection）。`;
  }
  return `用户创意：${prompt.trim()}
${title?.trim() ? `建议书名：${title.trim()}` : ""}

目标篇幅：${cfg.minChars}–${cfg.maxChars} 字，约 ${chapterCount} 章，分 ${plan.totalSegments} 次写作批次完成。
请输出设定圣经 JSON（含 title、worldSetting、characters 至少 3 人、coreConflict、endingDirection）。`;
}

export function fallbackNovelBible(
  prompt: string,
  title: string | undefined,
  plan: LongNovelSegmentPlan,
  uiLocale: AppLocale = "zh-Hans",
): NovelBible {
  const t = title?.trim() || untitledNovelLabel(uiLocale);
  return {
    title: t,
    worldSetting: `故事发生于与用户创意相关的虚构世界：${prompt.trim().slice(0, 200)}`,
    tone: "网络连载、节奏明快",
    characters: [
      { name: "主角", role: "主人公", traits: "坚韧、有成长弧光" },
      { name: "对手", role: "对立面", traits: "制造核心冲突" },
      { name: "同伴", role: "盟友", traits: "协助主角推进主线" },
    ],
    coreConflict: prompt.trim().slice(0, 400),
    endingDirection: `在约 ${plan.targetTotalChars} 字内完成主线收束，呼应创意核心。`,
    taboos: ["禁止重启世界观", "禁止主要角色无故改名或死亡复活（无铺垫）"],
  };
}

export async function fetchNovelBible(
  model: string,
  prompt: string,
  title: string | undefined,
  plan: LongNovelSegmentPlan,
  lengthTier: NovelLengthTier,
  uiLocale: AppLocale = "zh-Hans",
): Promise<NovelBible> {
  const locale = resolveNovelOutputLocale(prompt);
  const result = await llmNovelJson(
    {
      model,
      system: buildLongNovelBibleSystemPrompt(locale),
      user: buildNovelBibleUserMessage(prompt, title, plan, locale),
      jsonSchema: buildNovelBibleJsonSchema(),
      temperature: 0.65,
      mode: "json_schema",
      timeoutMs: LONG_NOVEL_PRODUCT.bibleTimeoutMs,
    },
    lengthTier,
  );
  if (result.ok) {
    const parsed = parseNovelBible(result.raw);
    if (parsed) {
      if (title?.trim() && parsed.title.length < 2) parsed.title = title.trim();
      return parsed;
    }
  }
  return fallbackNovelBible(prompt, title, plan, uiLocale);
}
