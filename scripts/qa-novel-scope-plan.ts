import assert from "node:assert/strict";
import { fitNovelContentToMaxChars, fitNovelSegmentToMaxChars, parseNovelChapters } from "@/lib/novel-chapters";
import { allocateChapterTargetChars, planNovelScope } from "@/lib/novel-scope-plan";
import { accumulateNovelTextStream } from "@/lib/novel-stream-accumulate";

async function main() {
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

  const plannedOver = [1, 2, 3, 4, 5]
    .map((num) => `=== 第${num}章 ${num === 5 ? "终章" : `第${num}章`} ===\n\n${"正文。".repeat(800)}`)
    .join("\n\n");
  const segmentFitted = fitNovelSegmentToMaxChars(plannedOver, 6_000);
  assert.ok(segmentFitted.length <= 6_000, `segment fitted ${segmentFitted.length}`);
  assert.equal(parseNovelChapters(segmentFitted).length, 5, "预算压缩不得删除已规划章节");
  assert.match(segmentFitted, /终章/, "终章必须保留给收束");

  async function* streamChunks() {
    yield "甲乙";
    yield "丙丁";
    yield "戊己";
  }
  const emitted: string[] = [];
  const streamed = await accumulateNovelTextStream({
    stream: streamChunks(),
    maxChars: 5,
    onDelta: (text) => emitted.push(text),
  });
  assert.deepEqual(emitted, ["甲乙", "丙丁", "戊"], "应随上游 chunk 逐段转发，并在上限处停止展示");
  assert.equal(streamed.content.length, 5, "流式兜底落库也必须遵守硬上限");
  assert.equal(streamed.overBudget, true);
}

main()
  .then(() => console.log("qa-novel-scope-plan: ok"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
