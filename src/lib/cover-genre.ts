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
      "modern Chinese urban web novel cover, contemporary China: luxury CBD skyscrapers, five-star hotel banquet hall or corner office with city view, young businessman in tailored suit, sports car, smartphones, cinematic photorealistic illustration, slice-of-life drama and corporate wealth, absolutely NO xianxia, NO cultivation, NO purple energy, NO magic vortex, NO ancient palace, NO fantasy armor, NO apocalyptic ruins, no text",
    titleColor: "#FFFFFF",
    titleGlow: "0 2px 8px rgba(0,0,0,0.85), 0 0 16px rgba(80,160,255,0.4)",
    accentColor: "#4A9EFF",
  },
  transmigration: {
    label: "穿越",
    backgroundPrompt:
      "Chinese time-travel web novel cover, dual-era composition in one frame: young modern Chinese protagonist in contemporary casual clothes (clear portrait, foreground or left half) combined with historical destination world (right half or background), golden portal or time-rift between eras, cinematic magical realism, epic vertical composition, NOT only modern city alone, NOT only ancient scene without any modern person, no text",
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

/** 漫画分镜 / 配图统一画风（英文，拼进 panel prompt） */
export const COMIC_PANEL_STYLE_LOCKS: Record<CoverGenre, string> = {
  urban:
    "modern contemporary urban China, realistic clothing, city skyline or office or apartment interior, cars and smartphones, cinematic realism, slice-of-life drama, NO fantasy magic, NO ancient costume, NO xianxia robes, NO purple energy vortex",
  xianxia:
    "Chinese xianxia cultivation fantasy, spiritual energy, flowing robes, mountains and clouds, ethereal lighting, consistent character design",
  wuxia:
    "Chinese wuxia martial arts, period hanfu or martial attire, bamboo and mountains, ink-wash cinematic style",
  transmigration:
    "Chinese web novel fantasy, clear era contrast if needed, polished digital illustration, consistent characters",
  historical:
    "Chinese historical period drama, traditional architecture and costumes matching dynasty, cinematic lighting",
  fantasy:
    "Chinese xuanhuan fantasy illustration, dramatic energy effects, detailed digital painting",
  scifi: "science fiction, futuristic technology, neon and metallic surfaces, cinematic sci-fi",
  romance: "romantic contemporary or soft pastel atmosphere, elegant characters, warm lighting",
  mystery: "noir urban suspense, rain and shadows, cool tones, contemporary or period as story demands",
  general:
    "professional Chinese web comic panel, cinematic lighting, consistent character design, match story setting",
};

export function getComicPanelStyleLock(genre: CoverGenre): string {
  return COMIC_PANEL_STYLE_LOCKS[genre] ?? COMIC_PANEL_STYLE_LOCKS.general;
}

const URBAN_GENRE_RE =
  /都市|现代|当代|总裁|豪门|职场|校园|娱乐圈|神医|兵王|赘婿|首富|继承人|千亿|亿万|富豪|商战|集团|董事|CEO|别墅|豪宅|写字楼|直播|网红|外卖|地铁|藏拙|被曝光|隐瞒.*身份|都市生活|一线城市|打工人|月薪|写字楼|宴会|晚宴|商战/;

/** 根据标题、摘要、创意推断题材 */
export function inferCoverGenre(title: string, summary = "", storyHint = ""): CoverGenre {
  const t = `${title} ${summary} ${storyHint}`;
  const headline = `${title} ${summary}`.trim();

  if (/仙侠|修仙|渡劫|仙界|天道|灵根|飞升|宗门|元婴|金丹|剑仙|功法/.test(t)) return "xianxia";
  if (/武侠|江湖|剑客|武林|门派|大侠|刀光|内力/.test(t)) return "wuxia";

  /** 标题/摘要含豪门都市信号时优先（正文「未来」等勿判科幻） */
  if (URBAN_GENRE_RE.test(headline)) return "urban";
  if (URBAN_GENRE_RE.test(t)) return "urban";

  if (/言情|恋爱|甜宠|婚恋|竹马|青梅/.test(t)) return "romance";
  if (/悬疑|推理|侦探|谋杀|密室|刑侦/.test(t)) return "mystery";
  if (/崇祯|明末|大清|三国|秦汉|唐宋|历史|王朝|朝堂|皇帝|皇后|宫廷(?!.*都市)/.test(t)) return "historical";
  if (/科幻|赛博|星际|机器人|太空|末世|机甲|未来世界|未来都市|未来科技/.test(t)) return "scifi";

  if (/穿越|穿成|回到.*(年|朝|代)|转生/.test(t)) return "transmigration";
  if (/重生|逆袭/.test(t) && !/古代|宫廷|仙侠|修仙|异界|玄幻|王朝|皇上|陛下/.test(t)) return "urban";
  if (/玄幻|异界|魔兽|斗气|魔法|系统|升级流|灵力|血脉觉醒/.test(t)) return "fantasy";

  return "general";
}

/** 从标题 + 摘要 + 创意/正文片段推断题材（漫画/封面共用） */
export function inferStoryGenre(opts: {
  title: string;
  summary?: string | null;
  prompt?: string | null;
  contentSnippet?: string | null;
}): CoverGenre {
  const hint = [opts.prompt, opts.contentSnippet].filter(Boolean).join(" ").trim();
  return inferCoverGenre(opts.title, opts.summary ?? "", hint);
}

/** 封面题材：优先创作台类型（genreTagCoverGenre），再标题/摘要，最后才看正文片段。 */
export function resolveNovelCoverGenre(opts: {
  title: string;
  summary?: string | null;
  prompt?: string | null;
  contentSnippet?: string | null;
  /** 创作台所选类型对应的 coverGenre */
  genreTagCoverGenre?: CoverGenre | null;
}): CoverGenre {
  if (opts.genreTagCoverGenre) return opts.genreTagCoverGenre;

  const headline = inferCoverGenre(
    opts.title,
    opts.summary ?? "",
    [opts.prompt, opts.title].filter(Boolean).join(" "),
  );
  if (headline !== "general") return headline;

  if (opts.contentSnippet?.trim()) {
    const withBody = inferStoryGenre(opts);
    if (withBody !== "general") return withBody;
  }

  return headline;
}
