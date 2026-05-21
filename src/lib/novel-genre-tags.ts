import type { CoverGenre } from "@/lib/cover-genre";

/** 网文主类型（创作台标签，用户单选） */
export type NovelGenreTagId =
  | "transmigration"
  | "fantasy"
  | "xianxia"
  | "wuxia"
  | "historical"
  | "urban"
  | "romance"
  | "scifi"
  | "mystery"
  | "horror"
  | "children";

/** 儿童类型标签 id（篇幅固定为 children 档位，配套小人书漫画） */
export const CHILDREN_GENRE_TAG_ID = "children" as const;

export type NovelGenreTag = {
  id: NovelGenreTagId;
  label: string;
  /** 一句话说明，展示在标签下 */
  desc: string;
  coverGenre: CoverGenre;
};

export const NOVEL_GENRE_TAGS: NovelGenreTag[] = [
  {
    id: "transmigration",
    label: "穿越",
    desc: "古今/异世穿梭、身份错位、改写命运",
    coverGenre: "transmigration",
  },
  {
    id: "fantasy",
    label: "玄幻",
    desc: "异界大陆、升级体系、血脉与机缘",
    coverGenre: "fantasy",
  },
  {
    id: "xianxia",
    label: "仙侠",
    desc: "修仙问道、宗门灵根、渡劫飞升",
    coverGenre: "xianxia",
  },
  {
    id: "wuxia",
    label: "武侠",
    desc: "江湖门派、侠义恩仇、武功秘籍",
    coverGenre: "wuxia",
  },
  {
    id: "historical",
    label: "历史",
    desc: "王朝权谋、考据架空、名将风云",
    coverGenre: "historical",
  },
  {
    id: "urban",
    label: "都市",
    desc: "现代职场、豪门商战、逆袭打脸",
    coverGenre: "urban",
  },
  {
    id: "romance",
    label: "言情",
    desc: "甜宠虐恋、婚恋成长、情感拉扯",
    coverGenre: "romance",
  },
  {
    id: "scifi",
    label: "科幻",
    desc: "未来科技、星际末世、AI 与机甲",
    coverGenre: "scifi",
  },
  {
    id: "mystery",
    label: "悬疑",
    desc: "推理刑侦、密室真相、层层反转",
    coverGenre: "mystery",
  },
  {
    id: "horror",
    label: "灵异",
    desc: "诡秘怪谈、生存惊悚、未知禁忌",
    coverGenre: "mystery",
  },
  {
    id: "children",
    label: "儿童短篇",
    desc: "睡前童话、亲子共读；按年龄段约 200–900 字，可生成 Q 版小人书五格漫画",
    coverGenre: "general",
  },
];

export function isChildrenGenreTag(id: string | null | undefined): boolean {
  return id === CHILDREN_GENRE_TAG_ID;
}

const TAG_BY_ID = new Map(NOVEL_GENRE_TAGS.map((t) => [t.id, t]));

export function getNovelGenreTag(id: string | null | undefined): NovelGenreTag | null {
  if (!id) return null;
  return TAG_BY_ID.get(id as NovelGenreTagId) ?? null;
}

/** 由书名 + 类型生成 Brief 扩写用的创意种子（非正文 prompt） */
export function buildNovelBriefSeed(
  title: string,
  genre: NovelGenreTag,
  addon?: string,
  childrenTargetAge?: number,
): string {
  const t = title.trim();
  const extra = addon?.trim();
  if (genre.id === "children") {
    const ageLine =
      childrenTargetAge !== undefined
        ? `目标读者年龄：${childrenTargetAge === 2 ? "3岁以下" : `${childrenTargetAge}岁`}`
        : "";
    return [
      `书名：${t}`,
      `类型：${genre.label}（${genre.desc}）`,
      ageLine,
      `家长一句话创意（请从中提取主题、原创角色类型、小困境与情节方向，勿用模板角色）：${extra || t}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `书名：${t}`,
    `类型：${genre.label}（${genre.desc}）`,
    `请围绕书名与类型，扩写为可连载中文网文的创意构思：核心冲突、主角目标、世界观、关键角色与章节奏。`,
    extra ? `作者补充：${extra}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** 写入 DB 的简短 prompt 摘要 */
export function buildNovelStoredPrompt(title: string, genre: NovelGenreTag): string {
  return `《${title.trim()}》·${genre.label}`;
}

/** 从入库 prompt（《书名》·类型）反推创作台所选类型，供封面题材兜底。 */
export function inferNovelGenreTagFromStoredPrompt(prompt: string): NovelGenreTag | null {
  const p = prompt.trim();
  if (!p) return null;
  for (const tag of NOVEL_GENRE_TAGS) {
    if (p.includes(`·${tag.label}`) || p.endsWith(tag.label)) return tag;
  }
  return null;
}
