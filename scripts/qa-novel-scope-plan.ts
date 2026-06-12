import assert from "node:assert/strict";
import { fitNovelContentToMaxChars } from "@/lib/novel-chapters";
import { allocateChapterTargetChars, planNovelScope } from "@/lib/novel-scope-plan";

function main() {
  const short = planNovelScope("short");
  assert.equal(short.chapterCount, 3);
  assert.ok(short.targetTotalChars >= short.minChars);
  assert.ok(short.targetTotalChars <= short.maxChars);

  const medium = planNovelScope("medium");
  assert.ok(medium.chapterCount >= 5 && medium.chapterCount <= 8);

  const allocated = allocateChapterTargetChars(
    [
      { num: 1, title: "A", summary: "open", phase: "opening" },
      { num: 2, title: "B", summary: "rise", phase: "rising" },
      { num: 3, title: "C", summary: "end", phase: "resolution" },
    ],
    1200,
  );
  const sum = allocated.reduce((s, c) => s + (c.targetChars ?? 0), 0);
  assert.ok(sum >= 1100 && sum <= 1300, `allocated sum ${sum}`);

  const over = `=== 第1章 开篇 ===\n\n${"字".repeat(500)}\n\n=== 第2章 结局 ===\n\n终于落幕。${"字".repeat(800)}`;
  const fitted = fitNovelContentToMaxChars(over, 600);
  assert.ok(!fitted.includes("已达本篇幅"), "不应插入触顶收束句");
  assert.ok(fitted.length <= 600);
}

main();
console.log("qa-novel-scope-plan: ok");
