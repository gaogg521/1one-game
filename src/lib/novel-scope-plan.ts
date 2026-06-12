import { novelMinAcceptChars } from "@/lib/novel-generate-config";
import { novelLengthConfig, type NovelLengthOptions, type NovelLengthTier } from "@/lib/novel-length";
import type { ChapterPlanItem } from "@/lib/novel-long-pipeline-types";

/** 按用户所选篇幅档位计算的写作预算（先规划、后写作）。 */
export type NovelScopePlan = {
  tier: NovelLengthTier;
  minChars: number;
  maxChars: number;
  /** 章规划与提示词使用的目标总字数（落在 min–max 内） */
  targetTotalChars: number;
  chapterCount: number;
  avgCharsPerChapter: number;
};

export function usesPlannedNovelPipeline(tier: NovelLengthTier): boolean {
  return tier === "short" || tier === "medium" || tier === "long";
}

export function planNovelScope(
  tier: NovelLengthTier,
  opts?: NovelLengthOptions,
): NovelScopePlan {
  const cfg = novelLengthConfig(tier, opts);
  const minAccept = novelMinAcceptChars(tier, opts);
  const targetTotalChars = Math.min(
    cfg.maxChars,
    Math.max(minAccept, Math.floor((cfg.minChars + cfg.maxChars) / 2)),
  );

  let chapterCount: number;
  if (tier === "short") {
    chapterCount = targetTotalChars >= 1200 ? 4 : 3;
  } else if (tier === "medium") {
    chapterCount = Math.min(8, Math.max(5, Math.round(targetTotalChars / 1200)));
  } else if (tier === "long") {
    const avg = 3200;
    chapterCount = Math.min(36, Math.max(12, Math.round(targetTotalChars / avg)));
  } else {
    chapterCount = 3;
  }

  const avgCharsPerChapter = Math.max(200, Math.floor(targetTotalChars / chapterCount));

  return {
    tier,
    minChars: cfg.minChars,
    maxChars: cfg.maxChars,
    targetTotalChars,
    chapterCount,
    avgCharsPerChapter,
  };
}

/** 将章规划字数分配对齐到 targetTotalChars，末章略多留给收束。 */
export function allocateChapterTargetChars(
  chapters: ChapterPlanItem[],
  targetTotalChars: number,
): ChapterPlanItem[] {
  if (chapters.length === 0) return chapters;
  const n = chapters.length;
  const weights = chapters.map((ch, i) => {
    if (ch.phase === "resolution" || i === n - 1) return 1.15;
    if (ch.phase === "climax") return 1.1;
    if (ch.phase === "opening" || i === 0) return 0.95;
    return 1;
  });
  const weightSum = weights.reduce((s, w) => s + w, 0);
  let allocated = 0;
  return chapters.map((ch, i) => {
    const isLast = i === n - 1;
    const raw = isLast
      ? Math.max(180, targetTotalChars - allocated)
      : Math.max(150, Math.floor((targetTotalChars * weights[i]!) / weightSum));
    allocated += raw;
    return { ...ch, targetChars: raw };
  });
}
