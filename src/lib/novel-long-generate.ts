import type { AppLocale } from "@/i18n/routing";
import { progressNovelMessage } from "@/lib/i18n/progress-message";
import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";
import { llmNovelTextStream } from "@/lib/llm";
import { assessNovelCompleteness, type NovelCompletenessReport } from "@/lib/novel-completeness";
import { repairPlannedNovelCompleteness } from "@/lib/novel-completeness-repair";
import { fitNovelContentToMaxChars, mergeNovelChapterContents, normalizeSegmentToChapterPlan, parseNovelChapters } from "@/lib/novel-chapters";
import { getNovelSystemPrompt } from "@/lib/novel-generate-config";
import { fillMissingPlannedNovelChapters } from "@/lib/novel-missing-chapters-fill";
import {
  getLongNovelContinuationSystemPrompt,
  longNovelSegmentPhaseLabel,
  buildLongNovelSegmentBatchTask,
  buildLongNovelSegmentUserMessageBody,
  formatChapterRecapLine,
  joinChapterNums,
} from "@/lib/novel-locale-prompts";
import { novelMaxChars, type NovelLengthOptions, type NovelLengthTier } from "@/lib/novel-length";
import { fetchNovelBible, formatNovelBibleForPrompt } from "@/lib/novel-long-bible";
import {
  fetchNovelChapterPlan,
  formatChapterSliceForPrompt,
  getRemainingChapterPlan,
  splitChapterPlanIntoSegments,
  computeSegmentCapForChapterPlan,
  type ChapterSegmentSlice,
} from "@/lib/novel-long-chapter-plan";
import { allocateChapterTargetChars, planNovelScope } from "@/lib/novel-scope-plan";
import {
  checkSegmentConsistency,
  formatConsistencyIssues,
} from "@/lib/novel-long-consistency";
import { polishNovelSegmentText } from "@/lib/novel-long-polish";
import { LONG_NOVEL_PRODUCT, planLongNovelSegments, type LongNovelSegmentPlan } from "@/lib/novel-long-config";
import type { NovelBible, NovelChapterPlan, NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import { NOVEL_PIPELINE_VERSION } from "@/lib/novel-long-pipeline-types";

export type NovelStreamEmitter = (event: Record<string, unknown>) => void;

export { planLongNovelSegments, type LongNovelSegmentPlan };

export type LongNovelGenerateResult = {
  content: string;
  pipelineMeta: NovelGenerationMeta;
  completeness: NovelCompletenessReport;
};

export function usesSegmentedLongGeneration(tier: NovelLengthTier): boolean {
  return tier === "long";
}

export function getNovelContinuationSystemPrompt(locale: BriefInputLocale = "zh"): string {
  return getLongNovelContinuationSystemPrompt(locale);
}

export function buildLongNovelSegmentUserMessage(opts: {
  prompt: string;
  title?: string;
  bibleText: string;
  chapterSlice: ChapterSegmentSlice;
  segmentIndex: number;
  totalSegments: number;
  previousContent: string;
  targetCharsThisSegment: number;
  isContinuation?: boolean;
  locale?: BriefInputLocale;
}): string {
  const {
    prompt,
    title,
    bibleText,
    chapterSlice,
    segmentIndex,
    totalSegments,
    previousContent,
    targetCharsThisSegment,
    isContinuation,
    locale: localeRaw,
  } = opts;
  const locale = localeRaw ?? resolveNovelOutputLocale(prompt);
  const chapters = parseNovelChapters(previousContent);
  const recap = chapters
    .slice(-LONG_NOVEL_PRODUCT.contextRecapChapters)
    .map((c) => formatChapterRecapLine(c, locale))
    .join("\n");
  const tail = previousContent.slice(-LONG_NOVEL_PRODUCT.contextTailChars);
  const chapterBlock = formatChapterSliceForPrompt(chapterSlice.chapters, locale);
  const nums = joinChapterNums(
    chapterSlice.chapters.map((c) => c.num),
    locale,
  );

  const hasPrior = previousContent.trim().length > 0;
  const task = buildLongNovelSegmentBatchTask({
    locale,
    segmentIndex,
    totalSegments,
    phase: chapterSlice.phase,
    nums,
    targetChars: targetCharsThisSegment,
    hasPrior,
    isContinuation: Boolean(isContinuation),
  });

  return buildLongNovelSegmentUserMessageBody({
    locale,
    prompt,
    title,
    bibleText,
    chapterBlock,
    recap,
    tail,
    task,
  });
}

export type LongNovelResumeInput = {
  bible: NovelBible;
  chapterPlan: NovelChapterPlan;
  plan: LongNovelSegmentPlan;
  previousContent: string;
  completedSegmentIndex: number;
  promptTrim: string;
  titleTrim?: string;
  polish?: boolean;
};

/** 长篇：流水线流式生成（设定圣经 → 章规划 → 按章分批写作 → 一致性校验）。 */
export async function streamLongNovelBody(params: {
  model: string;
  promptTrim: string;
  titleTrim?: string;
  plan: LongNovelSegmentPlan;
  lengthTier: NovelLengthTier;
  lengthOpts?: NovelLengthOptions;
  uiLocale?: AppLocale;
  emit: NovelStreamEmitter;
  polish?: boolean;
  resume?: LongNovelResumeInput;
  onSegmentCheckpoint?: (opts: { index: number; content: string; meta: NovelGenerationMeta }) => Promise<void>;
  onPipelineReady?: (meta: NovelGenerationMeta) => Promise<void>;
}): Promise<LongNovelGenerateResult> {
  const { model, promptTrim, titleTrim, plan, lengthTier, emit, resume } = params;
  const uiLocale = params.uiLocale ?? "zh-Hans";
  const polish = params.polish ?? resume?.polish ?? LONG_NOVEL_PRODUCT.polishAfterSegment;

  let bible: NovelBible;
  let chapterPlan: NovelChapterPlan;
  let startSegmentIndex = 0;
  let previousContent = "";

  if (resume) {
    bible = resume.bible;
    chapterPlan = resume.chapterPlan;
    startSegmentIndex = resume.completedSegmentIndex + 1;
    previousContent = resume.previousContent;
    emit({
      step: "resume_ready",
      message: progressNovelMessage(uiLocale, "resumeReady", {
        start: startSegmentIndex + 1,
        done: resume.completedSegmentIndex + 1,
        length: previousContent.length,
      }),
      completedSegments: resume.completedSegmentIndex + 1,
      length: previousContent.length,
    });
  } else {
    emit({ step: "bible_start", message: progressNovelMessage(uiLocale, "bibleStart") });
    bible = await fetchNovelBible(model, promptTrim, titleTrim, plan, lengthTier, uiLocale);
    emit({
      step: "bible_ready",
      message: progressNovelMessage(uiLocale, "bibleReady", {
        title: bible.title,
        count: bible.characters.length,
      }),
    });

    emit({ step: "chapter_plan_start", message: progressNovelMessage(uiLocale, "chapterPlanStart") });
    const scope = planNovelScope(lengthTier);
    chapterPlan = await fetchNovelChapterPlan(model, promptTrim, bible, plan, lengthTier, {
      chapterCount: scope.chapterCount,
      avgCharsPerChapter: scope.avgCharsPerChapter,
    });
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
  }

  const outputLocale = resolveNovelOutputLocale(promptTrim);
  const bibleText = formatNovelBibleForPrompt(bible, outputLocale);
  const segmentCap = computeSegmentCapForChapterPlan(chapterPlan.chapters.length, plan);
  const slices = splitChapterPlanIntoSegments(
    chapterPlan,
    plan,
    (index, total) => longNovelSegmentPhaseLabel(index, total, outputLocale),
    { maxSegmentCap: segmentCap },
  );
  const hardMax = novelMaxChars(lengthTier);
  const baseMeta: NovelGenerationMeta = {
    version: NOVEL_PIPELINE_VERSION,
    bible,
    chapterPlan,
    segmentCount: slices.length,
    createdAt: new Date().toISOString(),
  };

  if (!resume && params.onPipelineReady) {
    await params.onPipelineReady(baseMeta);
  }

  let { content } = await writeNovelSegmentSlices({
    model,
    promptTrim: resume?.promptTrim ?? promptTrim,
    titleTrim: resume?.titleTrim ?? titleTrim,
    bibleText,
    bible,
    slices,
    previousContent,
    lengthTier,
    isContinuation: Boolean(resume),
    polish,
    emit,
    uiLocale,
    stopWhenLength: Math.min(plan.targetTotalChars, hardMax),
    startSegmentIndex,
    onSegmentDone: params.onSegmentCheckpoint
      ? async (index, segmentContent) => {
          await params.onSegmentCheckpoint!({
            index,
            content: segmentContent,
            meta: baseMeta,
          });
        }
      : undefined,
  });

  if (getRemainingChapterPlan(chapterPlan, content).length > 0) {
    content = await fillMissingPlannedNovelChapters({
      model,
      promptTrim: resume?.promptTrim ?? promptTrim,
      titleTrim: resume?.titleTrim ?? titleTrim,
      content,
      lengthTier,
      lengthOpts: params.lengthOpts,
      pipelineMeta: baseMeta,
      uiLocale,
      emit,
    });
  }

  const repaired = await repairPlannedNovelCompleteness({
    model,
    promptTrim: resume?.promptTrim ?? promptTrim,
    titleTrim: resume?.titleTrim ?? titleTrim,
    content,
    lengthTier,
    lengthOpts: params.lengthOpts,
    pipelineMeta: baseMeta,
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
    const fitted = fitNovelContentToMaxChars(finalContent, hardMax);
    if (getRemainingChapterPlan(chapterPlan, fitted).length === 0) {
      finalContent = fitted;
    }
  }

  const completeness = assessNovelCompleteness(
    finalContent,
    lengthTier,
    params.lengthOpts,
    resume?.promptTrim ?? promptTrim,
    chapterPlan,
    uiLocale,
  );

  return { content: finalContent, pipelineMeta: baseMeta, completeness };
}

/** 按切片流式写作（首启与续写共用）。 */
export async function writeNovelSegmentSlices(params: {
  model: string;
  promptTrim: string;
  titleTrim?: string;
  bibleText: string;
  bible: NovelBible;
  slices: ChapterSegmentSlice[];
  previousContent: string;
  lengthTier: NovelLengthTier;
  isContinuation: boolean;
  uiLocale?: AppLocale;
  emit: NovelStreamEmitter;
  stopWhenLength: number;
  polish?: boolean;
  startSegmentIndex?: number;
  onSegmentDone?: (index: number, content: string) => Promise<void>;
  requireAllPlannedChapters?: boolean;
}): Promise<{ content: string }> {
  const {
    model,
    promptTrim,
    titleTrim,
    bibleText,
    bible,
    slices,
    previousContent,
    lengthTier,
    isContinuation,
    emit,
    stopWhenLength,
  } = params;
  const uiLocale = params.uiLocale ?? "zh-Hans";
  const polish = params.polish ?? LONG_NOVEL_PRODUCT.polishAfterSegment;
  const startAt = Math.max(0, params.startSegmentIndex ?? 0);
  const requireAllPlannedChapters = params.requireAllPlannedChapters ?? true;

  let content = previousContent.trim();
  const totalSegments = slices.length;
  const segmentTimeout = LONG_NOVEL_PRODUCT.segmentTimeoutMs;
  const segmentMaxTokens = LONG_NOVEL_PRODUCT.segmentMaxTokens;
  const hardMax = novelMaxChars(lengthTier);

  for (let i = startAt; i < slices.length; i++) {
    const slice = slices[i]!;
    const targetCharsThisSegment = slice.chapters.reduce(
      (s, c) => s + (c.targetChars ?? LONG_NOVEL_PRODUCT.avgCharsPerChapter),
      0,
    );

    emit({
      step: "segment_start",
      index: i + 1,
      total: totalSegments,
      label: slice.phase,
      chapters: slice.chapters.map((c) => c.num),
      message: progressNovelMessage(uiLocale, "segmentBatch", {
        index: i + 1,
        total: totalSegments,
        phase: slice.phase,
        nums: slice.chapters.map((c) => c.num).join(uiLocale.startsWith("zh") ? "、" : ", "),
      }),
    });

    const outputLocale = resolveNovelOutputLocale(promptTrim);
    const userMsg = buildLongNovelSegmentUserMessage({
      prompt: promptTrim,
      title: titleTrim,
      bibleText,
      chapterSlice: slice,
      segmentIndex: i,
      totalSegments,
      previousContent: content,
      targetCharsThisSegment,
      isContinuation,
      locale: outputLocale,
    });
    const useContinuationSystem =
      isContinuation || content.length > 0 || i > 0;
    const system = useContinuationSystem
      ? getNovelContinuationSystemPrompt(outputLocale)
      : getNovelSystemPrompt(lengthTier, undefined, promptTrim);

    let segmentText = "";
    const contentBeforeSegment = content;
    for (let attempt = 1; attempt <= 3; attempt++) {
      segmentText = "";
      for await (const delta of llmNovelTextStream(
        {
          model,
          system,
          user: userMsg,
          temperature: attempt === 1 ? 0.82 : 0.75,
          maxTokens: segmentMaxTokens,
          timeoutMs: segmentTimeout,
        },
        lengthTier,
      )) {
        segmentText += delta;
        emit({ step: "delta", text: delta, segment: i + 1, attempt });
      }

      segmentText = segmentText.trim();
      if (!segmentText) continue;

      segmentText = normalizeSegmentToChapterPlan(segmentText, slice.chapters, outputLocale);
      const trial = mergeNovelChapterContents(content, segmentText, outputLocale);
      const writtenNums = new Set(parseNovelChapters(trial).map((c) => c.num));
      if (slice.chapters.every((ch) => writtenNums.has(ch.num))) {
        content = trial;
        break;
      }
      if (attempt === 3) {
        content = trial;
      }
    }

    if (!segmentText.trim()) {
      throw new Error(progressNovelMessage(uiLocale, "segmentEmpty", { index: i + 1 }));
    }

    emit({ step: "consistency_start", message: progressNovelMessage(uiLocale, "consistencyStart", { index: i + 1 }) });
    const report = checkSegmentConsistency({
      bible,
      expectedChapters: slice.chapters,
      segmentText,
      previousContent: content,
      uiLocale,
    });
    if (report.issues.length > 0) {
      emit({
        step: "consistency_warn",
        index: i + 1,
        ok: report.ok,
        issues: report.issues,
        message: formatConsistencyIssues(report.issues),
      });
    } else {
      emit({ step: "consistency_ok", index: i + 1, message: progressNovelMessage(uiLocale, "consistencyOk") });
    }

    if (polish) {
      emit({ step: "polish_batch_start", index: i + 1, message: progressNovelMessage(uiLocale, "polishBatchStart", { index: i + 1 }) });
      segmentText = await polishNovelSegmentText({
        segmentText,
        bible,
        model,
        lengthTier,
        prompt: promptTrim,
        outputLocale,
        emit,
        segmentIndex: i + 1,
      });
      emit({ step: "polish_batch_done", index: i + 1, message: progressNovelMessage(uiLocale, "polishBatchDone", { index: i + 1 }) });
      content = mergeNovelChapterContents(contentBeforeSegment, segmentText, outputLocale);
    }

    emit({
      step: "segment_done",
      index: i + 1,
      total: totalSegments,
      length: content.length,
      target: stopWhenLength,
    });

    if (params.onSegmentDone) {
      await params.onSegmentDone(i, content);
    }

    const reachedLengthCap = content.length >= stopWhenLength || content.length >= hardMax;
    const lastSlice = i >= slices.length - 1;
    if (reachedLengthCap && (!requireAllPlannedChapters || lastSlice)) break;
  }

  return { content };
}

/** 长篇：非流式（供 POST /api/novel/generate）。 */
export async function generateLongNovelBody(
  params: Omit<Parameters<typeof streamLongNovelBody>[0], "emit">,
): Promise<LongNovelGenerateResult> {
  return streamLongNovelBody({ ...params, emit: () => {} });
}
