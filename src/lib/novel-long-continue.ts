import type { AppLocale } from "@/i18n/routing";
import { novelContinuationMessage, novelContinuePhaseMessage } from "@/lib/i18n/chapter-labels";
import { progressNovelMessage } from "@/lib/i18n/progress-message";
import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";
import { formatChapterRecapLine } from "@/lib/novel-locale-prompts";
import { fitNovelContentToMaxChars, parseNovelChapters } from "@/lib/novel-chapters";
import { assessNovelCompleteness } from "@/lib/novel-completeness";
import { novelMaxChars, parseNovelLengthTier, type NovelLengthTier } from "@/lib/novel-length";
import { fetchNovelBible, formatNovelBibleForPrompt } from "@/lib/novel-long-bible";
import {
  fetchExtendedChapterPlan,
  fetchNovelChapterPlan,
  getRemainingChapterPlan,
  splitChapterPlanIntoSegments,
} from "@/lib/novel-long-chapter-plan";
import type { ChapterPlanItem } from "@/lib/novel-long-pipeline-types";
import { clampContinueChapterCount } from "@/lib/novel-continue-options";
import { LONG_NOVEL_PRODUCT, planLongNovelSegments } from "@/lib/novel-long-config";
import type { NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import { NOVEL_PIPELINE_VERSION } from "@/lib/novel-long-pipeline-types";
import {
  buildLongNovelSegmentUserMessage,
  getNovelContinuationSystemPrompt,
  type LongNovelGenerateResult,
  type NovelStreamEmitter,
  writeNovelSegmentSlices,
} from "@/lib/novel-long-generate";

export type NovelContinuationAssessment = {
  canContinue: boolean;
  reason: string;
  remainingChapterCount: number;
  charsRemaining: number;
};

export function assessNovelContinuation(opts: {
  lengthTier: string | null | undefined;
  content: string;
  meta: NovelGenerationMeta | null;
  uiLocale?: AppLocale;
}): NovelContinuationAssessment {
  const uiLocale = opts.uiLocale ?? "zh-Hans";
  const tier = parseNovelLengthTier(opts.lengthTier);
  const hardMax = novelMaxChars("long");
  const charsRemaining = Math.max(0, hardMax - opts.content.length);

  if (tier !== "long") {
    return {
      canContinue: false,
      reason: novelContinuationMessage(uiLocale, "notLongForm"),
      remainingChapterCount: 0,
      charsRemaining,
    };
  }
  if (charsRemaining < 500) {
    return {
      canContinue: false,
      reason: novelContinuationMessage(uiLocale, "atCharLimit"),
      remainingChapterCount: 0,
      charsRemaining,
    };
  }

  if (opts.meta) {
    const remaining = getRemainingChapterPlan(opts.meta.chapterPlan, opts.content);
    if (remaining.length > 0) {
      return {
        canContinue: true,
        reason: novelContinuationMessage(uiLocale, "chaptersRemaining", { count: remaining.length }),
        remainingChapterCount: remaining.length,
        charsRemaining,
      };
    }
    return {
      canContinue: true,
      reason: novelContinuationMessage(uiLocale, "planComplete"),
      remainingChapterCount: 0,
      charsRemaining,
    };
  }

  return {
    canContinue: true,
    reason: novelContinuationMessage(uiLocale, "resumeFromBody"),
    remainingChapterCount: -1,
    charsRemaining,
  };
}

function recentChapterRecap(content: string, prompt: string, maxChars = 600): string {
  const locale = resolveNovelOutputLocale(prompt);
  const chapters = parseNovelChapters(content);
  if (chapters.length === 0) return content.slice(-maxChars);
  return chapters
    .slice(-3)
    .map((c) => formatChapterRecapLine(c, locale, 120))
    .join("\n")
    .slice(0, maxChars);
}


/** 长篇续写：基于 generationMetaJson + 已有正文，写剩余或新增章节。 */
export async function streamLongNovelContinue(params: {
  model: string;
  promptTrim: string;
  titleTrim: string;
  existingContent: string;
  meta: NovelGenerationMeta | null;
  lengthTier: NovelLengthTier;
  uiLocale?: AppLocale;
  emit: NovelStreamEmitter;
  /** 本次最多写几章；null = 写完所有待写章 */
  maxChaptersToWrite?: number | null;
  polish?: boolean;
}): Promise<LongNovelGenerateResult> {
  const { model, promptTrim, titleTrim, existingContent, lengthTier, emit } = params;
  const uiLocale = params.uiLocale ?? "zh-Hans";
  const polish = params.polish ?? LONG_NOVEL_PRODUCT.polishAfterSegment;
  const maxChaptersToWrite = params.maxChaptersToWrite;
  let meta = params.meta;
  const content = existingContent.trim();
  const hardMax = novelMaxChars(lengthTier);
  const basePlan = planLongNovelSegments(lengthTier);

  emit({ step: "continue_start", message: progressNovelMessage(uiLocale, "continuePrep") });

  if (!meta) {
    emit({ step: "bible_start", message: progressNovelMessage(uiLocale, "bibleRecoverStart") });
    const bible = await fetchNovelBible(model, promptTrim, titleTrim, basePlan, lengthTier);
    emit({
      step: "bible_ready",
      message: progressNovelMessage(uiLocale, "bibleRecoverReady", { title: bible.title }),
    });
    emit({ step: "chapter_plan_start", message: progressNovelMessage(uiLocale, "chapterPlanContinueStart") });
    const written = parseNovelChapters(content);
    const lastNum = written.length > 0 ? Math.max(...written.map((c) => c.num)) : 0;
    let extendCount = Math.min(
      LONG_NOVEL_PRODUCT.continueExtendChapterCount,
      Math.max(4, estimateExtendCount(content.length, hardMax)),
    );
    if (maxChaptersToWrite != null && maxChaptersToWrite > 0) {
      extendCount = Math.min(extendCount, maxChaptersToWrite);
    }
    let newChapters: ChapterPlanItem[];
    if (lastNum === 0) {
      const plan = await fetchNovelChapterPlan(model, promptTrim, bible, basePlan, lengthTier);
      newChapters = getRemainingChapterPlan(plan, content);
      const lim = clampContinueChapterCount(maxChaptersToWrite, newChapters.length);
      if (lim != null && lim < newChapters.length) newChapters = newChapters.slice(0, lim);
      meta = {
        version: NOVEL_PIPELINE_VERSION,
        bible,
        chapterPlan: plan,
        segmentCount: 0,
        createdAt: new Date().toISOString(),
      };
    } else {
      newChapters = await fetchExtendedChapterPlan(
        model,
        promptTrim,
        bible,
        lastNum,
        extendCount,
        recentChapterRecap(content, promptTrim),
        lengthTier,
      );
      meta = {
        version: NOVEL_PIPELINE_VERSION,
        bible,
        chapterPlan: { chapters: [...written.map(planFromWritten), ...newChapters] },
        segmentCount: 0,
        createdAt: new Date().toISOString(),
      };
    }
    emit({
      step: "chapter_plan_ready",
      message: progressNovelMessage(uiLocale, "chapterPlanContinueReady", { count: newChapters.length }),
      chapterCount: newChapters.length,
    });
  }

  const bible = meta.bible;
  const bibleText = formatNovelBibleForPrompt(bible);

  let remaining = getRemainingChapterPlan(meta.chapterPlan, content);
  if (remaining.length === 0) {
    emit({ step: "chapter_plan_start", message: progressNovelMessage(uiLocale, "chapterPlanNewStart") });
    const written = parseNovelChapters(content);
    const lastNum = written.length > 0 ? Math.max(...written.map((c) => c.num)) : 0;
    let extendCount = Math.min(
      LONG_NOVEL_PRODUCT.continueExtendChapterCount,
      Math.max(4, estimateExtendCount(content.length, hardMax)),
    );
    if (maxChaptersToWrite != null && maxChaptersToWrite > 0) {
      extendCount = Math.min(extendCount, maxChaptersToWrite);
    }
    const newChapters = await fetchExtendedChapterPlan(
      model,
      promptTrim,
      bible,
      lastNum,
      extendCount,
      recentChapterRecap(content, promptTrim),
      lengthTier,
    );
    meta = {
      ...meta,
      chapterPlan: { chapters: [...meta.chapterPlan.chapters, ...newChapters] },
    };
    remaining = newChapters;
    emit({
      step: "chapter_plan_ready",
      message: progressNovelMessage(uiLocale, "chapterPlanNewReady", { count: newChapters.length }),
      chapterCount: remaining.length,
    });
  }

  if (remaining.length === 0) {
    throw new Error(progressNovelMessage(uiLocale, "continueNoChapters"));
  }

  const chapterLimit = clampContinueChapterCount(maxChaptersToWrite, remaining.length);
  if (chapterLimit != null && chapterLimit < remaining.length) {
    remaining = remaining.slice(0, chapterLimit);
    emit({
      step: "continue_limit",
      message: progressNovelMessage(uiLocale, "continueLimited", { count: remaining.length }),
      maxChapters: remaining.length,
    });
  }

  const slices = splitChapterPlanIntoSegments(
    { chapters: remaining },
    basePlan,
    (index, total) => novelContinuePhaseMessage(uiLocale, index, total),
    { maxSegmentCap: LONG_NOVEL_PRODUCT.maxSegments },
  );

  emit({
    step: "continue_ready",
    message: progressNovelMessage(uiLocale, "continueBatchPlan", {
      batches: slices.length,
      chapters: remaining.length,
      remaining: (hardMax - content.length).toLocaleString(),
    }),
    remainingChapters: remaining.map((c) => c.num),
  });

  const writeResult = await writeNovelSegmentSlices({
    model,
    promptTrim,
    titleTrim,
    bibleText,
    bible,
    slices,
    previousContent: content,
    lengthTier,
    isContinuation: true,
    polish,
    emit,
    uiLocale,
    stopWhenLength: hardMax,
  });

  const finalContent = fitNovelContentToMaxChars(writeResult.content, hardMax);
  const pipelineMeta = {
    ...meta,
    segmentCount: (meta.segmentCount ?? 0) + slices.length,
    createdAt: meta.createdAt,
  };
  const completeness = assessNovelCompleteness(
    finalContent,
    lengthTier,
    undefined,
    promptTrim,
    pipelineMeta.chapterPlan,
    uiLocale,
  );

  return {
    content: finalContent,
    pipelineMeta,
    completeness,
  };
}

function estimateExtendCount(currentLen: number, hardMax: number): number {
  const room = hardMax - currentLen;
  return Math.min(
    LONG_NOVEL_PRODUCT.continueExtendChapterCount,
    Math.max(4, Math.ceil(room / LONG_NOVEL_PRODUCT.avgCharsPerChapter)),
  );
}

function planFromWritten(ch: { num: number; title: string; body: string }): ChapterPlanItem {
  return {
    num: ch.num,
    title: ch.title,
    summary: ch.body.replace(/\s+/g, " ").slice(0, 80) + "…",
    phase: "rising",
    targetChars: LONG_NOVEL_PRODUCT.avgCharsPerChapter,
  };
}
