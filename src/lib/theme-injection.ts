/**
 * 千人千面 B：主题深度注入。
 *
 * 从 prompt 提取主题词，若 spec.labels 仍是通用占位词（"玩家"/"敌人"/"金币"/"主角"/"障碍"），
 * 用主题词派生替换，让 labels 与用户创意强绑定。
 *
 * 配合 generate-spec.ts SYSTEM prompt 的"labels 强主题化"要求，双保险：
 * - LLM 端：SYSTEM 已要求 labels 从 prompt 核心意象提取
 * - enrich 端：兜底——LLM 没主题化时，用 prompt 主题词补
 */
import type { GameSpec } from "@/lib/game-spec";
import { fingerprintPrompt, type PromptFingerprint } from "@/lib/prompt-fingerprint";

/** 通用占位词（LLM 或 mock 兜底时常用），需要被主题词替换 */
const GENERIC_PLAYER_WORDS = new Set([
  "玩家", "主角", "英雄", "player", "hero", "character", "角色", "我方",
]);
const GENERIC_HAZARD_WORDS = new Set([
  "敌人", "敌军", "障碍", "威胁", "怪物", "enemy", "hazard", "obstacle", "monster", "foe",
]);
const GENERIC_COLLECTIBLE_WORDS = new Set([
  "金币", "宝石", "收集物", "道具", "coin", "gem", "collectible", "item", "pickup", "无", "—",
]);

/** 从主题词中挑一个最像"角色/物体"的词（长度 2-4，非纯动词） */
function pickEntityWord(themeWords: string[], fallback: string): string {
  if (themeWords.length === 0) return fallback;
  // 优先 2-3 字的中文词（更像角色名）
  const cn = themeWords.filter((w) => /[一-鿿]/.test(w) && w.length >= 2 && w.length <= 4);
  if (cn.length > 0) return cn[0]!;
  // 英文词取第一个
  const en = themeWords.filter((w) => /^[a-z]/.test(w));
  if (en.length > 0) return en[0]!;
  return fallback;
}

/** 给 hazard/collectible 加主题后缀，让它们与 player 形成故事 */
function withSuffix(base: string, kind: "hazard" | "collectible"): string {
  if (kind === "hazard") {
    // 避免重复"敌/怪"字眼
    if (/敌|怪|兽|魔|鬼|僵尸|丧尸|alien/.test(base)) return base;
    return `${base}敌`;
  }
  // collectible：避免重复"币/石/果"
  if (/币|石|果|晶|核|珠|钻|星/.test(base)) return base;
  return `${base}晶`;
}

/**
 * 若 labels 是通用占位词，用 prompt 主题词派生替换。
 * 已主题化的 labels（LLM 已填"豌豆射手"/"飞剑客"等）保持不变。
 */
export function injectThemeLabels(spec: GameSpec, prompt: string): GameSpec {
  const labels = spec.labels;
  if (!labels) return spec;
  const fp: PromptFingerprint = fingerprintPrompt(prompt);
  const tw = fp.themeWords;
  if (tw.length === 0) return spec;

  const playerRaw = labels.player ?? "";
  const hazardRaw = labels.hazard ?? "";
  const collectibleRaw = labels.collectible ?? "";

  const newPlayer = GENERIC_PLAYER_WORDS.has(playerRaw) ? pickEntityWord(tw, playerRaw) : playerRaw;
  // hazard/collectible 用主题词的不同索引避免与 player 重复
  const remainingWords = tw.filter((w) => w !== newPlayer);
  const newHazard = GENERIC_HAZARD_WORDS.has(hazardRaw)
    ? withSuffix(pickEntityWord(remainingWords.length > 0 ? remainingWords : tw, hazardRaw), "hazard")
    : hazardRaw;
  const remainingAfterHazard = remainingWords.filter((w) => w !== newHazard);
  const newCollectible = GENERIC_COLLECTIBLE_WORDS.has(collectibleRaw)
    ? withSuffix(pickEntityWord(remainingAfterHazard.length > 0 ? remainingAfterHazard : tw, collectibleRaw), "collectible")
    : collectibleRaw;

  if (newPlayer === playerRaw && newHazard === hazardRaw && newCollectible === collectibleRaw) {
    return spec;
  }
  return {
    ...spec,
    labels: {
      ...labels,
      player: newPlayer,
      hazard: newHazard,
      collectible: collectibleRaw ? newCollectible : newCollectible,
    },
  };
}
