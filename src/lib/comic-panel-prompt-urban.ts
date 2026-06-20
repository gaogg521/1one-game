import { getComicPanelStyleLock, type CoverGenre } from "@/lib/cover-genre";

const COMIC_IMAGE_NO_TEXT_SUFFIX =
  "Illustration only. No text, no letters, no English or Chinese words in the image, no speech bubbles with readable writing, no subtitles or signs with legible characters.";

const PLACEHOLDER_CAPTION = /^[.…。．\s]+$/;
const PLACEHOLDER_PROMPT =
  /^Comic panel,?\s*story continues/i;

const FANTASY_PROMPT_RE =
  /xianxia|cultivation|spiritual energy|purple (?:glow|energy|vortex)|magic(?:al)?|immortal|ancient (?:robe|palace|costume)|sect|realm|demon|apocalypse|ruins|energy blast|lightning aura|仙侠|修仙|灵气|法术|紫(?:色|雾)|能量(?:漩涡|爆发)|玄幻|修炼|渡劫|宗门|法宝/i;

/** 分镜 LLM 失败或占位时 caption/prompt 无效 */
export function isPlaceholderComicPanel(panel: {
  caption?: string;
  prompt?: string;
}): boolean {
  const cap = panel.caption?.trim() ?? "";
  const pr = panel.prompt?.trim() ?? "";
  if (!cap || PLACEHOLDER_CAPTION.test(cap)) return true;
  if (!pr || PLACEHOLDER_PROMPT.test(pr)) return true;
  return false;
}

export function panelPromptLooksFantasy(prompt: string): boolean {
  return FANTASY_PROMPT_RE.test(prompt);
}

const HISTORICAL_CONTEXT_RE =
  /崇祯|明末|大明|皇帝|陛下|宫城|宫门|殿上|朝堂|锦衣卫|内阁|古代|王朝|宫廷|hanfu|historical|imperial|palace|dynasty|robe/i;

export function panelLooksHistoricalOrPeriod(panel: {
  caption?: string;
  prompt?: string;
}): boolean {
  const blob = `${panel.caption ?? ""} ${panel.prompt ?? ""}`;
  return HISTORICAL_CONTEXT_RE.test(blob);
}

/** 按全局格序号在都市爽文节奏里选场景（豪门/逆袭类） */
const URBAN_SCENE_BEATS = [
  "protagonist in plain casual clothes on crowded modern Chinese city street, subway entrance, skyscrapers, smartphones, realistic manhua",
  "open-plan corporate office, young man at desk in simple shirt, colleagues chatting, fluorescent lighting, contemporary China",
  "office break room tension, protagonist looked down upon, modern workplace drama, subtle humiliation, realistic faces",
  "night view of luxury CBD towers and hotel facade, glass curtain walls, cars, urban wealth contrast",
  "five-star hotel banquet hall, chandeliers, guests in business formal wear, upscale modern interior",
  "dramatic identity reveal, protagonist in tailored designer suit, shocked crowd, cinematic urban lighting",
  "corner office with floor-to-ceiling windows overlooking city skyline, protagonist confident, power shift",
  "modern rooftop terrace at night, city lights bokeh, confrontation and comeuppance, realistic contemporary fashion",
];

export function pickUrbanSceneBeat(sceneIndex: number, totalScenes: number): string {
  if (totalScenes < 1) return URBAN_SCENE_BEATS[0]!;
  const idx = Math.min(
    URBAN_SCENE_BEATS.length - 1,
    Math.floor(((sceneIndex - 1) / totalScenes) * URBAN_SCENE_BEATS.length),
  );
  return URBAN_SCENE_BEATS[idx]!;
}

export type ComicStoryContext = {
  title: string;
  summary: string;
};

/** 都市题材：用小说摘要 + 格序号重建文生图 prompt（绕过占位/玄幻分镜文案） */
export function buildUrbanPanelImagePrompt(opts: {
  panel: { caption?: string; prompt?: string };
  sceneIndex: number;
  totalScenes: number;
  story: ComicStoryContext;
}): string {
  const styleLock = getComicPanelStyleLock("urban");
  const beat = pickUrbanSceneBeat(opts.sceneIndex, opts.totalScenes);
  const cap = opts.panel.caption?.trim() ?? "";
  const useCaption =
    cap && !PLACEHOLDER_CAPTION.test(cap) && !panelPromptLooksFantasy(cap);
  const storyBit = opts.story.summary.trim().slice(0, 220);
  const sceneLine = useCaption
    ? `Story beat (do not draw text): ${cap.slice(0, 100)}`
    : `Scene matching plot: ${beat}`;

  return [
    "Modern urban China manhua comic panel, photorealistic anime style",
    styleLock,
    `Novel: ${opts.story.title.slice(0, 60)}.`,
    storyBit ? `Plot context: ${storyBit}.` : "",
    sceneLine,
    COMIC_IMAGE_NO_TEXT_SUFFIX,
  ]
    .filter(Boolean)
    .join(" ");
}

export function docHasPlaceholderPanels(doc: {
  pages: { panels: { caption?: string; prompt?: string }[] }[];
}): boolean {
  for (const page of doc.pages) {
    for (const panel of page.panels) {
      if (isPlaceholderComicPanel(panel)) return true;
    }
  }
  return false;
}

