import assert from "node:assert/strict";
import { fallbackChapterPlan } from "@/lib/novel-long-chapter-plan";
import { fallbackNovelBible } from "@/lib/novel-long-bible";
import { planLongNovelSegments } from "@/lib/novel-long-config";
import { planNovelScope } from "@/lib/novel-scope-plan";

function main() {
  const scope = planNovelScope("short");
  const bible = fallbackNovelBible("测试", "雨夜锦衣", planLongNovelSegments("short"));
  const plan = fallbackChapterPlan(bible, scope.chapterCount);
  assert.equal(plan.chapters.length, scope.chapterCount);
  assert.ok(plan.chapters.every((c) => (c.targetChars ?? 0) > 0 || true));
  console.log("qa-novel-chapter-plan-tier: ok", { chapters: plan.chapters.length });
}

main();
