import type { ComicPage } from "@/lib/comic-format";
import type { NovelLengthTier } from "@/lib/novel-length";
import {
  buildUrbanPanelImagePrompt,
  isPlaceholderComicPanel,
  panelLooksHistoricalOrPeriod,
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
import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import {
  buildComicMasterQualityBlock,
  captionFieldInstruction,
  panelContinuationSuffix,
  shouldPreferLightComicPipeline,
} from "@/lib/comic-locale-prompts";
import { PRODUCT } from "@/lib/product-config";

/** @deprecated 请用 panelsPerPageForLayout(layoutId)；默认成人/通用为八宫格 */
export const PANELS_PER_PAGE = 8;
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

/** 小说转漫画质量总则（分镜 LLM system 注入，默认简体） */
export const COMIC_MASTER_QUALITY_BLOCK = buildComicMasterQualityBlock("zh");

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
    !panelLooksHistoricalOrPeriod(panel) &&
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
  const genericStyleOnly =
    !raw ||
    /^Japanese |^Manga comic panel, Japanese|^Comic panel, story continues/i.test(raw);
  let base = raw;
  if (caption && !isPlaceholderComicPanel({ caption, prompt: raw }) && genericStyleOnly) {
    base = `Manga comic panel, ${styleLock}, scene for story beat (dialogue not drawn in image): ${caption.slice(0, 100)}`;
  } else if (!base || (genre === "urban" && raw && panelPromptLooksFantasy(raw))) {
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

/** 将模型输出的 pages 规整为固定页数、固定格数，避免页数略少或格子不齐导致整段生成失败或配图错位。 */
export function normalizeComicPagesForGeneration(
  rawPages: ComicPage[],
  targetPageCount: number,
  genre: CoverGenre = "general",
  stylePreset?: ComicStylePresetId,
  layoutId: ComicLayoutId = "grid_8",
  outputLocale: BriefInputLocale = "zh",
): ComicPage[] {
  const panelsPerPage = panelsPerPageForLayout(layoutId);
  const fallbackPrompt = defaultPanelPrompt(genre, stylePreset);
  const contSuffix = panelContinuationSuffix(outputLocale);
  const safe = rawPages.filter((p) => p && typeof p === "object");
  if (targetPageCount < 1 || safe.length < 1) return [];

  const out: ComicPage[] = [];
  for (let i = 0; i < targetPageCount; i++) {
    const src = safe[Math.min(i, safe.length - 1)]!;
    const panels = [...(src.panels ?? [])]
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
        caption: panels[j - 1]?.caption ? `${panels[j - 1]!.caption}${contSuffix}` : "……",
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
  outputLocale: BriefInputLocale = "zh",
): boolean {
  if (
    shouldPreferLightComicPipeline(
      pageCount,
      lengthTier,
      outputLocale,
      PRODUCT.comic.directorPipelineMinPages,
    )
  ) {
    return false;
  }
  if (lengthTier === "long") return true;
  if (pageCount >= PRODUCT.comic.directorPipelineMinPages) return true;
  // 中文/日文 4 页以上短篇也走导演流水线以保证人物一致性与分镜质量（繁中走轻量+繁体 prompt）
  if (pageCount >= 4 && ["zh", "ja"].includes(outputLocale)) return true;
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
    outputLocale?: BriefInputLocale;
  },
): string {
  const outputLocale = extras?.outputLocale ?? "zh";
  const qualityBlock = buildComicMasterQualityBlock(outputLocale);
  const captionRule = captionFieldInstruction(outputLocale);
  const layoutId = extras?.layoutId ?? "grid_8";
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
  const intro =
    outputLocale === "zh" || outputLocale === "zh-Hant"
      ? "你是一位擅长连载漫画分镜的 AI 艺术家。用户会提供小说节选、剧情精读与关键情节线索，你必须按**关键情节节点**改编，禁止只做线性切段拼接。"
      : "You are a serialized manga storyboard artist. Adapt by **key story beats**, not linear chunking of paragraphs.";
  const targetLine =
    outputLocale === "zh" || outputLocale === "zh-Hant"
      ? `目标：**尽量输出 ${pageCount} 页**，每页 **尽量 ${panelsPerPage} 格**（理想共 ${totalPanels} 格）。${layout.layoutGuideZh} 若篇幅所限，至少 **1 页、每页至少 1 格**。`
      : `Target: up to ${pageCount} pages, ${panelsPerPage} panels each (${totalPanels} total). At minimum 1 page with 1 panel.`;
  const rulesBlock =
    outputLocale === "zh" || outputLocale === "zh-Hant"
      ? `要求：
1. 只输出 JSON，不要 markdown
2. 根对象 "pages" 长度 **1～${pageCount}**
3. 每页 "panels" **1～${panelsPerPage}** 格
4. 每格字段：
   - scene：全书格序号（从 1 递增）
   - sourceSegmentIndex：对应提供的 [段落#N] 的 N-1（整数，尽量填写）
   - textType：dialogue | narration | inner | scene_note | time_place
   - speaker：对白时说话人名（其它类型可省略）
   - ${captionRule}
   - shotType：wide | medium | close | over_shoulder | extreme_close
   - prompt：英文 **80–150 词**，${preset.promptEn}，详细描述场景/人物/动作/光影/氛围，**必须包含具体环境细节与镜头构图感**。禁止图内文字与气泡。动作场加 speed lines/motion blur，紧张场加 dramatic shadows，抒情场加 soft focus
5. 每一格必须是一个**可单独成立的关键情节瞬间**：优先选择冲突、反转、角色决定、高潮、收束，不要机械按段落平均切分
6. 同一页内 ${panelsPerPage} 格要形成完整阅读节奏：开场交代、推进、转折、高潮/收束；不能 ${panelsPerPage} 格都在重复同一件小事
7. 开篇先用 narration 或 scene_note 交代场景，对话格用 dialogue + speaker
8. prompt 质量红线：每格 prompt 必须 ≥60 词英文，包含人物外貌、场景环境、动作、光影氛围至少四项；空泛短语（如 "A character in a room"）会被文生图模型退回重写`
      : `Rules:
1. JSON only, no markdown
2. Root "pages" length 1–${pageCount}
3. Each page "panels" 1–${panelsPerPage}
4. Panel fields: scene (global index), sourceSegmentIndex (segment# minus 1), textType, speaker (if dialogue), ${captionRule}, shotType, prompt (English 80–150 words, ${preset.promptEn}, rich visual detail, no text in image)
5. One panel = one key story moment (conflict, reversal, decision, climax)
6. Page rhythm: setup → escalation → turn → payoff
7. Open with narration/scene_note; dialogue uses dialogue + speaker
8. Each prompt ≥60 English words with character, environment, action, lighting`;

  return `${intro}

${qualityBlock}
${digestBlock}${rosterBlock}

${genreGuide}

**全片画风（贯穿每一格 prompt）**：${preset.label} — ${preset.promptEn}

${targetLine}

${rulesBlock}`;
}

export function buildComicJsonSchema(pageCount: number, layoutId: ComicLayoutId = "grid_8") {
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
