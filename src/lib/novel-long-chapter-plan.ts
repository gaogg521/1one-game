import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";
import { parseNovelChapters } from "@/lib/novel-chapters";
import { llmNovelJson } from "@/lib/llm";
import { buildLongNovelChapterPlanSystemPrompt, formatChapterPlanSliceLine } from "@/lib/novel-locale-prompts";
import {
  estimateLongNovelChapterCount,
  LONG_NOVEL_PRODUCT,
  type LongNovelSegmentPlan,
} from "@/lib/novel-long-config";
import { novelLengthConfig, type NovelLengthTier } from "@/lib/novel-length";
import { formatNovelBibleForPrompt } from "@/lib/novel-long-bible";
import type { NovelBible } from "@/lib/novel-long-pipeline-types";
import {
  buildNovelChapterPlanJsonSchema,
  type ChapterPlanItem,
  type NovelChapterPlan,
  parseNovelChapterPlan,
} from "@/lib/novel-long-pipeline-types";

export type ChapterSegmentSlice = {
  segmentIndex: number;
  chapters: ChapterPlanItem[];
  phase: string;
};

/** 保证章提纲每一章都能分到至少一个写作批次（避免 plan.totalSegments 过小截断末章）。 */
export function computeSegmentCapForChapterPlan(
  chapterCount: number,
  plan: LongNovelSegmentPlan,
): number {
  if (chapterCount <= 0) return plan.totalSegments;
  const byMaxBatch = Math.ceil(chapterCount / LONG_NOVEL_PRODUCT.chaptersPerSegmentMax);
  const avgPerSegment = Math.max(
    1,
    Math.floor(plan.charsPerSegment / LONG_NOVEL_PRODUCT.avgCharsPerChapter),
  );
  const byCharBudget = Math.ceil(chapterCount / avgPerSegment);
  return Math.min(
    LONG_NOVEL_PRODUCT.maxSegments,
    Math.max(plan.totalSegments, byMaxBatch, byCharBudget),
  );
}

export function buildChapterPlanUserMessage(
  prompt: string,
  bible: NovelBible,
  chapterCount: number,
  locale: BriefInputLocale = "zh",
  avgCharsPerChapter?: number,
  lengthTier: NovelLengthTier = "long",
): string {
  const cfg = novelLengthConfig(lengthTier);
  const avg = avgCharsPerChapter ?? LONG_NOVEL_PRODUCT.avgCharsPerChapter;
  const bibleBlock = formatNovelBibleForPrompt(bible, locale);
  const concept = prompt.trim();

  switch (locale) {
    case "en":
      return `User concept: ${concept}

${bibleBlock}

Plan exactly **${chapterCount} chapters** as chapter-plan JSON in English.
Target ${cfg.minChars}–${cfg.maxChars} characters; suggested targetChars per chapter ~${avg}.
No prose body—chapters array only.`;
    case "ja":
      return `ユーザー創意：${concept}

${bibleBlock}

**ちょうど ${chapterCount} 章**の chapter plan JSON を日本語で出力。
目標 ${cfg.minChars}–${cfg.maxChars} 字；各章 targetChars は ~${avg}。
本文は書かず chapters 配列のみ。`;
    case "ms":
      return `Idea pengguna: ${concept}

${bibleBlock}

Rancang **tepat ${chapterCount} bab** sebagai chapter-plan JSON dalam Bahasa Melayu.
Sasaran ${cfg.minChars}–${cfg.maxChars} aksara; targetChars ~${avg} setiap bab.
Tiada prosa—hanya array chapters.`;
    case "th":
      return `แนวคิด: ${concept}

${bibleBlock}

วางแผน** ${chapterCount} บท** เป็น chapter-plan JSON ภาษาไทย
เป้าหมาย ${cfg.minChars}–${cfg.maxChars} อักขระ targetChars ~${avg} ต่อบท
ไม่เขียนเนื้อเรื่อง—เฉพาะ array chapters`;
    case "zh-Hant":
      return `用戶創意：${concept}

${bibleBlock}

請規劃全書 **恰好 ${chapterCount} 章** 的 chapter plan JSON（繁體中文）。
全書目標 ${cfg.minChars}–${cfg.maxChars} 字；每章 targetChars 建議 ${avg} 左右。
不要寫正文，只輸出 chapters 陣列。`;
    default:
      return `用户创意：${concept}

${bibleBlock}

请规划全书 **恰好 ${chapterCount} 章** 的 chapter plan JSON。
全书目标 ${cfg.minChars}–${cfg.maxChars} 字；每章 targetChars 建议 ${avg} 左右。
不要写正文，只输出 chapters 数组。`;
  }
}

