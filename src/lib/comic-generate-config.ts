import type { ComicPage } from "@/lib/comic-format";
import type { NovelLengthTier } from "@/lib/novel-length";
import { PRODUCT } from "@/lib/product-config";
import {
  buildUrbanPanelImagePrompt,
  isPlaceholderComicPanel,
  panelPromptLooksFantasy,
  type ComicStoryContext,
} from "@/lib/comic-panel-prompt-urban";
import {
  getComicPanelStyleLock,
  type CoverGenre,
} from "@/lib/cover-genre";
import type { ComicDirectorPack } from "@/lib/comic-director-types";
import { normalizePanelTextFields } from "@/lib/comic-panel-text";
import {
  getComicStylePreset,
  type ComicStylePresetId,
} from "@/lib/comic-style-presets";
import { formatCharacterRosterForPrompt, type ComicCharacterRoster } from "@/lib/comic-character-roster";
import { formatPlotDigestForPrompt, type ComicPlotDigest } from "@/lib/comic-preread";
import { buildFinalPanelImagePrompt, shotFramingHint, type PlannedComicPanel } from "@/lib/comic-shot-plan";
import {
  getComicLayout,
  panelsPerPageForLayout,
  resolveComicLayoutId,
  type ComicLayoutId,
} from "@/lib/comic-layout";

/** @deprecated 请用 panelsPerPageForLayout(layoutId)；默认四宫格 */
export const PANELS_PER_PAGE = 4;
export const COMIC_MAX_PAGES = 32;

/** 按小说篇幅默认漫画页数 */
export const COMIC_DEFAULT_PAGES: Record<NovelLengthTier, number> = {
  short: 4,
  children: 4,
  medium: 8,
  long: 16,
};

export { panelsPerPageForLayout, resolveComicLayoutId, type ComicLayoutId };

export function defaultPanelPrompt(
  genre: CoverGenre = "general",
  stylePreset?: ComicStylePresetId,
): string {
  const preset = stylePreset ? getComicStylePreset(stylePreset) : null;
  const style = preset?.promptEn ?? getComicPanelStyleLock(genre);
  return `${style}, highly detailed manga panel, dramatic composition with clear focal point, expressive character pose, rich environmental detail, cinematic lighting`;
}

/** 小说转漫画质量总则（分镜 LLM system 注入） */
export const COMIC_MASTER_QUALITY_BLOCK = `【改编总则 — 必须遵守】
1. 严格按原文小说剧情制作连载漫画：逐段对应分镜，禁止私自篡改、脑补无关画面。
2. 每一格必须还原该段落的动作、神态、场景氛围、人物站位；区分打斗/对话/独处/回忆，情绪贴合原文。
3. 全程固定所有人物外貌、发型、服饰、身高与标志性特征，整本人设统一。
4. 规范漫画分镜：合理搭配远景( wide )交代场景、中景( medium )互动、特写( close )表情、必要时过肩( over_shoulder )。
5. 中文叠字体系（画进网页，不画进图里）：
   - textType=dialogue：人物台词，caption 只写台词正文，speaker 写说话人名
   - textType=narration：页面叙事旁白（老式小人书解说）
   - textType=inner：内心独白，caption 用（……）包裹
   - textType=scene_note：场景/道具/环境注解
   - textType=time_place：时间地点标注
6. prompt 仅英文描述可见画面，禁止 dialogue / speech bubble / 可读文字 / 网红厚涂美颜 / 夸张二次元浓妆特效。
7. **prompt 质量要求（极重要）**：每一格 prompt 必须是 **80–150 词的完整英文画面描述**，不可偷懒写成"角色在房间里"这类空泛短语。必须包含：
   - 具体场景环境（室内/室外、天气、光源方向、材质）
   - 人物外貌+服饰+动作+表情（若有人设锁定则严格按人设描述）
   - shotType 对应的构图（wide=全景交代空间关系，medium=中景两人互动，close=表情特写）
   - 画面氛围关键词（lighting, mood, color temperature）
   - 禁止在 prompt 中写对话内容或文字气泡
8. **漫画感（重要）**：动作场面可加入 speed lines（速度线）、motion blur、impact frames；紧张场面可用 dramatic shadows、dutch angle；抒情场面用 soft focus、浅景深。prompt 中应体现这些漫画技法关键词。`;

