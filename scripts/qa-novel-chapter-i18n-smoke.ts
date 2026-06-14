/**
 * Smoke: 六语章节标记 parse / serialize / merge 往返（无 LLM）。
 * Usage: npx tsx scripts/qa-novel-chapter-i18n-smoke.ts
 */
import assert from "node:assert/strict";
import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import {
  mergeNovelChapterContents,
  parseNovelChapters,
  serializeNovelChapters,
} from "@/lib/novel-chapters";
import {
  buildLongNovelSegmentBatchTask,
  buildLongNovelSegmentUserMessageBody,
  formatChapterPlanSliceLine,
  formatChapterRecapLine,
  formatNovelChapterMarkerHead,
  joinChapterNums,
  usesLatinNovelChapterMarkers,
} from "@/lib/novel-locale-prompts";

const LOCALES: BriefInputLocale[] = ["zh", "zh-Hant", "en", "ja", "ms", "th"];

const SAMPLE_CHAPTERS = [
  { num: 1, title: "Opening", phase: "opening", summary: "Hero enters the city.", body: "Rain fell on the tiles." },
  { num: 2, title: "Trap", phase: "climax", summary: "Ambush in the grove.", body: "Steel flashed in bamboo." },
];

function sampleContent(locale: BriefInputLocale): string {
  return serializeNovelChapters(
    SAMPLE_CHAPTERS.map((c) => ({ num: c.num, title: c.title, body: c.body })),
    { outputLocale: locale },
  );
}

function main(): void {
  for (const locale of LOCALES) {
    const latin = usesLatinNovelChapterMarkers(locale);
    assert.equal(latin, locale === "en" || locale === "ms" || locale === "th", `${locale} latin flag`);

    const head = formatNovelChapterMarkerHead(3, "Test", locale);
    if (latin) assert.match(head, /^=== Chapter 3:/);
    else assert.match(head, /^=== 第3章 /);

    const content = sampleContent(locale);
    const parsed = parseNovelChapters(content);
    assert.equal(parsed.length, 2, `${locale} parse count`);
    assert.equal(parsed[0]!.num, 1);
    assert.equal(parsed[1]!.num, 2);

    const roundTrip = serializeNovelChapters(parsed, { outputLocale: locale });
    assert.equal(parseNovelChapters(roundTrip).length, 2, `${locale} round-trip`);

    const merged = mergeNovelChapterContents(
      content,
      formatNovelChapterMarkerHead(2, "Trap", locale) + "\n\nLonger body replaces short.",
      locale,
    );
    assert.match(merged, /Longer body replaces short/, `${locale} merge overwrite`);
    assert.equal(parseNovelChapters(merged).length, 2, `${locale} merge count`);

    const recap = formatChapterRecapLine(parsed[0]!, locale);
    assert.ok(recap.includes(String(parsed[0]!.num)), `${locale} recap`);

    const planLine = formatChapterPlanSliceLine(SAMPLE_CHAPTERS[0]!, locale);
    assert.ok(planLine.includes(SAMPLE_CHAPTERS[0]!.summary), `${locale} plan line`);

    const nums = joinChapterNums([1, 2, 3], locale);
    assert.ok(nums.includes(latin ? ", " : "、"), `${locale} join nums`);

    const task = buildLongNovelSegmentBatchTask({
      locale,
      segmentIndex: 0,
      totalSegments: 4,
      phase: "opening",
      nums,
      targetChars: 1200,
      hasPrior: false,
      isContinuation: false,
    });
    assert.ok(task.length > 20, `${locale} batch task`);

    const userMsg = buildLongNovelSegmentUserMessageBody({
      locale,
      prompt: "Test prompt",
      title: "Title",
      bibleText: "Bible",
      chapterBlock: planLine,
      recap,
      tail: "…end",
      task,
    });
    assert.ok(userMsg.includes("Test prompt"), `${locale} user message`);

    console.log(`[OK] ${locale}`);
  }

  console.log("[OK] novel chapter i18n smoke — all 6 locales");
}

main();
