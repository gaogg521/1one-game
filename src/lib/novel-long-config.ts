import { PRODUCT } from "@/lib/product-config";
import { novelLengthConfig, type NovelLengthTier } from "@/lib/novel-length";
import { novelMinAcceptChars } from "@/lib/novel-generate-config";

/** @see PRODUCT.novel.longSegmented */
export const LONG_NOVEL_PRODUCT = PRODUCT.novel.longSegmented;

export type LongNovelSegmentPlan = {
  totalSegments: number;
  charsPerSegment: number;
  targetTotalChars: number;
  minAcceptChars: number;
};

export function planLongNovelSegments(tier: NovelLengthTier): LongNovelSegmentPlan {
  const cfg = novelLengthConfig(tier);
  const minAcceptChars = novelMinAcceptChars(tier);
  const { charsPerSegment, maxSegments, targetTotalChars: targetDefault } = LONG_NOVEL_PRODUCT;
  const targetTotalChars = Math.min(cfg.maxChars, Math.max(minAcceptChars, targetDefault));
  const totalSegments = Math.min(maxSegments, Math.max(3, Math.ceil(targetTotalChars / charsPerSegment)));
  return { totalSegments, charsPerSegment, targetTotalChars, minAcceptChars };
}

export function estimateLongNovelChapterCount(plan: LongNovelSegmentPlan): number {
  const avg = LONG_NOVEL_PRODUCT.avgCharsPerChapter;
  const raw = Math.round(plan.targetTotalChars / avg);
  // 产品优化：超长篇（>60000 字）允许突破 maxChapterCount 上限，按字数动态扩展
  // 原 maxChapterCount=36 对 80000+ 字小说章数过少（每章 2200+ 字偏长）
  const hardMax = plan.targetTotalChars > 60_000
    ? Math.min(60, Math.ceil(plan.targetTotalChars / 2000))
    : LONG_NOVEL_PRODUCT.maxChapterCount;
  return Math.min(
    hardMax,
    Math.max(LONG_NOVEL_PRODUCT.minChapterCount, raw),
  );
}