/** 文生图统一约束：中文对白由页面 caption 叠字，禁止模型在画面内生成任何可读文字。 */
export const COMIC_IMAGE_NO_TEXT_SUFFIX =
  "Illustration only. No text, no letters, no English or Chinese words in the image, no speech bubbles with readable writing, no subtitles or signs with legible characters.";

export type PanelImagePromptOpts = {
  sceneIndex?: number;
  totalScenes?: number;
  story?: ComicStoryContext;
  stylePreset?: ComicStylePresetId;
};

/** 将分镜格转为文生图 prompt（英文画面描述 + 题材画风锁 + 禁止图内文字）。 */
export function buildPanelImagePrompt(
  panel: {
    prompt?: string;
    caption?: string;
    characterIds?: string[];
    locationId?: string;
    shotType?: string;
    sceneDescriptionEn?: string;
  },
  genre: CoverGenre = "general",
  opts?: PanelImagePromptOpts & { director?: ComicDirectorPack },
): string {
  if (opts?.director && (panel.sceneDescriptionEn || panel.characterIds?.length)) {
    return buildFinalPanelImagePrompt(opts.director, panel as PlannedComicPanel, genre);
  }
  if (panel.prompt?.includes("Illustration only") && panel.prompt.length > 120) {
    return panel.prompt;
  }
  if (
    genre === "urban" &&
    opts?.story &&
    typeof opts.sceneIndex === "number" &&
    (isPlaceholderComicPanel(panel) ||
      panelPromptLooksFantasy(panel.prompt ?? "") ||
      panelPromptLooksFantasy(panel.caption ?? ""))
  ) {
    return buildUrbanPanelImagePrompt({
      panel,
      sceneIndex: opts.sceneIndex,
      totalScenes: opts.totalScenes ?? opts.sceneIndex,
      story: opts.story,
    });
  }

  const styleLock = opts?.stylePreset
    ? getComicStylePreset(opts.stylePreset).promptEn
    : getComicPanelStyleLock(genre);
  const shotHint = panel.shotType ? shotFramingHint(panel.shotType as import("@/lib/comic-director-types").ComicShotType) : "";
  const raw = panel.prompt?.trim();
  const caption = panel.caption?.trim() ?? "";
  let base = raw;
  if (!base || (genre === "urban" && raw && panelPromptLooksFantasy(raw))) {
    base = caption && !panelPromptLooksFantasy(caption)
      ? `Manga comic panel, ${styleLock}, scene for story beat (dialogue not in image): ${caption.slice(0, 80)}`
      : defaultPanelPrompt(genre, opts?.stylePreset);
  } else if (!/modern urban|contemporary|都市|realistic/i.test(base) && genre === "urban") {
    base = `${styleLock}. ${base}`;
  } else if (!new RegExp(styleLock.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(base)) {
    base = `${styleLock}. ${base}`;
  }
  if (shotHint && !base.toLowerCase().includes(shotHint.slice(0, 12).toLowerCase())) {
    base = `${shotHint}. ${base}`;
  }
  if (/no text|without text|no lettering|no speech bubble|illustration only/i.test(base)) {
    return `${base}. ${COMIC_IMAGE_NO_TEXT_SUFFIX}`;
  }
  return `${base}. ${COMIC_IMAGE_NO_TEXT_SUFFIX}`;
}

/** 将模型输出的 pages 规整为固定页数、每页 4 格，避免页数略少或格子不齐导致整段生成失败或配图错位。 */
export function normalizeComicPagesForGeneration(
  rawPages: ComicPage[],
  targetPageCount: number,
  genre: CoverGenre = "general",
  stylePreset?: ComicStylePresetId,
  layoutId: ComicLayoutId = "grid_4",
): ComicPage[] {
  const panelsPerPage = panelsPerPageForLayout(layoutId);
  const fallbackPrompt = defaultPanelPrompt(genre, stylePreset);
  const safe = rawPages.filter((p) => p && typeof p === "object");
  if (targetPageCount < 1 || safe.length < 1) return [];

  const out: ComicPage[] = [];
  for (let i = 0; i < targetPageCount; i++) {
    const src = safe[Math.min(i, safe.length - 1)]!;
    let panels = [...(src.panels ?? [])]
      .filter((pan) => pan && typeof pan === "object")
      .slice(0, panelsPerPage)
      .map((pan, j) => {
        const text = normalizePanelTextFields(pan);
        const sceneDescriptionEn = String(pan.sceneDescriptionEn ?? "").trim() || undefined;
        const characterIds = Array.isArray(pan.characterIds)
          ? pan.characterIds.filter((id) => typeof id === "string" && id.trim())
          : undefined;
        const locationId =
          typeof pan.locationId === "string" && pan.locationId.trim()
            ? pan.locationId.trim()
            : undefined;
        return {
          scene: i * panelsPerPage + j + 1,
          caption: text.caption,
          prompt: String(pan.prompt ?? "").trim() || fallbackPrompt,
          textType: text.textType,
          ...(text.speaker ? { speaker: text.speaker } : {}),
          shotType: text.shotType,
          ...(text.sourceSegmentIndex !== undefined
            ? { sourceSegmentIndex: text.sourceSegmentIndex }
            : {}),
          ...(characterIds?.length ? { characterIds } : {}),
          ...(locationId ? { locationId } : {}),
          ...(sceneDescriptionEn ? { sceneDescriptionEn } : {}),
        };
      });

    while (panels.length < panelsPerPage) {
      const j = panels.length;
      panels.push({
        scene: i * panelsPerPage + j + 1,
        caption: panels[j - 1]?.caption ? `${panels[j - 1]!.caption}（续）` : "……",
        prompt: panels[j - 1]?.prompt ?? fallbackPrompt,
        textType: "narration",
        shotType: "medium",
      });
    }

    out.push({ page: i + 1, panels });
  }
  return out;
}

/** 长篇或页数较多时使用导演流水线。 */
export function shouldUseLongComicPipeline(
  pageCount: number,
  lengthTier?: NovelLengthTier | null,
): boolean {
  if (lengthTier === "long") return true;
  // 4 页以上短篇也走导演流水线以保证人物一致性与分镜质量
  if (pageCount >= 4) return true;
  return false;
}

export function resolveComicPageCount(opts: {
  lengthTier?: NovelLengthTier | null;
  pageCount?: number | null;
  contentLength?: number;
}): number {
  if (typeof opts.pageCount === "number" && opts.pageCount > 0) {
    return Math.min(COMIC_MAX_PAGES, Math.max(1, Math.floor(opts.pageCount)));
  }
  if (opts.lengthTier && opts.lengthTier in COMIC_DEFAULT_PAGES) {
    return COMIC_DEFAULT_PAGES[opts.lengthTier];
  }
  const len = opts.contentLength ?? 0;
  if (len < 2000) return COMIC_DEFAULT_PAGES.short;
  if (len < 10000) return COMIC_DEFAULT_PAGES.medium;
  return COMIC_DEFAULT_PAGES.long;
}

const COMIC_GENRE_GUIDE: Record<CoverGenre, string> = {
  urban:
    "题材：**现代都市**（当代中国城市/职场/豪门/校园均可，但必须是现代社会）。prompt 中写现代服装、城市街景/办公室/公寓、手机汽车；**禁止**古装、仙侠、魔法阵、紫色能量、异界怪兽。",
  xianxia: "题材：仙侠修仙。prompt 可含灵气、法衣、山云等。",
  wuxia: "题材：武侠江湖。prompt 含古代武林服饰与环境。",
  transmigration: "题材：穿越/重生。画面需体现时代感对比或剧情设定。",
  historical: "题材：历史古代。服饰建筑须符合朝代。",
  fantasy: "题材：玄幻异界。可有魔法或异兽，风格统一。",
  scifi: "题材：科幻未来。科技元素统一。",
  romance: "题材：言情。人物与氛围偏情感向。",
  mystery: "题材：悬疑。光影偏紧张。",
  general: "题材：与正文一致；若正文是现代都市则禁止画成古代或仙侠。",
};

export function buildComicSystemPrompt(
  pageCount: number,
  genre: CoverGenre = "general",
  stylePreset: ComicStylePresetId = "japanese_clean",
  extras?: {
    roster?: ComicCharacterRoster | null;
    plotDigest?: ComicPlotDigest | null;
    layoutId?: ComicLayoutId;
  },
): string {
  const layoutId = extras?.layoutId ?? "grid_4";
  const layout = getComicLayout(layoutId);
  const panelsPerPage = layout.panelsPerPage;
  const totalPanels = pageCount * panelsPerPage;
  const genreGuide = COMIC_GENRE_GUIDE[genre] ?? COMIC_GENRE_GUIDE.general;
  const preset = getComicStylePreset(stylePreset);
  const rosterBlock = extras?.roster?.characters.length
    ? `\n【锁定人设 — 全片不得变脸】\n${formatCharacterRosterForPrompt(extras.roster)}\n`
    : "";
  const digestBlock = extras?.plotDigest
    ? `\n${formatPlotDigestForPrompt(extras.plotDigest)}\n`
    : "";
  return `你是一位擅长连载漫画分镜的 AI 艺术家。用户会提供**按段落编号**的小说节选，你必须逐段改编，禁止断章取义只抓关键词。

${COMIC_MASTER_QUALITY_BLOCK}
${digestBlock}${rosterBlock}

${genreGuide}

**全片画风（贯穿每一格 prompt）**：${preset.label} — ${preset.promptEn}

目标：**尽量输出 ${pageCount} 页**，每页 **尽量 ${panelsPerPage} 格**（理想共 ${totalPanels} 格）。${layout.layoutGuideZh} 若篇幅所限，至少 **1 页、每页至少 1 格**。

要求：
1. 只输出 JSON，不要 markdown
2. 根对象 "pages" 长度 **1～${pageCount}**
3. 每页 "panels" **1～${panelsPerPage}** 格
4. 每格字段：
   - scene：全书格序号（从 1 递增）
   - sourceSegmentIndex：对应提供的 [段落#N] 的 N-1（整数，尽量填写）
   - textType：dialogue | narration | inner | scene_note | time_place
   - speaker：对白时说话人名（其它类型可省略）
   - caption：中文叠字（≤48 字）
   - shotType：wide | medium | close | over_shoulder | extreme_close
   - prompt：英文 **80–150 词**，${preset.promptEn}，详细描述场景/人物/动作/光影/氛围，**必须包含具体环境细节与镜头构图感**。禁止图内文字与气泡。动作场加 speed lines/motion blur，紧张场加 dramatic shadows，抒情场加 soft focus
5. 约 **1 个段落对应 1～2 格**；优先还原该段动作、对话、情绪，不脑补原文没有的情节
6. 开篇先用 narration 或 scene_note 交代场景，对话格用 dialogue + speaker
7. prompt 质量红线：每格 prompt 必须 ≥60 词英文，包含人物外貌、场景环境、动作、光影氛围至少四项；空泛短语（如 "A character in a room"）会被文生图模型退回重写`;
}

export function buildComicJsonSchema(pageCount: number, layoutId: ComicLayoutId = "grid_4") {
  const maxPanels = panelsPerPageForLayout(layoutId);
  const panelSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      scene: { type: "integer" },
      sourceSegmentIndex: { type: "integer" },
      textType: {
        type: "string",
        enum: ["dialogue", "narration", "inner", "scene_note", "time_place"],
      },
      speaker: { type: "string" },
      caption: { type: "string" },
      shotType: {
        type: "string",
        enum: ["wide", "medium", "close", "over_shoulder", "extreme_close"],
      },
      prompt: { type: "string" },
    },
    required: ["scene", "textType", "caption", "shotType", "prompt"],
  };

  const pageSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      page: { type: "integer" },
      panels: {
        type: "array",
        minItems: 1,
        maxItems: maxPanels,
        items: panelSchema,
      },
    },
    required: ["page", "panels"],
  };

  return {
    name: "comic_pages",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        pages: {
          type: "array",
          minItems: 1,
          maxItems: pageCount,
          items: pageSchema,
        },
      },
      required: ["pages"],
    },
  };
}
