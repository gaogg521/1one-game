/**
 * 千人千面深度适配：从 prompt 主题词派生场景/音乐/UI/地图/怪物的自动适配值。
 *
 * 用户一句话 → 自动适配：
 * - 场景：背景色相 + 装饰元素关键词（森林→树木 / 太空→星空 / 火焰→岩浆）
 * - 音乐：musicProfile + BGM 标签（和风→organic / 赛博→neon / 史诗→pulse）
 * - UI：HUD 配色方案（按主题色相 + 对比度）
 * - 地图：关卡风格（探索/挑战/速跑）+ 装饰密度
 * - 怪物：敌人名称词根 + 颜色 + 形状关键词
 *
 * 与 fingerprintPrompt + injectThemeLabels 协同：
 * - fingerprint 提供 seed + mood + themeWords
 * - theme-adapter 派生具体适配值
 * - enrich 阶段注入 spec（theme/presentation/labels/blueprint）
 */
import type { GameSpec } from "@/lib/game-spec";
import type { PromptFingerprint, PromptMood } from "@/lib/prompt-fingerprint";

/** Phaser 程序化绘制 mood（与 template-theme-visual.ts ThemeMood 对齐） */
export type PhaserMood = "ocean" | "forest" | "space" | "cyber" | "generic";

export interface ThemeAdaptation {
  /** 推荐背景色相偏移（0..1，HSL hue） */
  bgHueBias: number;
  /** 场景装饰关键词（供 Phaser 程序化绘制参考） */
  sceneDecorWords: string[];
  /** Phaser 程序化绘制 mood（驱动 paintPlatformerParallax 等） */
  phaserMood: PhaserMood;
  /** 推荐 musicProfile */
  musicProfile: "organic" | "pulse" | "minimal" | "neon";
  /** BGM 标签（映射 public/game-bgm/{templateId}-{profile}.ogg） */
  bgmTag: string;
  /** 推荐关卡风格（platformer 用） */
  levelStyle: "explore" | "challenge" | "speedrun";
  /** 敌人名称词根（用于派生 hazard label） */
  enemyRoot: string;
  /** 敌人颜色（hex） */
  enemyColor: string;
  /** 敌人形状关键词（供程序化绘制参考） */
  enemyShape: string;
  /** 收集物名称词根 */
  collectibleRoot: string;
  /** 收集物颜色 */
  collectibleColor: string;
}

