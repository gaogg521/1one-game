import type { AppLocale } from "@/i18n/routing";
import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";
import { fitNovelContentToMaxChars } from "@/lib/novel-chapters";
import {
  assessNovelCompleteness,
  type NovelCompletenessReport,
} from "@/lib/novel-completeness";
import { repairPlannedNovelCompleteness } from "@/lib/novel-completeness-repair";
import { novelMinAcceptChars } from "@/lib/novel-generate-config";
import type { NovelLengthOptions, NovelLengthTier } from "@/lib/novel-length";
import { fetchNovelBible, formatNovelBibleForPrompt } from "@/lib/novel-long-bible";
import {
  fetchNovelChapterPlan,
  getRemainingChapterPlan,
  splitChapterPlanOneChapterPerSlice,
} from "@/lib/novel-long-chapter-plan";
import type { LongNovelSegmentPlan } from "@/lib/novel-long-config";
import { writeNovelSegmentSlices, type NovelStreamEmitter } from "@/lib/novel-long-generate";
import { longNovelSegmentPhaseLabel } from "@/lib/novel-locale-prompts";
import { fillMissingPlannedNovelChapters } from "@/lib/novel-missing-chapters-fill";
import type { NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import { NOVEL_PIPELINE_VERSION } from "@/lib/novel-long-pipeline-types";
import {
  allocateChapterTargetChars,
  planNovelScope,
  type NovelScopePlan,
} from "@/lib/novel-scope-plan";
import { progressNovelMessage } from "@/lib/i18n/progress-message";

function scopeToSegmentPlan(scope: NovelScopePlan): LongNovelSegmentPlan {
  return {
    totalSegments: scope.chapterCount,
    charsPerSegment: scope.avgCharsPerChapter,
    targetTotalChars: scope.targetTotalChars,
    minAcceptChars: novelMinAcceptChars(scope.tier),
  };
}

export type PlannedNovelGenerateResult = {
  content: string;
  pipelineMeta: NovelGenerationMeta;
  completeness: NovelCompletenessReport;
};

/**
 * 短篇 / 中篇：设定圣经 → 章提纲 → **按章分批写作**（与长篇同架构）→ 完整性门禁。
 * 不再「一次写完再补章」。
 */
export async function streamPlannedNovelBody(params: {
  model: string;
  promptTrim: string;
  titleTrim?: string;
  lengthTier: NovelLengthTier;
  lengthOpts?: NovelLengthOptions;
  uiLocale?: AppLocale;
  emit: NovelStreamEmitter;
}): Promise<PlannedNovelGenerateResult> {
  const { model, promptTrim, titleTrim, lengthTier, lengthOpts, uiLocale = "zh-Hans", emit } = params;
  const scope = planNovelScope(lengthTier, lengthOpts);
  const segmentPlan = scopeToSegmentPlan(scope);
  const outputLocale = resolveNovelOutputLocale(promptTrim);

  emit({ step: "bible_start", message: progressNovelMessage(uiLocale, "bibleStart") });
  const bible = await fetchNovelBible(model, promptTrim, titleTrim, segmentPlan, lengthTier, uiLocale);
  emit({
    step: "bible_ready",
    message: progressNovelMessage(uiLocale, "bibleReady", {
      title: bible.title,
      count: bible.characters.length,
    }),
  });

  emit({ step: "chapter_plan_start", message: progressNovelMessage(uiLocale, "chapterPlanStart") });
  let chapterPlan = await fetchNovelChapterPlan(
    model,
    promptTrim,
    bible,
    segmentPlan,
    lengthTier,
    { chapterCount: scope.chapterCount, avgCharsPerChapter: scope.avgCharsPerChapter },
  );
  chapterPlan = {
    chapters: allocateChapterTargetChars(chapterPlan.chapters, scope.targetTotalChars),
  };
  emit({
    step: "chapter_plan_ready",
    message: progressNovelMessage(uiLocale, "chapterPlanReady", {
      count: chapterPlan.chapters.length,
    }),
    chapterCount: chapterPlan.chapters.length,
  });

  const bibleText = formatNovelBibleForPrompt(bible, outputLocale);
  const slices = splitChapterPlanOneChapterPerSlice(chapterPlan, (i, total) =>
    longNovelSegmentPhaseLabel(i, total, outputLocale),
  );

  const pipelineMeta: NovelGenerationMeta = {
    version: NOVEL_PIPELINE_VERSION,
    bible,
    chapterPlan,
    segmentCount: slices.length,
    createdAt: new Date().toISOString(),
  };

  const { content: segmented } = await writeNovelSegmentSlices({
    model,
    promptTrim,
    titleTrim,
    bibleText,
    bible,
    slices,
    previousContent: "",
    lengthTier,
    isContinuation: false,
    emit,
    uiLocale,
    stopWhenLength: scope.maxChars,
    polish: false,
    requireAllPlannedChapters: true,
  });

  let content = segmented.trim();

  if (getRemainingChapterPlan(chapterPlan, content).length > 0) {
    content = await fillMissingPlannedNovelChapters({
      model,
      promptTrim,
      titleTrim,
      content,
      lengthTier,
      lengthOpts,
      pipelineMeta,
      uiLocale,
      emit,
    });
  }

  const repaired = await repairPlannedNovelCompleteness({
    model,
    promptTrim,
    titleTrim,
    content,
    lengthTier,
    lengthOpts,
    pipelineMeta,
    uiLocale,
    emit,
  });

  if (!repaired.completeness.ok) {
    throw new Error(
      progressNovelMessage(uiLocale, "completenessFail", { reason: repaired.completeness.reason }),
    );
  }

  let finalContent = repaired.content.trim();
  if (getRemainingChapterPlan(chapterPlan, finalContent).length === 0) {
    const fitted = fitNovelContentToMaxChars(finalContent, scope.maxChars);
    if (getRemainingChapterPlan(chapterPlan, fitted).length === 0) {
      finalContent = fitted;
    }
  }

  const completeness = assessNovelCompleteness(
    finalContent,
    lengthTier,
    lengthOpts,
    promptTrim,
    chapterPlan,
    uiLocale,
  );

  return { content: finalContent, pipelineMeta, completeness };
}

/** 非流式 POST 入口 */
export async function generatePlannedNovelBody(
  params: Omit<Parameters<typeof streamPlannedNovelBody>[0], "emit">,
): Promise<PlannedNovelGenerateResult> {
  return streamPlannedNovelBody({ ...params, emit: () => {} });
}