function phaseForIndex(i: number, total: number): ChapterPlanItem["phase"] {
  const r = i / total;
  if (r < 0.15) return "opening";
  if (r < 0.75) return "rising";
  if (r < 0.9) return "climax";
  return "resolution";
}

export function fallbackChapterPlan(bible: NovelBible, chapterCount: number): NovelChapterPlan {
  const chapters: ChapterPlanItem[] = [];
  for (let i = 0; i < chapterCount; i++) {
    const num = i + 1;
    chapters.push({
      num,
      title: num === 1 ? "序章" : num === chapterCount ? "终章" : `第${num}章`,
      summary:
        num === 1
          ? `引入${bible.characters[0]?.name ?? "主角"}与${bible.worldSetting.slice(0, 40)}…`
          : num === chapterCount
            ? `收束${bible.coreConflict.slice(0, 30)}…，走向结局。`
            : `推进主线，呼应${bible.coreConflict.slice(0, 24)}…`,
      phase: phaseForIndex(i, chapterCount),
      targetChars: LONG_NOVEL_PRODUCT.avgCharsPerChapter,
    });
  }
  return { chapters };
}

export type FetchNovelChapterPlanOpts = {
  chapterCount?: number;
  avgCharsPerChapter?: number;
};

export async function fetchNovelChapterPlan(
  model: string,
  prompt: string,
  bible: NovelBible,
  plan: LongNovelSegmentPlan,
  lengthTier: NovelLengthTier,
  opts?: FetchNovelChapterPlanOpts,
): Promise<NovelChapterPlan> {
  const chapterCount = opts?.chapterCount ?? estimateLongNovelChapterCount(plan);
  const locale = resolveNovelOutputLocale(prompt);
  const result = await llmNovelJson(
    {
      model,
      system: buildLongNovelChapterPlanSystemPrompt(locale),
      user: buildChapterPlanUserMessage(
        prompt,
        bible,
        chapterCount,
        locale,
        opts?.avgCharsPerChapter,
        lengthTier,
      ),
      jsonSchema: buildNovelChapterPlanJsonSchema(chapterCount),
      temperature: 0.6,
      mode: "json_schema",
      timeoutMs: LONG_NOVEL_PRODUCT.chapterPlanTimeoutMs,
    },
    lengthTier,
  );
  if (result.ok) {
    const parsed = parseNovelChapterPlan(result.raw);
    const minValid =
      lengthTier === "long"
        ? LONG_NOVEL_PRODUCT.minChapterCount
        : Math.max(3, Math.floor(chapterCount * 0.75));
    if (parsed && parsed.chapters.length >= minValid) {
      return normalizeChapterPlan(parsed, chapterCount);
    }
  }
  return fallbackChapterPlan(bible, chapterCount);
}

function normalizeChapterPlan(plan: NovelChapterPlan, expected: number): NovelChapterPlan {
  let chapters = [...plan.chapters].sort((a, b) => a.num - b.num);
  if (chapters.length > expected) chapters = chapters.slice(0, expected);
  if (chapters.length < expected) {
    const base = fallbackChapterPlan(
      { title: "补章", worldSetting: "", characters: [], coreConflict: "", endingDirection: "" },
      expected,
    );
    chapters = base.chapters.map((c, i) => chapters[i] ?? c);
  }
  chapters = chapters.map((ch, i) => ({
    ...ch,
    num: i + 1,
    targetChars: ch.targetChars ?? LONG_NOVEL_PRODUCT.avgCharsPerChapter,
  }));
  return { chapters };
}

/** 按预估字数将章规划切成写作批次。续写时传 maxSegmentCap=maxSegments 以写完所有待写章。 */
export function splitChapterPlanIntoSegments(
  chapterPlan: NovelChapterPlan,
  plan: LongNovelSegmentPlan,
  segmentPhaseLabel: (index: number, total: number) => string,
  opts?: { maxSegmentCap?: number },
): ChapterSegmentSlice[] {
  const chapters = chapterPlan.chapters;
  const slices: ChapterSegmentSlice[] = [];
  let i = 0;
  let segIdx = 0;
  const maxSeg =
    opts?.maxSegmentCap ??
    computeSegmentCapForChapterPlan(chapters.length, plan);

  while (i < chapters.length && segIdx < maxSeg) {
    let charBudget = 0;
    const batch: ChapterPlanItem[] = [];
    while (i < chapters.length) {
      const ch = chapters[i]!;
      const est = ch.targetChars ?? LONG_NOVEL_PRODUCT.avgCharsPerChapter;
      if (
        batch.length >= LONG_NOVEL_PRODUCT.chaptersPerSegmentMax ||
        (batch.length > 0 && charBudget + est > plan.charsPerSegment)
      ) {
        break;
      }
      batch.push(ch);
      charBudget += est;
      i++;
      if (charBudget >= plan.charsPerSegment * 0.88) break;
    }
    if (batch.length === 0 && i < chapters.length) {
      batch.push(chapters[i]!);
      i++;
    }
    slices.push({
      segmentIndex: segIdx,
      chapters: batch,
      phase: segmentPhaseLabel(segIdx, maxSeg),
    });
    segIdx++;
  }

  if (i < chapters.length) {
    slices.push({
      segmentIndex: segIdx,
      chapters: chapters.slice(i),
      phase: segmentPhaseLabel(segIdx, Math.max(segIdx + 1, maxSeg)),
    });
  }

  if (slices.length === 0 && chapters.length > 0) {
    slices.push({
      segmentIndex: 0,
      chapters,
      phase: segmentPhaseLabel(0, 1),
    });
  }
  return slices;
}

