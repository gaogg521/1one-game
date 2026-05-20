/**
 * 长篇续写评估离线检查：npx tsx scripts/qa-novel-continue.ts
 */
import { clampContinueChapterCount, parseNovelContinueOptions } from "@/lib/novel-continue-options";
import { assessNovelContinuation } from "@/lib/novel-long-continue";
import { fallbackChapterPlan, getRemainingChapterPlan } from "@/lib/novel-long-chapter-plan";
import { fallbackNovelBible } from "@/lib/novel-long-bible";
import { planLongNovelSegments } from "@/lib/novel-long-config";
import { NOVEL_PIPELINE_VERSION } from "@/lib/novel-long-pipeline-types";

const plan = planLongNovelSegments("long");
const bible = fallbackNovelBible("修仙少年", "灵根觉醒", plan);
const chapterPlan = fallbackChapterPlan(bible, 20);

const meta = {
  version: NOVEL_PIPELINE_VERSION,
  bible,
  chapterPlan,
  segmentCount: 4,
  createdAt: new Date().toISOString(),
};

const partialContent = `=== 第1章 序章 ===\n\n开篇正文。\n\n=== 第2章 第2章 ===\n\n第二章。`;
const remaining = getRemainingChapterPlan(chapterPlan, partialContent);

const a1 = assessNovelContinuation({ lengthTier: "long", content: partialContent, meta });
const a2 = assessNovelContinuation({ lengthTier: "medium", content: partialContent, meta });
const a3 = assessNovelContinuation({ lengthTier: "long", content: "x".repeat(99_000), meta });

console.log("[OK] remaining chapters:", remaining.length);
console.log("[OK] assess long partial:", a1);
console.log("[OK] assess medium:", a2.canContinue, a2.reason);
console.log("[OK] assess near max:", a3.canContinue, a3.reason);

if (!a1.canContinue || remaining.length < 1) {
  console.error("[FAIL] expected can continue with remaining chapters");
  process.exit(1);
}
if (a2.canContinue) {
  console.error("[FAIL] medium should not continue");
  process.exit(1);
}

const opts = parseNovelContinueOptions({ maxChapters: 3, polish: true });
const limited = clampContinueChapterCount(opts.maxChapters, 18);
console.log("[OK] continue opts:", opts, "limited:", limited);
if (opts.maxChapters !== 3 || !opts.polish) {
  console.error("[FAIL] parseNovelContinueOptions");
  process.exit(1);
}

console.log("[OK] qa-novel-continue");
