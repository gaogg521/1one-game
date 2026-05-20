import { parseNovelChapters } from "@/lib/novel-chapters";
import { llmNovelJson } from "@/lib/llm";
import {
  estimateLongNovelChapterCount,
  LONG_NOVEL_PRODUCT,
  type LongNovelSegmentPlan,
} from "@/lib/novel-long-config";
import { novelLengthConfig, type NovelLengthTier } from "@/lib/novel-length";
import { formatNovelBibleForPrompt, type NovelBible } from "@/lib/novel-long-bible";
import {
  buildNovelChapterPlanJsonSchema,
  type ChapterPlanItem,
  type NovelChapterPlan,
  parseNovelChapterPlan,
} from "@/lib/novel-long-pipeline-types";

const CHAPTER_PLAN_SYSTEM = `你是长篇网络小说章节规划编辑。根据设定圣经，输出全书分章要点 JSON。
要求：章节号从 1 递增；title 2–12 字；summary 每章 2–3 句写清本章事件与情绪；phase 分布合理（opening→rising→climax→resolution）。`;

export type ChapterSegmentSlice = {
  segmentIndex: number;
  chapters: ChapterPlanItem[];
  phase: string;
};

export function buildChapterPlanUserMessage(
  prompt: string,
  bible: NovelBible,
  chapterCount: number,
): string {
  const cfg = novelLengthConfig("long");
  return `用户创意：${prompt.trim()}

${formatNovelBibleForPrompt(bible)}

请规划全书 **恰好 ${chapterCount} 章** 的 chapter plan JSON。
全书目标 ${cfg.minChars}–${cfg.maxChars} 字；每章 targetChars 建议 ${LONG_NOVEL_PRODUCT.avgCharsPerChapter} 左右。
不要写正文，只输出 chapters 数组。`;
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

export async function fetchNovelChapterPlan(
  model: string,
  prompt: string,
  bible: NovelBible,
  plan: LongNovelSegmentPlan,
  lengthTier: NovelLengthTier,
): Promise<NovelChapterPlan> {
  const chapterCount = estimateLongNovelChapterCount(plan);
  const result = await llmNovelJson(
    {
      model,
      system: CHAPTER_PLAN_SYSTEM,
      user: buildChapterPlanUserMessage(prompt, bible, chapterCount),
      jsonSchema: buildNovelChapterPlanJsonSchema(chapterCount),
      temperature: 0.6,
      mode: "json_schema",
      timeoutMs: LONG_NOVEL_PRODUCT.chapterPlanTimeoutMs,
    },
    lengthTier,
  );
  if (result.ok) {
    const parsed = parseNovelChapterPlan(result.raw);
    if (parsed && parsed.chapters.length >= LONG_NOVEL_PRODUCT.minChapterCount) {
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
  const maxSeg = opts?.maxSegmentCap ?? plan.totalSegments;

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

  if (slices.length === 0 && chapters.length > 0) {
    slices.push({
      segmentIndex: 0,
      chapters,
      phase: segmentPhaseLabel(0, 1),
    });
  }
  return slices;
}

export function formatChapterSliceForPrompt(chapters: ChapterPlanItem[]): string {
  return chapters
    .map((c) => `第${c.num}章《${c.title}》（${c.phase}）：${c.summary}`)
    .join("\n");
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
  const result = await llmNovelJson(
    {
      model,
      system: CHAPTER_PLAN_SYSTEM,
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
