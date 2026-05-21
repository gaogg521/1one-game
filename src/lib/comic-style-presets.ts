import type { CoverGenre } from "@/lib/cover-genre";

/** 用户可选的连载漫画画风（文生图 + 分镜 system 共用） */
export type ComicStylePresetId =
  | "japanese_clean"
  | "chibi_cute"
  | "children_picture_book"
  | "korean_shoujo"
  | "chinese_wuxia"
  | "chinese_campus";

export type ComicStylePreset = {
  id: ComicStylePresetId;
  label: string;
  hint: string;
  /** 英文画风锁：禁止网红厚涂、夸张二次元浓妆 */
  promptEn: string;
  /** 叠字字体类名（阅读页 CSS） */
  captionFontClass: string;
};

export const COMIC_STYLE_PRESETS: Record<ComicStylePresetId, ComicStylePreset> = {
  japanese_clean: {
    id: "japanese_clean",
    label: "日系清新少年漫",
    hint: "线条干净、表情生动，校园/冒险/日常通用",
    promptEn:
      "Japanese shonen manga style, clean ink lines, expressive faces, soft cel shading, natural proportions, NOT thick oil painting, NOT influencer beauty filter, NOT hyper-saturated web illustration",
    captionFontClass: "font-sans",
  },
  chibi_cute: {
    id: "chibi_cute",
    label: "Q版可爱萌系",
    hint: "头大身小、软萌童趣，适合儿童/搞笑",
    promptEn:
      "chibi manga style, oversized head small body, round soft features, pastel colors, cute and playful, NOT realistic portrait, NOT dark gritty rendering",
    captionFontClass: "font-sans",
  },
  children_picture_book: {
    id: "children_picture_book",
    label: "儿童漫画小人书",
    hint: "现代彩色儿童绘本/Q版，粗圆线条、粉彩草地花朵，适合家长给儿童讲故事",
    promptEn:
      "modern children's picture book comic illustration, cute chibi kids and animals, thick warm brown rounded outlines, soft pastel meadow with simple flowers bushes and sparkles, gentle sunlight, hand-drawn crayon feel, friendly expressions with pink cheek blush, simple backpacks and scarves, wholesome bedtime story mood, NOT horror, NOT realistic teen portrait, NOT dark cyberpunk, NOT glossy influencer filter",
    captionFontClass: "font-sans",
  },
  korean_shoujo: {
    id: "korean_shoujo",
    label: "韩系唯美少女漫",
    hint: "人物精致柔和，言情/甜文/古风柔情",
    promptEn:
      "Korean webtoon shoujo romance style, delicate features, soft gradients, romantic lighting, elegant outfits, NOT heavy fantasy armor, NOT neon cyberpunk",
    captionFontClass: "font-sans",
  },
  chinese_wuxia: {
    id: "chinese_wuxia",
    label: "国漫古风武侠",
    hint: "仙侠江湖、飘逸大气，古装首选",
    promptEn:
      "Chinese donghua wuxia/xianxia comic style, flowing robes, ink-wash mountains, dynamic martial poses, restrained palette, NOT modern streetwear, NOT sci-fi mecha",
    captionFontClass: "font-serif",
  },
  chinese_campus: {
    id: "chinese_campus",
    label: "中式简约校园漫",
    hint: "贴近国产动画，学生校园故事",
    promptEn:
      "Chinese domestic animation campus comic style, simple clean lines, school uniforms, classroom and playground, grounded slice-of-life, NOT European medieval, NOT thick AI glamour portrait",
    captionFontClass: "font-sans",
  },
};

export const COMIC_STYLE_PRESET_LIST = Object.values(COMIC_STYLE_PRESETS);

export function parseComicStylePreset(raw: unknown): ComicStylePresetId {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s && s in COMIC_STYLE_PRESETS) return s as ComicStylePresetId;
  return "japanese_clean";
}

/** 未指定画风时，按封面题材推断默认预设 */
export function inferComicStylePreset(
  genre: CoverGenre,
  lengthTier?: import("@/lib/novel-length").NovelLengthTier | null,
): ComicStylePresetId {
  if (lengthTier === "children") return "children_picture_book";
  switch (genre) {
    case "wuxia":
    case "xianxia":
    case "historical":
      return "chinese_wuxia";
    case "urban":
      return "chinese_campus";
    case "romance":
      return "korean_shoujo";
    case "fantasy":
    case "general":
      return "japanese_clean";
    default:
      return "japanese_clean";
  }
}

export function getComicStylePreset(id: ComicStylePresetId): ComicStylePreset {
  return COMIC_STYLE_PRESETS[id];
}

export function resolveComicStylePreset(opts: {
  preset?: unknown;
  genre: CoverGenre;
  lengthTier?: import("@/lib/novel-length").NovelLengthTier | null;
}): ComicStylePresetId {
  const raw = typeof opts.preset === "string" ? opts.preset.trim() : "";
  if (raw && raw in COMIC_STYLE_PRESETS) return raw as ComicStylePresetId;
  return inferComicStylePreset(opts.genre, opts.lengthTier);
}
