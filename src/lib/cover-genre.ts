/** 网文封面题材（背景画风 + 标题配色） */
export type CoverGenre =
  | "xianxia"
  | "wuxia"
  | "urban"
  | "transmigration"
  | "historical"
  | "fantasy"
  | "scifi"
  | "romance"
  | "mystery"
  | "general";

export interface CoverGenreStyle {
  label: string;
  /** 文生图背景描述（英文，不含文字） */
  backgroundPrompt: string;
  titleColor: string;
  titleGlow: string;
  accentColor: string;
}

export const COVER_GENRE_STYLES: Record<CoverGenre, CoverGenreStyle> = {
  xianxia: {
    label: "仙侠",
    backgroundPrompt:
      "Chinese xianxia immortal cultivation novel cover background, ethereal Buddha or daoist figure silhouette, teal spiritual energy mist, dark mystical atmosphere, orange ember particles, cinematic fantasy art, no text",
    titleColor: "#F0C14A",
    titleGlow: "0 0 24px rgba(240, 193, 74, 0.85), 0 4px 12px rgba(0,0,0,0.9)",
    accentColor: "#5EC4C4",
  },
  wuxia: {
    label: "武侠",
    backgroundPrompt:
      "Chinese wuxia martial arts novel cover, misty mountains, swordsman silhouette, ink wash painting mixed with cinematic realism, bamboo forest, dramatic sky, no text",
    titleColor: "#FFFFFF",
    titleGlow: "0 2px 4px rgba(0,0,0,0.95), 0 0 20px rgba(180,40,40,0.5)",
    accentColor: "#C43C3C",
  },
  urban: {
    label: "都市",
    backgroundPrompt:
      "modern Chinese urban fiction book cover, neon city skyline at night, luxury office or street bokeh, sleek contemporary mood, cinematic photography style, no text",
    titleColor: "#FFFFFF",
    titleGlow: "0 2px 8px rgba(0,0,0,0.85), 0 0 16px rgba(80,160,255,0.4)",
    accentColor: "#4A9EFF",
  },
  transmigration: {
    label: "穿越",
    backgroundPrompt:
      "Chinese time travel fantasy cover, portal between ancient palace and modern city, swirling golden light, dual era contrast, magical realism, epic composition, no text",
    titleColor: "#FFE566",
    titleGlow: "0 0 20px rgba(255, 200, 80, 0.8), 0 4px 10px rgba(0,0,0,0.85)",
    accentColor: "#9B6BFF",
  },
  historical: {
    label: "历史",
    backgroundPrompt:
      "Chinese historical fiction cover, imperial palace and mountain mist, Ming or Qing dynasty atmosphere, period armor or robe silhouette, oil painting cinematic, no text",
    titleColor: "#E8B84A",
    titleGlow: "0 3px 10px rgba(0,0,0,0.9), 0 0 18px rgba(200,60,40,0.45)",
    accentColor: "#8B2500",
  },
  fantasy: {
    label: "玄幻",
    backgroundPrompt:
      "Chinese xuanhuan fantasy novel cover, epic magical beast or warrior, storm and lightning, vivid energy effects, detailed digital painting, no text",
    titleColor: "#FFD966",
    titleGlow: "0 0 22px rgba(255, 120, 40, 0.7), 0 4px 12px rgba(0,0,0,0.9)",
    accentColor: "#FF6B35",
  },
  scifi: {
    label: "科幻",
    backgroundPrompt:
      "science fiction novel cover, futuristic city, spacecraft, cyan neon holograms, dark space background, cinematic sci-fi art, no text",
    titleColor: "#7EE8FF",
    titleGlow: "0 0 20px rgba(0, 220, 255, 0.75), 0 3px 10px rgba(0,0,0,0.9)",
    accentColor: "#00D4FF",
  },
  romance: {
    label: "言情",
    backgroundPrompt:
      "romantic Chinese web novel cover, soft bokeh flowers, warm sunset, elegant couple silhouette optional, pastel dreamy atmosphere, no text",
    titleColor: "#FFE8F0",
    titleGlow: "0 2px 8px rgba(180,60,100,0.6), 0 3px 10px rgba(0,0,0,0.5)",
    accentColor: "#FF8FAB",
  },
  mystery: {
    label: "悬疑",
    backgroundPrompt:
      "mystery thriller novel cover, noir rain city alley, single light source, suspense shadows, cool blue tone, no text",
    titleColor: "#E8E8E8",
    titleGlow: "0 0 16px rgba(200,200,255,0.35), 0 4px 12px rgba(0,0,0,0.95)",
    accentColor: "#6B7CFF",
  },
  general: {
    label: "通用",
    backgroundPrompt:
      "professional Chinese web novel cover illustration, atmospheric scene matching epic fiction, rich colors, cinematic lighting, leave lower third for title, no text no letters",
    titleColor: "#FFFFFF",
    titleGlow: "0 2px 10px rgba(0,0,0,0.9), 0 0 12px rgba(255,255,255,0.25)",
    accentColor: "#C45C26",
  },
};

/** 根据标题、摘要、创意推断题材 */
export function inferCoverGenre(title: string, summary = "", storyHint = ""): CoverGenre {
  const t = `${title} ${summary} ${storyHint}`;

  if (/仙侠|修仙|渡劫|仙界|天道|灵根|飞升|宗门|元婴|金丹/.test(t)) return "xianxia";
  if (/武侠|江湖|剑客|武林|门派|大侠|刀光/.test(t)) return "wuxia";
  if (/穿越|重生|穿成|回到.*(年|朝|代)|转生|逆袭/.test(t)) return "transmigration";
  if (/都市|总裁|豪门|职场|校园|娱乐圈|神医|兵王|赘婿/.test(t)) return "urban";
  if (/崇祯|明末|大清|三国|秦汉|唐宋|历史|王朝|京城|宫廷|朝堂|皇帝|皇后/.test(t)) return "historical";
  if (/科幻|赛博|星际|未来|机器人|太空|末世/.test(t)) return "scifi";
  if (/言情|恋爱|甜宠|婚恋|竹马|青梅/.test(t)) return "romance";
  if (/悬疑|推理|侦探|谋杀|密室|刑侦/.test(t)) return "mystery";
  if (/玄幻|异界|魔兽|斗气|魔法|系统|升级流/.test(t)) return "fantasy";

  return "general";
}
