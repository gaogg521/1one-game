import type { GameSpec } from "@/lib/game-spec";
import type { ParsedIntent } from "@/lib/creative-brief/types";
import {
  DEFAULT_GENRE_PACK,
  GENRE_PACKS,
  selectGenrePack,
  type GenrePack,
} from "@/lib/creative-brief/genre-packs";

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
  return pack.defaultTone === "epic" ? "epic" : "neutral";
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
  if (templateHint !== "auto") return templateHint;
  if (pack.defaultTemplate !== "auto") return pack.defaultTemplate;

  const p = prompt.toLowerCase();
  if (/塔防|保卫|波次|箭塔|炮塔|tower|td\b/i.test(p)) return "towerDefense";
  if (/射击|飞船|敌机|弹幕|战机|shooter/i.test(p)) return "shooter";
  if (/平台|跳跃|闯关|platformer/i.test(p)) return "platformer";
  if (/收集|金币|宝石|collect/i.test(p)) return "collector";
  if (/生存|血条|surviv/i.test(p)) return "survivor";
  if (/躲|避开|avoid|dodge|闪避|防守/i.test(p)) return "avoider";
  if (/解谜|益智|puzzle|sokoban|logic/i.test(p)) return "collector";
  if (/民俗|庙会|节庆|folk|festival/i.test(p)) return "collector";
  if (/体育|足球|篮球|sport|soccer|basketball/i.test(p)) return "avoider";
  return "auto";
}

/** 规则层：从一句话解析玩法与题材倾向（不调用 LLM） */
export function parseCreativeIntent(
  prompt: string,
  templateHint: "auto" | GameSpec["templateId"] = "auto",
): ParsedIntent {
  const pack = selectGenrePack(prompt);
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

export function resolvePackForIntent(intent: ParsedIntent) {
  return GENRE_PACKS.find((p) => p.id === intent.genreId) ?? DEFAULT_GENRE_PACK;
}
