import { llmNovelJson } from "@/lib/llm";
import type { LongNovelSegmentPlan } from "@/lib/novel-long-config";
import { novelLengthConfig, type NovelLengthTier } from "@/lib/novel-length";
import {
  buildNovelBibleJsonSchema,
  type NovelBible,
  parseNovelBible,
} from "@/lib/novel-long-pipeline-types";
import { estimateLongNovelChapterCount, LONG_NOVEL_PRODUCT } from "@/lib/novel-long-config";

const BIBLE_SYSTEM = `你是长篇网络小说「设定圣经」编辑。根据用户创意输出 JSON，锁定世界观与人物，供后续分章写作使用。
要求：人物姓名具体、关系清晰；世界观可支撑 10 万字级连载；核心矛盾有张力；结局方向明确但不剧透细节。`;

export function formatNovelBibleForPrompt(bible: NovelBible): string {
  const chars = bible.characters
    .map(
      (c) =>
        `- ${c.name}（${c.role}）：${c.traits}${c.relationships ? `；${c.relationships}` : ""}`,
    )
    .join("\n");
  const taboos =
    bible.taboos && bible.taboos.length > 0 ? `\n【禁忌】${bible.taboos.join("；")}` : "";
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
): string {
  const cfg = novelLengthConfig("long");
  const chapterCount = estimateLongNovelChapterCount(plan);
  return `用户创意：${prompt.trim()}
${title?.trim() ? `建议书名：${title.trim()}` : ""}

目标篇幅：${cfg.minChars}–${cfg.maxChars} 字，约 ${chapterCount} 章，分 ${plan.totalSegments} 次写作批次完成。
请输出设定圣经 JSON（含 title、worldSetting、characters 至少 3 人、coreConflict、endingDirection）。`;
}

export function fallbackNovelBible(
  prompt: string,
  title: string | undefined,
  plan: LongNovelSegmentPlan,
): NovelBible {
  const t = title?.trim() || "未命名长篇";
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
): Promise<NovelBible> {
  const result = await llmNovelJson(
    {
      model,
      system: BIBLE_SYSTEM,
      user: buildNovelBibleUserMessage(prompt, title, plan),
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
  return fallbackNovelBible(prompt, title, plan);
}
