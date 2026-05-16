import type { ComicPage } from "@/lib/comic-format";
import type { NovelLengthTier } from "@/lib/novel-length";

export const PANELS_PER_PAGE = 4;
export const COMIC_MAX_PAGES = 32;

/** 按小说篇幅默认漫画页数（每页 4 宫格） */
export const COMIC_DEFAULT_PAGES: Record<NovelLengthTier, number> = {
  short: 2,
  medium: 8,
  long: 16,
};

const DEFAULT_PANEL_PROMPT =
  "Comic panel, Ming dynasty China historical drama, palace and mountain scenery, consistent character design, cinematic lighting, detailed illustration suitable for manga grid";

/** 将模型输出的 pages 规整为固定页数、每页 4 格，避免页数略少或格子不齐导致整段生成失败或配图错位。 */
export function normalizeComicPagesForGeneration(
  rawPages: ComicPage[],
  targetPageCount: number,
): ComicPage[] {
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
        prompt: String(pan.prompt ?? "").trim() || DEFAULT_PANEL_PROMPT,
      }));

    while (panels.length < PANELS_PER_PAGE) {
      const j = panels.length;
      panels.push({
        scene: i * PANELS_PER_PAGE + j + 1,
        caption: panels[j - 1]?.caption ? `${panels[j - 1]!.caption}（续）` : "……",
        prompt: panels[j - 1]?.prompt ?? DEFAULT_PANEL_PROMPT,
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

export function buildComicSystemPrompt(pageCount: number): string {
  const totalPanels = pageCount * PANELS_PER_PAGE;
  return `你是一位擅长漫画分镜的 AI 艺术家。用户会提供小说或故事文本，你需要将其改编为漫画分镜脚本。

目标：**尽量输出 ${pageCount} 页**，每页 **尽量 4 格**（理想共 ${totalPanels} 格），按阅读顺序从左到右、从上到下。若篇幅所限，至少给出 **1 页、每页至少 1 格**的有效分镜，我们会自动补足格子数。

要求：
1. 只输出 JSON 对象，不要 markdown 代码块
2. 根对象包含 "pages" 数组，长度在 **1 到 ${pageCount}** 之间
3. 每个 page 对象包含：
   - "page": 页码（建议 1 起递增）
   - "panels": **1～4** 个格的数组（尽量凑满 4 个）
4. 每个 panel 包含：
   - "scene": 全局格序号（从 1 递增）
   - "caption": 中文旁白或对白（宜 ≤40 字）
   - "prompt": 英文图像生成提示词（约 60–120 词），含风格、角色、动作、环境、光照
5. 剧情覆盖起承转合，页与页之间叙事连贯；同一角色外貌服装保持一致
6. 风格统一：日式漫画 / 美漫 / 国漫择一贯穿`;
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
