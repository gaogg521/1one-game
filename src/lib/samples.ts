export type SampleShelf = "featured" | "trending";

/** 样品数据：运营替换竖版封面时改 coverImageSrc（建议 4:5 WebP，单张 200KB 内）与 coverAlt；勿删 coverGradient（失败回退）。 */
export type Sample = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  tags: string[];
  /** 竖版封面（可换为 WebP 截图，路径在 public/） */
  coverImageSrc: string;
  coverAlt: string;
  /** 图片加载失败时的底衬 */
  coverGradient: string;
  /** 角标装饰色 */
  accentGlow: string;
  emoji: string;
  plays: string;
  creator: string;
  shelf: SampleShelf;
  badge?: "hot" | "new";
};

export const SAMPLES: Sample[] = [
  {
    id: "fantasy-mmo-classic",
    title: "Q版奇幻 · 冒险经典",
    subtitle: "经典冒险氛围 · 技能与事件转折",
    prompt:
      "做一个 Q版奇幻冒险风格的经典玩法小游戏：主角是冒险者，敌人是魔物，货币叫 Zeny；要有技能（Shift）、道具与事件系统（金币雨/精英来袭/目标变化），HUD 提示清晰，整体要有“成品感”。（不要直接复刻任何现成 IP 的剧情或角色）",
    tags: ["Q版奇幻", "经典", "事件系统", "技能", "成品感"],
    coverImageSrc: "/samples/plat-ruins.svg",
    coverAlt: "Q版奇幻冒险经典：事件与技能示意封面",
    coverGradient:
      "linear-gradient(150deg, #0b1222 0%, #1e3a8a 38%, #a78bfa 65%, #fb7185 88%, #fde047 100%)",
    accentGlow: "rgba(167, 139, 250, 0.42)",
    emoji: "🗡️",
    plays: "12.8K",
    creator: "1ONE 实验室",
    shelf: "featured",
    badge: "new",
  },
  {
    id: "events-showcase",
    title: "事件演示：三段转折",
    subtitle: "事件系统 · 金币雨/精英来袭/目标变化",
    prompt:
      "做一个事件驱动的街机小游戏：要能明显感受到金币雨、精英来袭、目标变化三个阶段；HUD 友好，技能和道具可读。画风选柔和扁平或水彩纸感，不要使用霓虹赛博作为默认观感。",
    tags: ["事件系统", "金币雨", "精英", "转折", "成品感"],
    coverImageSrc: "/samples/td-cyber.svg",
    coverAlt: "事件演示：金币雨、精英来袭、目标变化示意封面",
    coverGradient:
      "linear-gradient(160deg, #132018 0%, #2f4f3f 38%, #6b9070 65%, #a67c52 92%)",
    accentGlow: "rgba(139, 160, 120, 0.38)",
    emoji: "🎛️",
    plays: "9.6K",
    creator: "1ONE 实验室",
    shelf: "featured",
    badge: "new",
  },
  {
    id: "td-carrot",
    title: "萝卜守护战",
    subtitle: "萌系塔防 · 多塔型 · 多波次",
    prompt: "做一个保卫萝卜风格的萌系塔防：小猫防御塔守护胡萝卜，敌人是捣蛋鼠，强调波次、升级与金币经济。",
    tags: ["塔防", "萌系", "波次", "升级"],
    coverImageSrc: "/samples/td-carrot.svg",
    coverAlt: "萝卜守护战：萌系塔防、波次与升级示意封面",
    coverGradient:
      "linear-gradient(145deg, #fb923c 0%, #f472b6 38%, #4ade80 72%, #0f766e 100%)",
    accentGlow: "rgba(251, 146, 60, 0.45)",
    emoji: "🥕",
    plays: "128.4K",
    creator: "1ONE 实验室",
    shelf: "featured",
    badge: "hot",
  },
  {
    id: "td-kingdom",
    title: "王国边境防线",
    subtitle: "史诗塔防 · 装甲怪 · 减速控制",
    prompt: "做一个 Kingdom Rush 风格的史诗塔防：箭塔、炸弹塔、寒霜塔，敌人有装甲怪和刺客，波次更硬核。",
    tags: ["塔防", "史诗", "硬核", "策略"],
    coverImageSrc: "/samples/td-kingdom.svg",
    coverAlt: "王国边境防线：史诗塔防与城防示意封面",
    coverGradient:
      "linear-gradient(155deg, #78350f 0%, #b45309 35%, #fcd34d 65%, #1e3a5f 100%)",
    accentGlow: "rgba(252, 211, 77, 0.35)",
    emoji: "🏰",
    plays: "86.2K",
    creator: "1ONE 实验室",
    shelf: "featured",
  },
  {
    id: "td-cyber",
    title: "（风格示例）数据防线",
    subtitle: "自选 · 霓虹/赛博塔防 · 高对比示意",
    prompt: "赛博朋克霓虹塔防：防御塔是脉冲炮与减速协议，敌军是入侵程序与装甲无人机，强调高对比冷暖配色。",
    tags: ["塔防", "赛博", "霓虹", "高对比"],
    coverImageSrc: "/samples/td-cyber.svg",
    coverAlt: "数据防线示例：需在描述里写明霓虹/赛博氛围",
    coverGradient:
      "linear-gradient(160deg, #0f172a 0%, #312e81 40%, #22d3ee 72%, #a855f7 100%)",
    accentGlow: "rgba(34, 211, 238, 0.4)",
    emoji: "🛡️",
    plays: "54.7K",
    creator: "1ONE 实验室",
    shelf: "trending",
  },
  {
    id: "plat-ruins",
    title: "古迹废墟跑酷",
    subtitle: "平台跳跃 · 多层平台 · 陷阱收集",
    prompt: "横版闯关：手绘石纹与青苔废墟里多层跳跃，收集松明火种，躲开尖刺与断裂桥面，节奏紧凑、配色偏自然哑光。",
    tags: ["平台跳跃", "闯关", "收集", "手绘风"],
    coverImageSrc: "/samples/plat-ruins.svg",
    coverAlt: "古迹废墟跑酷：平台跳跃与收集示意封面",
    coverGradient:
      "linear-gradient(155deg, #1c2520 0%, #41554a 42%, #7d8f7a 74%, #5c4f3f 100%)",
    accentGlow: "rgba(125, 143, 122, 0.36)",
    emoji: "⚡",
    plays: "31.9K",
    creator: "1ONE 实验室",
    shelf: "trending",
    badge: "new",
  },
];

const SHELF_META: Record<
  SampleShelf,
  { title: string; description: string; cardClass: string }
> = {
  featured: {
    title: "编辑精选",
    description: "高完成度模板，一键生成即可试玩",
    cardClass: "w-[min(88vw,280px)] shrink-0 snap-start sm:w-[260px]",
  },
  trending: {
    title: "更多灵感",
    description: "童话塔防、森林休闲与闯关风格，按需再选霓虹向示例卡片",
    cardClass: "w-[min(78vw,200px)] shrink-0 snap-start sm:w-[200px]",
  },
};

export function samplesByShelf(shelf: SampleShelf): Sample[] {
  return SAMPLES.filter((s) => s.shelf === shelf);
}

export function shelfConfig(shelf: SampleShelf) {
  return SHELF_META[shelf];
}

export const SAMPLE_SHELVES: SampleShelf[] = ["featured", "trending"];