/** 主题词 → 适配规则（关键词命中即触发） */
const THEME_RULES: Array<{
  match: RegExp;
  bgHue: number;
  decor: string[];
  phaserMood: PhaserMood;
  music: "organic" | "pulse" | "minimal" | "neon";
  bgm: string;
  level: "explore" | "challenge" | "speedrun";
  enemyRoot: string;
  enemyColor: string;
  enemyShape: string;
  collectibleRoot: string;
  collectibleColor: string;
}> = [
  // ── 精确匹配优先（避免被宽泛规则误夺）──
  {
    // 武侠优先于海洋（"水墨"含"水"会被海洋抢）
    match: /武侠|江湖|剑客|剑仙|水墨|中国风|wuxia|ink\s*wash/i,
    bgHue: 0.08, decor: ["ink-mist", "bamboo", "mountains", "clouds"],
    phaserMood: "forest",
    music: "organic", bgm: "wuxia",
    level: "explore",
    enemyRoot: "邪派", enemyColor: "#9f1239", enemyShape: "sword",
    collectibleRoot: "丹砂", collectibleColor: "#fde68a",
  },
  {
    // 雪山优先于冰（"雪山"含"雪"会被冰抢）
    match: /雪山|山峰|登顶|mountain|peak|summit|alpine/i,
    bgHue: 0.58, decor: ["snow-peaks", "icicles", "pine-trees", "clouds"],
    phaserMood: "generic",
    music: "minimal", bgm: "mountain",
    level: "challenge",
    enemyRoot: "雪猿", enemyColor: "#94a3b8", enemyShape: "yeti",
    collectibleRoot: "冰莲", collectibleColor: "#e0f2fe",
  },
  {
    // 海盗优先于海洋（"海盗"含"海"会被海洋抢）
    match: /海盗|海贼|私掠|pirate|galleon/i,
    bgHue: 0.5, decor: ["ships", "treasure", "waves", "skulls-flag"],
    phaserMood: "ocean",
    music: "pulse", bgm: "pirate",
    level: "explore",
    enemyRoot: "海盗", enemyColor: "#92400e", enemyShape: "pirate",
    collectibleRoot: "金币", collectibleColor: "#fbbf24",
  },
  {
    // 都市优先于赛博（"都市霓虹"含"霓虹"会被赛博抢）
    match: /都市|城市|街头|街道|urban|city\s*street|downtown/i,
    bgHue: 0.75, decor: ["skyscrapers", "neon-signs", "traffic", "crowds"],
    phaserMood: "cyber",
    music: "neon", bgm: "urban",
    level: "speedrun",
    enemyRoot: "黑帮", enemyColor: "#1e293b", enemyShape: "thug",
    collectibleRoot: "钞票", collectibleColor: "#22c55e",
  },
  // ── 宽泛匹配（精确规则之后）──
  {
    match: /森林|树林|松|枫|丛林|forest|woods|jungle/i,
    bgHue: 0.33, decor: ["trees", "leaves", "mushrooms", "vines"],
    phaserMood: "forest",
    music: "organic", bgm: "forest",
    level: "explore",
    enemyRoot: "刺藤", enemyColor: "#a65f3f", enemyShape: "thorn-vine",
    collectibleRoot: "松鳞", collectibleColor: "#c9a66b",
  },
  {
    match: /太空|宇宙|星际|星空|银河|space|galaxy|cosmic|star/i,
    bgHue: 0.66, decor: ["stars", "nebula", "planets", "asteroids"],
    phaserMood: "space",
    music: "neon", bgm: "space",
    level: "speedrun",
    enemyRoot: "外星", enemyColor: "#9d5838", enemyShape: "alien-ship",
    collectibleRoot: "星尘", collectibleColor: "#7dd3fc",
  },
  {
    // 海洋：精确化（去掉单独"水"/"海"，避免抢武侠/海盗）
    match: /海洋|海底|深海|海水|水下|ocean|sea|underwater/i,
    bgHue: 0.55, decor: ["bubbles", "coral", "seaweed", "fish-silhouettes"],
    phaserMood: "ocean",
    music: "organic", bgm: "ocean",
    level: "explore",
    enemyRoot: "海妖", enemyColor: "#0891b2", enemyShape: "tentacle",
    collectibleRoot: "珍珠", collectibleColor: "#fde047",
  },
  {
    match: /火焰|熔岩|火山|地狱|岩浆|fire|lava|volcano|inferno/i,
    bgHue: 0.05, decor: ["embers", "lava-bubbles", "smoke", "cracks"],
    phaserMood: "generic",
    music: "pulse", bgm: "fire",
    level: "challenge",
    enemyRoot: "炎魔", enemyColor: "#dc2626", enemyShape: "flame",
    collectibleRoot: "火晶", collectibleColor: "#fb923c",
  },
  {
    // 冰：精确化（去掉单独"雪"，避免抢雪山）
    match: /冰川|极地|寒冰|冰冻|ice|frozen|glacier|frost/i,
    bgHue: 0.6, decor: ["snowflakes", "icicles", "frost", "aurora"],
    phaserMood: "generic",
    music: "minimal", bgm: "ice",
    level: "speedrun",
    enemyRoot: "冰霜", enemyColor: "#0ea5e9", enemyShape: "ice-shard",
    collectibleRoot: "冰晶", collectibleColor: "#e0f2fe",
  },
  {
    // 赛博：精确化（去掉单独"霓虹"，避免抢都市）
    match: /赛博|cyber|cyberpunk|电子科技|未来科技|neon\s*city/i,
    bgHue: 0.83, decor: ["grid", "neon-lines", "data-streams", "holograms"],
    phaserMood: "cyber",
    music: "neon", bgm: "cyber",
    level: "challenge",
    enemyRoot: "病毒", enemyColor: "#ec4899", enemyShape: "glitch",
    collectibleRoot: "数据", collectibleColor: "#22d3ee",
  },
  {
    match: /暗黑|哥特|恶魔|亡灵|地下城|dark|gothic|demon|undead|dungeon/i,
    bgHue: 0.0, decor: ["torches", "skulls", "chains", "fog"],
    phaserMood: "generic",
    music: "pulse", bgm: "dark",
    level: "challenge",
    enemyRoot: "亡灵", enemyColor: "#6b21a8", enemyShape: "wraith",
    collectibleRoot: "魂", collectibleColor: "#a78bfa",
  },
  {
    match: /可爱|萌系|卡通|童趣|cute|kawaii|chibi/i,
    bgHue: 0.92, decor: ["hearts", "stars", "candy", "rainbows"],
    phaserMood: "forest",
    music: "organic", bgm: "cute",
    level: "explore",
    enemyRoot: "淘气", enemyColor: "#f472b6", enemyShape: "blob",
    collectibleRoot: "糖果", collectibleColor: "#fbbf24",
  },
  {
    match: /沙漠|金字塔|沙|desert|sand|pyramid|埃及/i,
    bgHue: 0.12, decor: ["sand-dunes", "cacti", "bones", "sun"],
    phaserMood: "generic",
    music: "pulse", bgm: "desert",
    level: "speedrun",
    enemyRoot: "沙蝎", enemyColor: "#b45309", enemyShape: "scorpion",
    collectibleRoot: "金沙", collectibleColor: "#fcd34d",
  },
  {
    match: /雨林|热带|丛林深处|rainforest|tropical/i,
    bgHue: 0.3, decor: ["thick-vines", "exotic-flowers", "waterfalls", "ancient-ruins"],
    phaserMood: "forest",
    music: "organic", bgm: "jungle",
    level: "explore",
    enemyRoot: "毒蛙", enemyColor: "#16a34a", enemyShape: "frog",
    collectibleRoot: "翡翠", collectibleColor: "#10b981",
  },
  {
    match: /雪山|山峰|登顶|mountain|peak|summit|alpine/i,
    bgHue: 0.58, decor: ["snow-peaks", "icicles", "pine-trees", "clouds"],
    phaserMood: "generic",
    music: "minimal", bgm: "mountain",
    level: "challenge",
    enemyRoot: "雪猿", enemyColor: "#94a3b8", enemyShape: "yeti",
    collectibleRoot: "冰莲", collectibleColor: "#e0f2fe",
  },
  {
    match: /废墟|古|遗迹|神庙|ancient|ruins|temple/i,
    bgHue: 0.1, decor: ["crumbled-pillars", "moss", "glyphs", "dust"],
    phaserMood: "forest",
    music: "organic", bgm: "ruins",
    level: "explore",
    enemyRoot: "石像", enemyColor: "#78716c", enemyShape: "golem",
    collectibleRoot: "古币", collectibleColor: "#d4d4d8",
  },
  {
    match: /天空|浮空|云端|云|sky|floating|cloud/i,
    bgHue: 0.6, decor: ["floating-islands", "clouds", "rainbows", "wind"],
    phaserMood: "forest",
    music: "organic", bgm: "sky",
    level: "speedrun",
    enemyRoot: "风灵", enemyColor: "#7dd3fc", enemyShape: "spirit",
    collectibleRoot: "云絮", collectibleColor: "#f0f9ff",
  },
  {
    match: /海盗|船|海贼|大海盗|pirate|ship/i,
    bgHue: 0.5, decor: ["ships", "treasure", "waves", "skulls-flag"],
    phaserMood: "ocean",
    music: "pulse", bgm: "pirate",
    level: "explore",
    enemyRoot: "海盗", enemyColor: "#92400e", enemyShape: "pirate",
    collectibleRoot: "金币", collectibleColor: "#fbbf24",
  },
  {
    match: /机器人|机械|机甲|robot|mech|machine/i,
    bgHue: 0.08, decor: ["gears", "wires", "panels", "sparks"],
    phaserMood: "cyber",
    music: "pulse", bgm: "robot",
    level: "challenge",
    enemyRoot: "故障", enemyColor: "#52525b", enemyShape: "robot",
    collectibleRoot: "螺丝", collectibleColor: "#a1a1aa",
  },
  {
    match: /节日|庙会|灯笼|春节|中秋|festival|lantern/i,
    bgHue: 0.02, decor: ["lanterns", "fireworks", "streamers", "red-cloth"],
    phaserMood: "generic",
    music: "pulse", bgm: "festival",
    level: "explore",
    enemyRoot: "年兽", enemyColor: "#b91c1c", enemyShape: "beast",
    collectibleRoot: "红包", collectibleColor: "#ef4444",
  },
  {
    match: /都市|城市|街|霓虹灯|urban|city|street/i,
    bgHue: 0.75, decor: ["skyscrapers", "neon-signs", "traffic", "crowds"],
    phaserMood: "cyber",
    music: "neon", bgm: "urban",
    level: "speedrun",
    enemyRoot: "黑帮", enemyColor: "#1e293b", enemyShape: "thug",
    collectibleRoot: "钞票", collectibleColor: "#22c55e",
  },
];

