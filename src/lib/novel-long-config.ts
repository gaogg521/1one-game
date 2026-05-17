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
