/**
 * 长篇流水线离线检查：npx tsx scripts/qa-novel-long-plan.ts
 */
import { fallbackChapterPlan } from "@/lib/novel-long-chapter-plan";
import { fallbackNovelBible } from "@/lib/novel-long-bible";
import { checkSegmentConsistency } from "@/lib/novel-long-consistency";
import {
  estimateLongNovelChapterCount,
  LONG_NOVEL_PRODUCT,
  planLongNovelSegments,
} from "@/lib/novel-long-config";
import { splitChapterPlanIntoSegments } from "@/lib/novel-long-chapter-plan";
import { usesSegmentedLongGeneration } from "@/lib/novel-long-generate";

const plan = planLongNovelSegments("long");
const chapterCount = estimateLongNovelChapterCount(plan);
const bible = fallbackNovelBible("测试创意：少年修仙", "测试书", plan);
const chapterPlan = fallbackChapterPlan(bible, chapterCount);
const slices = splitChapterPlanIntoSegments(chapterPlan, plan, (i, t) =>
  i === 0 ? "开篇" : i === t - 1 ? "结局" : "推进",
);

console.log("[OK] usesSegmentedLongGeneration(long):", usesSegmentedLongGeneration("long"));
console.log("[OK] product keys:", Object.keys(LONG_NOVEL_PRODUCT));
console.log("[OK] plan:", plan);
console.log("[OK] chapterCount:", chapterCount, "slices:", slices.length);

if (plan.totalSegments < 3) {
  console.error("[FAIL] totalSegments < 3");
  process.exit(1);
}
if (slices.length < 1) {
  console.error("[FAIL] no segment slices");
  process.exit(1);
}

const sampleSegment = `=== 第${slices[0]!.chapters[0]!.num}章 ${slices[0]!.chapters[0]!.title} ===\n\n测试正文。`;
const report = checkSegmentConsistency({
  bible,
  expectedChapters: slices[0]!.chapters,
  segmentText: sampleSegment,
  previousContent: "",
});
console.log("[OK] consistency sample:", report.ok, "issues:", report.issues.length);

console.log("[OK] qa-novel-long-plan");
