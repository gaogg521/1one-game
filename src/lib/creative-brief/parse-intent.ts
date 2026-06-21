import type { GameSpec } from "@/lib/game-spec";
import type { ParsedIntent } from "@/lib/creative-brief/types";
import {
  DEFAULT_GENRE_PACK,
  GENRE_PACKS,
  selectGenrePack,
  type GenrePack,
} from "@/lib/creative-brief/genre-packs";
import { inferTemplateFromPrompt, type GameTemplateId } from "@/lib/game-templates";

function extractKeywords(prompt: string): string[] {
  const chunks = prompt
    .replace(/[，。！？、；：,.!?;:\s]+/g, " ")
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  return Array.from(new Set(chunks)).slice(0, 12);
}

function inferTone(prompt: string, pack: GenrePack): ParsedIntent["tone"] {
  const p = prompt.toLowerCase();
  if (/硬核|地狱|弹幕|高难|挑战|boss rush/i.test(p)) return "hardcore";
  if (/轻松|治愈|休闲|慢|cozy|casual/i.test(p)) return "casual";
  if (/史诗|宏大|热血|战争|决战|epic/i.test(p) || pack.defaultTone === "epic") return "epic";
  if (pack.defaultTone === "cozy") return "cozy";
  return "neutral";
}

function inferDifficulty(prompt: string, tone: ParsedIntent["tone"]): ParsedIntent["difficulty"] {
  const p = prompt.toLowerCase();
  if (/硬核|地狱|高难|困难|hard/i.test(p) || tone === "hardcore") return "hard";
  if (/轻松|简单|休闲|easy/i.test(p) || tone === "cozy") return "easy";
  return "normal";
}

function inferTemplate(
  prompt: string,
  pack: GenrePack,
  templateHint: "auto" | GameSpec["templateId"],
): ParsedIntent["templateHint"] {
  if (templateHint !== "auto") return templateHint as GameTemplateId;
  // infer（精确模板关键词）优先于 pack.defaultTemplate（粗粒度题材匹配）。
  // 否则"神庙逃亡"会因命中 platformer-adventure pack（match 含"跑酷/跳跃"）
  // 被锁死成 platformer，endless-runner 的 infer 规则没机会跑。
  const inferred = inferTemplateFromPrompt(prompt);
  if (inferred) return inferred;
  if (pack.defaultTemplate !== "auto" && pack.defaultTemplate !== undefined) {
    return pack.defaultTemplate as GameTemplateId;
  }
  return "avoider";
}

/** 规则层：从一句话解析玩法与题材倾向（不调用 LLM） */
export function parseCreativeIntent(
  prompt: string,
  templateHint: "auto" | GameSpec["templateId"] = "auto",
): ParsedIntent {
  const pack = selectGenrePack(prompt, templateHint === "auto" ? undefined : templateHint);
  const tone = inferTone(prompt, pack);
  return {
    genreId: pack.id,
    genreLabel: pack.label,
    templateHint: inferTemplate(prompt, pack, templateHint),
    tone,
    difficulty: inferDifficulty(prompt, tone),
    keywords: extractKeywords(prompt),
  };
}

export { GENRE_PACKS, DEFAULT_GENRE_PACK, selectGenrePack };
