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
  if (templateHint !== "auto") return templateHint;

  // 显式游戏名作优先于 genre-pack 默认模板（防止"植物大战僵尸"被 horror-survival 的 survivor 覆盖）
  const p = prompt.toLowerCase();
  if (/植物大战僵尸|pvz|plants\s*vs\s*zombies|植物塔防|豌豆射手|向日葵|坚果墙/i.test(p)) return "towerDefense";

  if (pack.defaultTemplate !== "auto") return pack.defaultTemplate;

  // towerDefense: 塔防 + 经典塔防游戏名 + 防御机制
  if (/塔防|保卫萝卜|保卫|波次|箭塔|炮塔|防线|防线守卫|塔位|建造防御|放置防守|防守阵地|阵地|抵御入侵| Kingdom Rush|王国保卫战|皇家守卫军|猴子塔防|bloons td|星际塔防|植物大战僵尸|pvz|plants\s*vs\s*zombies|植物塔防|豌豆射手|向日葵|坚果墙|tower\s*defense|td\b/i.test(p)) return "towerDefense";

  // shooter: 射击 + 经典射击游戏名 + 飞行/俯视角射击机制
  if (/射击|飞船|太空战|弹幕|战机|消灭敌机|宇宙战|打飞机|飞机大战|雷电|竖版射击|太空射击|俯视角射击|坦克大战|合金弹头|1942|太空侵略者|space invaders|消灭病毒|raiden|shooter|space\s*shooter|bullet\s*hell|竖版飞机|打砖块|invaders|stg/i.test(p)) return "shooter";

  // platformer: 平台 + 经典平台游戏名 + 横版跳跃机制
  if (/平台跳跃|跳台|横版闯关|横版过关|多层平台|超级玛丽|超级马里奥|马里奥|mario|索尼克|sonic|恶魔城|castlevania|银河恶魔城|metroidvania|空洞骑士|hollow knight|奥日|ori|蔚蓝|celeste|几何冲刺|geometry dash|平台动作|横版动作|platformer|platform|关卡|闯关|跑酷闯关|跳跃闯关|连续跳跃|二段跳/i.test(p)) return "platformer";

  // collector: 收集 + 经典收集游戏名 + 拾取机制
  if (/收集|捡|金币|宝石|吃豆|拾取|包裹|晶体|珍珠|蘑菇|能量|吃豆人|pac-man|贪食蛇|snake|收集金币|捡东西|拾取物品|大吃小|吞食|collect|coin|gem|gather|拾金|接东西/i.test(p)) return "collector";

  // survivor: 生存 + 经典生存游戏名 + 持久生存机制
  if (/生存|血条|生命|多条命|尽量久|扣血|撑多久|活下去|生存挑战|割草|吸血鬼幸存者|vampire survivors|黎明前20分钟|20 minutes till dawn|surviv|hp|life|heart|生存模式|能坚持多久|持久战|无尽模式/i.test(p)) return "survivor";

  // avoider: 躲避 + 经典躲避游戏名 + 闪避机制（注意：不含"防守"——防守是塔防概念）
  if (/躲|落下|砸|闪|跑酷|坠落|避开|躲避|躲开|神庙逃亡|temple run|地铁跑酷|subway surfers|别踩白块|是男人就下100层|下100层|躲避球|接东西|fall|drop|dodge|avoid|闪避/i.test(p)) return "avoider";

  // puzzle fallback: 解谜益智类没有独立模板，归到 collector（轻量互动）
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
