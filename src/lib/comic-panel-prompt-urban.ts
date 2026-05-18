import { getComicPanelStyleLock } from "@/lib/cover-genre";

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
