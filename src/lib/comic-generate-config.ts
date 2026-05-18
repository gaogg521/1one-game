import type { ComicPage } from "@/lib/comic-format";
import type { NovelLengthTier } from "@/lib/novel-length";
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

export const PANELS_PER_PAGE = 4;
export const COMIC_MAX_PAGES = 32;

/** 按小说篇幅默认漫画页数（每页 4 宫格） */
export const COMIC_DEFAULT_PAGES: Record<NovelLengthTier, number> = {
  short: 2,
  medium: 8,
  long: 16,
};

export function defaultPanelPrompt(genre: CoverGenre = "general"): string {
  return `Comic panel, ${getComicPanelStyleLock(genre)}, detailed illustration suitable for manga grid`;
}

/** 文生图统一约束：中文对白由页面 caption 叠字，禁止模型在画面内生成任何可读文字。 */
export const COMIC_IMAGE_NO_TEXT_SUFFIX =
  "Illustration only. No text, no letters, no English or Chinese words in the image, no speech bubbles with readable writing, no subtitles or signs with legible characters.";

export type PanelImagePromptOpts = {
  sceneIndex?: number;
  totalScenes?: number;
  story?: ComicStoryContext;
};

/** 将分镜格转为文生图 prompt（英文画面描述 + 题材画风锁 + 禁止图内文字）。 */
export function buildPanelImagePrompt(
  panel: { prompt?: string; caption?: string },
  genre: CoverGenre = "general",
  opts?: PanelImagePromptOpts,
): string {
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

  const styleLock = getComicPanelStyleLock(genre);
  const raw = panel.prompt?.trim();
  const caption = panel.caption?.trim() ?? "";
  let base = raw;
  if (!base || (genre === "urban" && raw && panelPromptLooksFantasy(raw))) {
    base = caption && !panelPromptLooksFantasy(caption)
      ? `Manga comic panel, ${styleLock}, scene for story beat (dialogue not in image): ${caption.slice(0, 80)}`
      : defaultPanelPrompt(genre);
  } else if (!/modern urban|contemporary|都市|realistic/i.test(base) && genre === "urban") {
    base = `${styleLock}. ${base}`;
  } else if (genre !== "general" && !new RegExp(styleLock.slice(0, 24), "i").test(base)) {
    base = `${styleLock}. ${base}`;
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
): ComicPage[] {
  const fallbackPrompt = defaultPanelPrompt(genre);
  const safe = rawPages.filter((p) => p && typeof p === "object");
  if (targetPageCount < 1 || safe.length < 1) return [];

  const out: ComicPage[] = [];
  for (let i = 0; i < targetPageCount; i++) {
    const src = safe[Math.min(i, safe.length - 1)]!;
    let panels = [...(src.panels ?? [])]
      .filter((pan) => pan && typeof pan === "object")
      .slice(0, PANELS_PER_PAGE)
      .map((pan, j) => ({
        scene: i * PANELS_PER_PAGE + j + 1,
        caption: String(pan.caption ?? "").trim().slice(0, 120) || "……",
        prompt: String(pan.prompt ?? "").trim() || fallbackPrompt,
      }));

    while (panels.length < PANELS_PER_PAGE) {
      const j = panels.length;
      panels.push({
        scene: i * PANELS_PER_PAGE + j + 1,
        caption: panels[j - 1]?.caption ? `${panels[j - 1]!.caption}（续）` : "……",
        prompt: panels[j - 1]?.prompt ?? fallbackPrompt,
      });
    }

    out.push({ page: i + 1, panels });
  }
  return out;
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

export function buildComicSystemPrompt(pageCount: number, genre: CoverGenre = "general"): string {
  const totalPanels = pageCount * PANELS_PER_PAGE;
  const genreGuide = COMIC_GENRE_GUIDE[genre] ?? COMIC_GENRE_GUIDE.general;
  return `你是一位擅长漫画分镜的 AI 艺术家。用户会提供小说或故事文本，你需要将其改编为漫画分镜脚本。

${genreGuide}

目标：**尽量输出 ${pageCount} 页**，每页 **尽量 4 格**（理想共 ${totalPanels} 格），按阅读顺序从左到右、从上到下。若篇幅所限，至少给出 **1 页、每页至少 1 格**的有效分镜，我们会自动补足格子数。

要求：
1. 只输出 JSON 对象，不要 markdown 代码块
2. 根对象包含 "pages" 数组，长度在 **1 到 ${pageCount}** 之间
3. 每个 page 对象包含：
   - "page": 页码（建议 1 起递增）
   - "panels": **1～4** 个格的数组（尽量凑满 4 个）
4. 每个 panel 包含：
   - "scene": 全局格序号（从 1 递增）
   - "caption": **中文**旁白或对白（宜 ≤40 字），**仅用于网页叠字显示，不要要求画进图里**
   - "prompt": **英文**图像提示词（约 60–120 词），只描述**可见画面**：风格、角色外貌、动作、环境、光照；**禁止** dialogue、speech bubble text、subtitles、招牌上的可读文字
5. 改编**中文**小说时：剧情与 caption 用中文；prompt 用英文描述画面，不要把中文台词写进 prompt 让模型画在图上
6. 剧情覆盖起承转合，页与页之间叙事连贯；同一角色外貌服装保持一致
7. 风格统一：国漫条漫或日系写实择一贯穿，且全片符合上述题材`;
}

export function buildComicJsonSchema(pageCount: number) {
  const panelSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      scene: { type: "integer" },
      caption: { type: "string" },
      prompt: { type: "string" },
    },
    required: ["scene", "caption", "prompt"],
  };

  const pageSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      page: { type: "integer" },
      panels: {
        type: "array",
        minItems: 1,
        maxItems: PANELS_PER_PAGE,
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
