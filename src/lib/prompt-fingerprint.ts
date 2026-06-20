/**
 * 千人千面核心：从用户 prompt 生成确定性 fingerprint。
 *
 * - seed: 0..1 浮点，驱动程序化生成的"随机"差异（同 prompt 永远出同 seed → 同游戏；不同 prompt 出不同 seed → 不同游戏）
 * - themeWords: 从 prompt 提取的主题词（去停用词），用于主题深度注入
 * - mood: 从主题词推断的氛围（bright / dark / lively / calm / mysterious），影响视觉色调
 *
 * 设计目标：1000 个用户输入相似 prompt → 1000 种细节不同的游戏（同模板内差异化）。
 */

const STOP_WORDS = new Set([
  // 中文停用词
  "的", "了", "是", "在", "我", "你", "他", "她", "它", "们", "个", "做", "个",
  "游戏", "一个", "一种", "玩", "可以", "能", "会", "要", "把", "让", "给", "被",
  "和", "与", "及", "或", "但", "却", "而", "且", "又", "也", "都", "还", "就",
  "这", "那", "哪", "什么", "怎么", "为什么", "谁", "哪里", "怎样",
  "吧", "啊", "哦", "嗯", "呢", "嘛", "哈", "嘿",
  // 英文停用词
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "game", "play", "make", "create", "build", "want", "need", "like", "with",
  "and", "or", "but", "so", "if", "then", "because", "when", "where", "how", "why",
  "this", "that", "these", "those",
]);

const MOOD_KEYWORDS: Record<string, string[]> = {
  dark: ["暗黑", "黑暗", "恶魔", "地狱", "死亡", "恐怖", "惊悚", "哥特", "丧尸", "吸血鬼", "dark", "horror", "gothic", "demon", "zombie"],
  bright: ["可爱", "萌", "卡通", "明亮", "阳光", "彩虹", "糖果", "cute", "kawaii", "bright", "sunny", "rainbow"],
  lively: ["战斗", "激战", "热血", "爆炸", "速度", "极速", "battle", "fight", "explosion", "speed", "rush"],
  calm: ["田园", "宁静", "舒缓", "休闲", "放松", "种植", "花园", "农场", "peaceful", "calm", "relax", "farm", "garden"],
  mysterious: ["神秘", "悬疑", "推理", "侦探", "魔法", "魔幻", "mystery", "magic", "detective", "arcane"],
};

export type PromptMood = "bright" | "dark" | "lively" | "calm" | "mysterious";

export interface PromptFingerprint {
  /** 0..1 浮点 seed，驱动程序化差异化 */
  seed: number;
  /** 32 位整数 seed（用于需要整数种子的场景） */
  seedInt: number;
  /** 主题词（去停用词后的实义词，最多 8 个） */
  themeWords: string[];
  /** 推断的氛围 */
  mood: PromptMood;
  /** 原始 prompt（截断 200 字符） */
  prompt: string;
}

/** FNV-1a hash：确定性、分布均匀、无需 crypto */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 从 prompt 提取主题词（中英文混合，去停用词，去重） */
function extractThemeWords(prompt: string): string[] {
  if (!prompt) return [];
  const lower = prompt.toLowerCase();
  // 英文词：按非字母数字分割
  const englishWords = lower
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  // 中文词：按 2-4 字片段切（简化分词，按标点/空格分后取每段）
  const chineseSegments = prompt
    .split(/[^一-龥]+/)
    .filter((s) => s.length >= 2);
  // 中文段再切成 2-3 字片段（粗粒度）
  const chineseWords: string[] = [];
  for (const seg of chineseSegments) {
    if (seg.length <= 4) {
      if (!STOP_WORDS.has(seg)) chineseWords.push(seg);
    } else {
      // 长段切 2 字片段
      for (let i = 0; i < seg.length - 1; i += 2) {
        const w = seg.slice(i, i + 2);
        if (!STOP_WORDS.has(w)) chineseWords.push(w);
      }
    }
  }
  // 合并 + 去重 + 截断
  const all = [...new Set([...chineseWords, ...englishWords])];
  return all.slice(0, 8);
}

function inferMood(prompt: string, themeWords: string[]): PromptMood {
  const blob = (prompt + " " + themeWords.join(" ")).toLowerCase();
  let best: PromptMood = "lively";
  let bestScore = 0;
  for (const [mood, kws] of Object.entries(MOOD_KEYWORDS)) {
    let score = 0;
    for (const kw of kws) {
      if (blob.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = mood as PromptMood;
    }
  }
  return best;
}

/**
 * 从 prompt 生成 fingerprint。
 * 同一 prompt 永远生成同一 fingerprint（确定性）。
 */
export function fingerprintPrompt(prompt: string): PromptFingerprint {
  const normalized = (prompt ?? "").trim().slice(0, 200);
  const seedInt = hashString(normalized);
  const seed = seedInt / 0x100000000; // 0..1
  const themeWords = extractThemeWords(normalized);
  const mood = inferMood(normalized, themeWords);
  return {
    seed,
    seedInt,
    themeWords,
    mood,
    prompt: normalized,
  };
}

/**
 * 基于 seed 的确定性 PRNG（mulberry32）。
 * 同 seed 永远生成同一序列，用于程序化差异化。
 */
export function makeSeededRng(seedInt: number): () => number {
  let a = seedInt >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 在 [min, max] 范围内基于 rng 微调一个基准值。
 * 用于"同模板不同 prompt 出不同数值"。
 */
export function jitter(rng: () => number, base: number, min: number, max: number, jitterPct: number): number {
  const delta = (rng() * 2 - 1) * jitterPct; // -jitterPct .. +jitterPct
  const v = base * (1 + delta);
  return Math.max(min, Math.min(max, v));
}

/**
 * 基于 seed 选择数组中的一个元素（确定性）。
 */
export function pickBySeed<T>(seedInt: number, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error("pickBySeed: empty array");
  return arr[seedInt % arr.length]!;
}

/**
 * mood → 推荐色调偏移（hue 调整，0..1）
 * dark → 冷色相，bright → 暖色相，calm → 绿色相，mysterious → 紫色相
 */
export function moodHueBias(mood: PromptMood): number {
  switch (mood) {
    case "dark":
      return 0.0; // 红黑
    case "bright":
      return 0.13; // 黄橙
    case "lively":
      return 0.0; // 红橙
    case "calm":
      return 0.33; // 绿
    case "mysterious":
      return 0.75; // 紫
  }
}