/** mood 兜底适配（无主题词命中时按 mood 推断） */
const MOOD_FALLBACK: Record<PromptMood, Partial<ThemeAdaptation>> = {
  dark: { bgHueBias: 0.0, musicProfile: "pulse", bgmTag: "dark", enemyColor: "#6b21a8", collectibleColor: "#a78bfa" },
  bright: { bgHueBias: 0.13, musicProfile: "organic", bgmTag: "bright", enemyColor: "#f472b6", collectibleColor: "#fbbf24" },
  lively: { bgHueBias: 0.0, musicProfile: "pulse", bgmTag: "lively", enemyColor: "#dc2626", collectibleColor: "#fde047" },
  calm: { bgHueBias: 0.33, musicProfile: "organic", bgmTag: "calm", enemyColor: "#a65f3f", collectibleColor: "#c9a66b" },
  mysterious: { bgHueBias: 0.75, musicProfile: "minimal", bgmTag: "mystery", enemyColor: "#7c3aed", collectibleColor: "#22d3ee" },
};

/**
 * 从 fingerprint 派生主题适配值。
 * 优先按主题词命中 THEME_RULES，无命中则按 mood 兜底。
 */
export function adaptThemeFromFingerprint(fp: PromptFingerprint): ThemeAdaptation {
  const blob = (fp.prompt + " " + fp.themeWords.join(" ")).toLowerCase();

  // 找第一个命中的规则
  for (const rule of THEME_RULES) {
    if (rule.match.test(blob)) {
      return {
        bgHueBias: rule.bgHue,
        sceneDecorWords: rule.decor,
        phaserMood: rule.phaserMood,
        musicProfile: rule.music,
        bgmTag: rule.bgm,
        levelStyle: rule.level,
        enemyRoot: rule.enemyRoot,
        enemyColor: rule.enemyColor,
        enemyShape: rule.enemyShape,
        collectibleRoot: rule.collectibleRoot,
        collectibleColor: rule.collectibleColor,
      };
    }
  }

  // mood 兜底
  const fallback = MOOD_FALLBACK[fp.mood] ?? MOOD_FALLBACK.lively;
  return {
    bgHueBias: fallback.bgHueBias ?? 0.0,
    sceneDecorWords: [],
    phaserMood: "generic",
    musicProfile: fallback.musicProfile ?? "pulse",
    bgmTag: fallback.bgmTag ?? "default",
    levelStyle: fp.mood === "calm" ? "explore" : fp.mood === "dark" ? "challenge" : "speedrun",
    enemyRoot: "敌",
    enemyColor: fallback.enemyColor ?? "#dc2626",
    enemyShape: "generic",
    collectibleRoot: "晶",
    collectibleColor: fallback.collectibleColor ?? "#fde047",
  };
}

