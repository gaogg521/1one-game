import {
  childrenChapterHintForAge,
  childrenCharRangeLabel,
  childrenMaxCharsForAge,
  childrenMinAcceptCharsForAge,
  childrenAgeLabel,
  CHILDREN_CHARS_MAX,
  CHILDREN_CHARS_MIN,
  DEFAULT_CHILDREN_TARGET_AGE,
  parseChildrenTargetAge,
  type ChildrenTargetAge,
} from "@/lib/children-age-length";
import { isChildrenGenreTag } from "@/lib/novel-genre-tags";
import type { AppLocale } from "@/i18n/routing";
import { tMessage } from "@/lib/i18n/messages";

export type NovelLengthOptions = {
  childrenTargetAge?: ChildrenTargetAge | number | null;
  /** 家长原始输入，用于儿童典故忠实约束 */
  childrenUserPrompt?: string;
};

export { parseChildrenTargetAge, type ChildrenTargetAge } from "@/lib/children-age-length";
export {
  CHILDREN_AGE_LENGTH_OPTIONS,
  childrenAgeLabel,
  childrenMaxCharsForAge,
  DEFAULT_CHILDREN_TARGET_AGE,
} from "@/lib/children-age-length";

/** 小说篇幅档位（children 由「儿童短篇」类型自动推导，不在篇幅区展示） */
export type NovelLengthTier = "short" | "children" | "medium" | "long";

type LengthTierRow = {
  id: NovelLengthTier;
  label: string;
  desc: string;
  minChars: number;
  maxChars: number;
};

/** 创作台「篇幅」区可选：短篇 / 中篇 / 长篇 */
export const NOVEL_LENGTH_TIERS_FOR_UI: LengthTierRow[] = [
  { id: "short", label: "短篇", desc: "约 300–2,000 字", minChars: 300, maxChars: 2000 },
  { id: "medium", label: "中篇", desc: "约 2,000–10,000 字", minChars: 2000, maxChars: 10000 },
  { id: "long", label: "长篇", desc: "约 10,000–100,000 字", minChars: 10000, maxChars: 100000 },
];

const CHILDREN_LENGTH_ROW: LengthTierRow = {
  id: "children",
  label: "儿童短篇",
  desc: `按年龄段约 ${CHILDREN_CHARS_MIN}–${CHILDREN_CHARS_MAX} 字 · 配套小人书五格漫画`,
  minChars: CHILDREN_CHARS_MIN,
  maxChars: CHILDREN_CHARS_MAX,
};

function childrenLengthRow(opts?: NovelLengthOptions): LengthTierRow {
  const age = parseChildrenTargetAge(opts?.childrenTargetAge ?? DEFAULT_CHILDREN_TARGET_AGE);
  const maxChars = childrenMaxCharsForAge(age);
  const minChars = childrenMinAcceptCharsForAge(age);
  return {
    ...CHILDREN_LENGTH_ROW,
    desc: `${childrenAgeLabel(age)} · ${childrenCharRangeLabel(age)}`,
    minChars,
    maxChars,
  };
}

/** @deprecated 请用 NOVEL_LENGTH_TIERS_FOR_UI；含 children 仅供配置查询 */
export const NOVEL_LENGTH_TIERS: LengthTierRow[] = [
  ...NOVEL_LENGTH_TIERS_FOR_UI.slice(0, 1),
  CHILDREN_LENGTH_ROW,
  ...NOVEL_LENGTH_TIERS_FOR_UI.slice(1),
];

/** 根据类型 + 用户选的篇幅，得到实际写入与生成用的档位 */
export function resolveNovelLengthTier(opts: {
  genreTagId?: string | null;
  lengthTierPick?: unknown;
}): NovelLengthTier {
  if (isChildrenGenreTag(opts.genreTagId)) return "children";
  const pick = parseNovelLengthTier(opts.lengthTierPick);
  // 非儿童类型时 children 无意义，回退为 short（下游按 short 字数限制处理）
  return pick === "children" ? "short" : pick;
}

export function isChildrenNovelTier(tier: NovelLengthTier): boolean {
  return tier === "children";
}

export function parseNovelLengthTier(raw: unknown): NovelLengthTier {
  if (raw === "short" || raw === "children" || raw === "medium" || raw === "long") return raw;
  return "medium";
}

/** 创作页提示：预计耗时与保持页面打开说明。 */
export function novelGenerationEtaHint(tier: NovelLengthTier, locale: AppLocale = "zh-Hans"): string {
  const key = tier === "children" ? "children" : tier === "short" ? "short" : tier === "long" ? "long" : "medium";
  return tMessage(locale, `novelLength.eta.${key}`);
}

export function novelStreamInterruptHint(tier: NovelLengthTier, locale: AppLocale = "zh-Hans"): string {
  const eta = novelGenerationEtaHint(tier, locale);
  if (tier === "long") {
    return tMessage(locale, "novelLength.streamInterruptLong", { eta });
  }
  return tMessage(locale, "novelLength.streamInterruptShort", { eta });
}

export function novelLengthConfig(tier: NovelLengthTier, opts?: NovelLengthOptions) {
  const row =
    tier === "children"
      ? childrenLengthRow(opts)
      : (NOVEL_LENGTH_TIERS_FOR_UI.find((t) => t.id === tier) ?? NOVEL_LENGTH_TIERS_FOR_UI[1]);
  const chapterHint =
    tier === "children"
      ? childrenChapterHintForAge(
          parseChildrenTargetAge(opts?.childrenTargetAge ?? DEFAULT_CHILDREN_TARGET_AGE),
          row.maxChars,
        )
      : tier === "short"
      ? "3–4 章，每章 250–700 字，必须写完完整主线并收束结尾"
      : tier === "medium"
        ? "5–8 章，每章 500–1500 字（全文不得超过上限，必须完成完整主线与结尾）"
        : "10–40 章，每章 800–3000 字（可分多段输出，最终必须写完全部规划章节并落到结局）";
  return { ...row, chapterHint };
}

/** 该档位允许写入 DB 的正文汉字上限（硬截断）。 */
export function novelMaxChars(tier: NovelLengthTier, opts?: NovelLengthOptions): number {
  return novelLengthConfig(tier, opts).maxChars;
}