// ★ 多题材占位分镜恢复机制

/** 仙侠/玄幻题材场景库 */
const XIANXIA_FANTASY_SCENE_BEATS = [
  "lush mountain peak with ancient stone temple, spiritual energy mist, purple glow, cultivation garden, xianxia style",
  "sect headquarters inner courtyard, disciples in ancient robes practicing with qi flows, peaceful cultivation",
  "cave dwelling deep in mountain, character in meditation trance, mysterious auras swirling, enlightenment",
  "heavenly realm encounter, immortal beings in celestial robes, clouds and fortune, golden light, godly atmosphere",
  "cultivation breakthrough, tribulation lightning striking, powerful transformation, energy shockwave, xianxia climax",
  "secret realm portal opening, ancient array glowing, mystical energy, dimensional tear, magical effects",
  "enemy confrontation on floating island, qi aura clash, magic spell effects, combat stance, epic scale",
  "night meditation under starry sky, moonlight on water, spiritual enlightenment moment, peaceful transcendence",
];

/** 武侠题材场景库 */
const WUXIA_MARTIAL_SCENE_BEATS = [
  "ancient Chinese rooftop, martial artist in kung fu stance, traditional architecture, moonlit night, skilled hand position",
  "martial arts tournament arena, fighters exchanging blows, crowd watching, dramatic combat moment, dust flying",
  "secret martial arts school courtyard, masters training disciples in internal energy, pine trees, traditional training",
  "mountain gorge dramatic duel, two masters facing off, wind and energy rippling, breathtaking landscape, sword glare",
  "inn interior, tense negotiation or revelation scene, traditional wooden interior, character reaction, intrigue",
  "night stealth infiltration, character in dark robes moving silently, shadows and moonlight, ninja-like movement",
  "martial arts celebration feast, victorious character toasting, traditional hall, warm lighting, triumph atmosphere",
  "final epic confrontation, palm techniques clashing, energy vortex, life-or-death moment, dramatic cinematics",
];

/** 女频/古代言情题材场景库 */
const ROMANCE_HISTORICAL_SCENE_BEATS = [
  "elaborate imperial palace courtyard, character in exquisite Hanfu, ornate architecture, garden with flowers",
  "imperial bedroom with silk drapes, intimate moment, soft lighting, traditional luxury interior design",
  "crowded marketplace in ancient city, character observing or being observed, merchant stalls, bustling crowd",
  "rainy night garden scene, character alone or with love interest, romantic melancholy, wet lantern light",
  "grand imperial banquet hall, character in formal court dress, other nobles, hierarchical seating, elegant dinner",
  "secret rendezvous in hidden garden or pavilion, tender moment, moonlight, flowering trees, isolation and intimacy",
  "character riding in palanquin through city streets, moving perspective, crowds and architecture passing",
  "finale moment, character in finest dress, resolution of conflict, emotional climax, traditional romance resolution",
];

/**
 * 通用多题材框架：根据题材选择合适的场景库
 */
function pickGenreSceneBeat(genre: CoverGenre, sceneIndex: number, totalScenes: number): string {
  const library = (() => {
    switch (genre) {
      case "xianxia":
      case "fantasy":
        return XIANXIA_FANTASY_SCENE_BEATS;
      case "wuxia":
        return WUXIA_MARTIAL_SCENE_BEATS;
      case "romance":
      case "historical":
        return ROMANCE_HISTORICAL_SCENE_BEATS;
      default:
        return URBAN_SCENE_BEATS;
    }
  })();

  if (library.length === 0) return URBAN_SCENE_BEATS[0]!;
  const idx = Math.min(
    library.length - 1,
    Math.floor(((sceneIndex - 1) / totalScenes) * library.length),
  );
  return library[idx]!;
}

/**
 * 多题材占位分镜 prompt 重建
 * 当分镜文案为占位符时，按题材节奏重建图像描述
 */
export function buildMultiGenrePanelImagePrompt(opts: {
  panel: { caption?: string; prompt?: string };
  sceneIndex: number;
  totalScenes: number;
  story: ComicStoryContext;
  genre: CoverGenre;
}): string {
  const styleLock = getComicPanelStyleLock(opts.genre);
  const beat = pickGenreSceneBeat(opts.genre, opts.sceneIndex, opts.totalScenes);
  const cap = opts.panel.caption?.trim() ?? "";
  const useCaption = cap && !PLACEHOLDER_CAPTION.test(cap);
  const storyBit = opts.story.summary.trim().slice(0, 220);
  const sceneLine = useCaption
    ? `Story beat (do not draw text): ${cap.slice(0, 100)}`
    : `Scene: ${beat}`;

  return [
    `Manhua comic panel for ${opts.genre} genre`,
    styleLock,
    `Novel: ${opts.story.title.slice(0, 60)}.`,
    storyBit ? `Plot: ${storyBit}.` : "",
    sceneLine,
    COMIC_IMAGE_NO_TEXT_SUFFIX,
  ]
    .filter(Boolean)
    .join(" ");
}