/** 短篇/中篇：每批只写一章，从根上避免「一次输出漏章」。 */
export function splitChapterPlanOneChapterPerSlice(
  chapterPlan: NovelChapterPlan,
  segmentPhaseLabel: (index: number, total: number) => string,
): ChapterSegmentSlice[] {
  const chapters = chapterPlan.chapters;
  if (chapters.length === 0) return [];
  return chapters.map((ch, i) => ({
    segmentIndex: i,
    chapters: [ch],
    phase: segmentPhaseLabel(i, chapters.length),
  }));
}

export function formatChapterSliceForPrompt(
  chapters: ChapterPlanItem[],
  locale: BriefInputLocale = "zh",
): string {
  return chapters.map((c) => formatChapterPlanSliceLine(c, locale)).join("\n");
}

export function getRemainingChapterPlan(
  chapterPlan: NovelChapterPlan,
  content: string,
): ChapterPlanItem[] {
  const written = new Set(parseNovelChapters(content).map((c) => c.num));
  return chapterPlan.chapters.filter((ch) => !written.has(ch.num));
}

export function buildExtendChapterPlanUserMessage(opts: {
  prompt: string;
  bible: NovelBible;
  lastChapterNum: number;
  addCount: number;
  recentRecap: string;
}): string {
  const start = opts.lastChapterNum + 1;
  const end = opts.lastChapterNum + opts.addCount;
  return `用户创意：${opts.prompt.trim()}

${formatNovelBibleForPrompt(opts.bible)}

【已写至第 ${opts.lastChapterNum} 章，最近情节】
${opts.recentRecap}

请续规划第 ${start}–${end} 章（共 ${opts.addCount} 章）JSON，推进 toward 结局方向，phase 偏 rising/climax/resolution。
不要重复已写情节。`;
}

export function buildExtendChapterPlanJsonSchema(addCount: number) {
  return buildNovelChapterPlanJsonSchema(addCount);
}

export async function fetchExtendedChapterPlan(
  model: string,
  prompt: string,
  bible: NovelBible,
  lastChapterNum: number,
  addCount: number,
  recentRecap: string,
  lengthTier: NovelLengthTier,
): Promise<ChapterPlanItem[]> {
  const locale = resolveNovelOutputLocale(prompt);
  const result = await llmNovelJson(
    {
      model,
      system: buildLongNovelChapterPlanSystemPrompt(locale),
      user: buildExtendChapterPlanUserMessage({
        prompt,
        bible,
        lastChapterNum,
        addCount,
        recentRecap,
      }),
      jsonSchema: buildExtendChapterPlanJsonSchema(addCount),
      temperature: 0.6,
      mode: "json_schema",
      timeoutMs: LONG_NOVEL_PRODUCT.chapterPlanTimeoutMs,
    },
    lengthTier,
  );
  if (result.ok) {
    const parsed = parseNovelChapterPlan(result.raw);
    if (parsed?.chapters.length) {
      return parsed.chapters
        .map((ch, i) => ({
          ...ch,
          num: lastChapterNum + 1 + i,
          targetChars: ch.targetChars ?? LONG_NOVEL_PRODUCT.avgCharsPerChapter,
        }))
        .slice(0, addCount);
    }
  }
  const fallback: ChapterPlanItem[] = [];
  for (let i = 0; i < addCount; i++) {
    const num = lastChapterNum + 1 + i;
    fallback.push({
      num,
      title: i === addCount - 1 ? "新篇" : `第${num}章`,
      summary: `承接前文，推进${bible.coreConflict.slice(0, 40)}…`,
      phase: i === addCount - 1 ? "resolution" : "rising",
      targetChars: LONG_NOVEL_PRODUCT.avgCharsPerChapter,
    });
  }
  return fallback;
}
