import type { CoverGenre } from "@/lib/cover-genre";
import {
  childrenAgeLabel,
  childrenCharRangeLabel,
  parseChildrenTargetAge,
} from "@/lib/children-age-length";
import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { getLocalizedGenreTagFromMessages } from "@/lib/i18n/localized-data";
import type { AppLocale } from "@/i18n/routing";

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
  labels?: Partial<Record<"en" | "ja", { label: string; desc: string }>>;
};

export const NOVEL_GENRE_TAGS: NovelGenreTag[] = [
  {
    id: "transmigration",
    label: "穿越",
    desc: "古今/异世穿梭、身份错位、改写命运",
    coverGenre: "transmigration",
    labels: { en: { label: "Transmigration", desc: "Time travel, identity swaps, rewriting fate" } },
  },
  {
    id: "fantasy",
    label: "玄幻",
    desc: "异界大陆、升级体系、血脉与机缘",
    coverGenre: "fantasy",
    labels: { en: { label: "Fantasy", desc: "Otherworld realms, progression systems, bloodlines and destiny" } },
  },
  {
    id: "xianxia",
    label: "仙侠",
    desc: "修仙问道、宗门灵根、渡劫飞升",
    coverGenre: "xianxia",
    labels: { en: { label: "Xianxia", desc: "Cultivation, sects, spiritual roots, ascension" } },
  },
  {
    id: "wuxia",
    label: "武侠",
    desc: "江湖门派、侠义恩仇、武功秘籍",
    coverGenre: "wuxia",
    labels: { en: { label: "Wuxia", desc: "Jianghu sects, honor and vendetta, martial arts manuals" } },
  },
  {
    id: "historical",
    label: "历史",
    desc: "王朝权谋、考据架空、名将风云",
    coverGenre: "historical",
    labels: { en: { label: "Historical", desc: "Dynastic politics, alternate history, legendary generals" } },
  },
  {
    id: "urban",
    label: "都市",
    desc: "现代职场、豪门商战、逆袭打脸",
    coverGenre: "urban",
    labels: { en: { label: "Urban", desc: "Modern city life, business wars, comeback arcs" } },
  },
  {
    id: "romance",
    label: "言情",
    desc: "甜宠虐恋、婚恋成长、情感拉扯",
    coverGenre: "romance",
    labels: { en: { label: "Romance", desc: "Sweetness and angst, relationships, emotional tension" } },
  },
  {
    id: "scifi",
    label: "科幻",
    desc: "未来科技、星际末世、AI 与机甲",
    coverGenre: "scifi",
    labels: { en: { label: "Sci-Fi", desc: "Future tech, space opera, apocalypse, AI and mecha" } },
  },
  {
    id: "mystery",
    label: "悬疑",
    desc: "推理刑侦、密室真相、层层反转",
    coverGenre: "mystery",
    labels: { en: { label: "Mystery", desc: "Detective work, locked rooms, layered twists" } },
  },
  {
    id: "horror",
    label: "灵异",
    desc: "诡秘怪谈、生存惊悚、未知禁忌",
    coverGenre: "mystery",
    labels: { en: { label: "Supernatural", desc: "Eerie folklore, survival horror, forbidden unknowns" } },
  },
  {
    id: "children",
    label: "儿童短篇",
    desc: "童真童趣、寓教于乐、浅语暖心",
    coverGenre: "general",
    labels: { en: { label: "Children", desc: "Playful, gentle, educational, age-appropriate warmth" } },
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

export function getLocalizedNovelGenreTag(
  tag: NovelGenreTag,
  locale: BriefInputLocale | AppLocale | "zh-Hans" | "zh-Hant" | "ms" | "th",
): { label: string; desc: string } {
  const fromMessages = getLocalizedGenreTagFromMessages(tag.id, locale as BriefInputLocale | AppLocale);
  if (fromMessages) return fromMessages;
  const key = locale === "en" ? "en" : locale === "ja" ? "ja" : undefined;
  return key && tag.labels?.[key] ? tag.labels[key]! : { label: tag.label, desc: tag.desc };
}

/** 由书名 + 类型生成 Brief 扩写用的创意种子（非正文 prompt） */
export function buildNovelBriefSeed(
  title: string,
  genre: NovelGenreTag,
  addon?: string,
  childrenTargetAge?: number,
  inputLocale: BriefInputLocale = "zh",
): string {
  const t = title.trim();
  const extra = addon?.trim();
  const localizedGenre = getLocalizedNovelGenreTag(genre, inputLocale);
  const nonChinesePrompt =
    inputLocale === "en"
      ? "Expand this into a serialized web-novel concept brief: core conflict, protagonist goal, worldbuilding, major characters, and chapter rhythm."
      : inputLocale === "ms"
        ? "Kembangkan ini menjadi rangka konsep novel web bersiri: konflik teras, matlamat protagonis, pembinaan dunia, watak utama, dan rentak bab."
        : inputLocale === "th"
          ? "ขยายสิ่งนี้เป็นโครงแนวคิดเว็บโนเวลแบบต่อเนื่อง: ความขัดแย้งหลัก เป้าหมายของตัวเอก โลกของเรื่อง ตัวละครสำคัญ และจังหวะของบท"
          : "";
  if (genre.id === "children") {
    const ageLine =
      childrenTargetAge !== undefined
        ? `目标读者：${childrenAgeLabel(parseChildrenTargetAge(childrenTargetAge))} · 正文 ${childrenCharRangeLabel(parseChildrenTargetAge(childrenTargetAge))}`
        : "";
    if (inputLocale === "en" || inputLocale === "ms" || inputLocale === "th") {
      return [
        inputLocale === "th" ? `ชื่อเรื่อง: ${t}` : `Title: ${t}`,
        inputLocale === "th"
          ? `ประเภท: ${localizedGenre.label} (${localizedGenre.desc})`
          : `Genre: ${localizedGenre.label} (${localizedGenre.desc})`,
        ageLine
          ? inputLocale === "ms"
            ? `Sasaran pembaca: ${ageLine.replace(/^目标读者：/, "")}`
            : inputLocale === "th"
              ? `กลุ่มผู้อ่านเป้าหมาย: ${ageLine.replace(/^目标读者：/, "")}`
              : `Target readers: ${ageLine.replace(/^目标读者：/, "")}`
          : "",
        inputLocale === "ms"
          ? `Input ibu bapa: ${extra || t}`
          : inputLocale === "th"
            ? `ข้อมูลจากผู้ปกครอง: ${extra || t}`
            : `Parent input: ${extra || t}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
    return [
      `书名：${t}`,
      `类型：${localizedGenre.label}（${localizedGenre.desc}）`,
      ageLine,
      `家长输入（日常话/成语/典故/古文短句均可；请按读者档位解读并改编，勿用模板角色）：${extra || t}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (inputLocale === "en" || inputLocale === "ms" || inputLocale === "th") {
    return [
      inputLocale === "th" ? `ชื่อเรื่อง: ${t}` : `Title: ${t}`,
      inputLocale === "th"
        ? `ประเภท: ${localizedGenre.label} (${localizedGenre.desc})`
        : `Genre: ${localizedGenre.label} (${localizedGenre.desc})`,
      nonChinesePrompt,
      extra
        ? inputLocale === "ms"
          ? `Nota pengarang: ${extra}`
          : inputLocale === "th"
            ? `หมายเหตุจากผู้เขียน: ${extra}`
            : `Author notes: ${extra}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (inputLocale === "zh-Hant") {
    return [
      `書名：${t}`,
      `類型：${localizedGenre.label}（${localizedGenre.desc}）`,
      `請圍繞書名與類型，擴寫為可連載繁體中文網文的創意構思：核心衝突、主角目標、世界觀、關鍵角色與章節節奏。`,
      extra ? `作者補充：${extra}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `书名：${t}`,
    `类型：${localizedGenre.label}（${localizedGenre.desc}）`,
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
  return inferNovelGenreTagFromText(p);
}

const GENRE_TEXT_HINTS: { id: NovelGenreTagId; re: RegExp }[] = [
  { id: "children", re: /儿童|童话|绘本|睡前|幼儿园|小动物|小白兔|宝宝/i },
  { id: "transmigration", re: /穿越|重生|穿书|回到过去|明末|清朝|回到/i },
  { id: "xianxia", re: /仙侠|修仙|宗门|灵根|渡劫|飞升/i },
  { id: "wuxia", re: /武侠|江湖|门派|侠客|武功/i },
  { id: "fantasy", re: /玄幻|异界|魔法|血脉|升级/i },
  { id: "historical", re: /历史|王朝|古代|名将|权谋/i },
  { id: "urban", re: /都市|职场|豪门|商战|逆袭|现代/i },
  { id: "romance", re: /言情|甜宠|虐恋|婚恋|恋爱/i },
  { id: "scifi", re: /科幻|星际|机甲|AI|赛博|未来/i },
  { id: "mystery", re: /悬疑|推理|侦探|案件/i },
  { id: "horror", re: /恐怖|惊悚|鬼怪/i },
];

/** 从自由文本（prefill / 用户灵感）推断小说类型，供统一入口与漫画题材兜底。 */
export function inferNovelGenreTagFromText(text: string): NovelGenreTag | null {
  const t = text.trim();
  if (t.length < 2) return null;
  for (const { id, re } of GENRE_TEXT_HINTS) {
    if (re.test(t)) return getNovelGenreTag(id);
  }
  return null;
}