/**
 * 把主题适配值注入 spec（若 LLM 未明确指定，用适配值兜底）。
 * - theme.hazardColor / collectibleColor：若 LLM 给的是通用色，用主题色替换
 * - presentation.musicProfile / bgmTag：若缺失，用适配值
 * - labels.hazard / collectible：若通用词，用主题词根派生
 * - platformer.levelStyle：若缺失，用适配值
 */
export function applyThemeAdaptation(spec: GameSpec, adaptation: ThemeAdaptation): GameSpec {
  let next = { ...spec };

  // theme 颜色：仅当 LLM 给的是占位通用色时替换
  const GENERIC_HAZARD_COLORS = new Set(["#9d5838", "#ef4444", "#dc2626"]);
  const GENERIC_COLLECT_COLORS = new Set(["#c9a66b", "#fbbf24", "#fde047"]);
  if (GENERIC_HAZARD_COLORS.has(next.theme.hazardColor.toLowerCase())) {
    next = { ...next, theme: { ...next.theme, hazardColor: adaptation.enemyColor } };
  }
  if (next.theme.collectibleColor && GENERIC_COLLECT_COLORS.has(next.theme.collectibleColor.toLowerCase())) {
    next = { ...next, theme: { ...next.theme, collectibleColor: adaptation.collectibleColor } };
  }

  // presentation.musicProfile / bgmTag：主题适配强制覆盖（用户意图最高优先级）
  const pres = next.presentation ?? {};
  next = { ...next, presentation: { ...pres, musicProfile: adaptation.musicProfile, bgmTag: adaptation.bgmTag } };

  // phaserMood 写入 samplePlayProfile（驱动 Phaser 程序化背景绘制）
  if (next.samplePlayProfile) {
    next = {
      ...next,
      samplePlayProfile: {
        ...next.samplePlayProfile,
        phaserMood: adaptation.phaserMood,
        // sceneDecorWords 精细化驱动：写入 spec 供 Phaser 按 decorWords 画精细元素
        themeWords: adaptation.sceneDecorWords.length > 0 ? adaptation.sceneDecorWords : next.samplePlayProfile.themeWords,
      },
    };
  }

  return next;
}
