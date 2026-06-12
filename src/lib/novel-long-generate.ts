import type { AppLocale } from "@/i18n/routing";
import { progressNovelMessage } from "@/lib/i18n/progress-message";
import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";
import { llmNovelTextStream } from "@/lib/llm";
import { fitNovelContentToMaxChars, parseNovelChapters } from "@/lib/novel-chapters";
import { getNovelSystemPrompt } from "@/lib/novel-generate-config";
import {
  getLongNovelContinuationSystemPrompt,
  longNovelSegmentPhaseLabel,
} from "@/lib/novel-locale-prompts";
import { novelMaxChars, type NovelLengthTier } from "@/lib/novel-length";
import { fetchNovelBible, formatNovelBibleForPrompt } from "@/lib/novel-long-bible";
import {
  fetchNovelChapterPlan,
  formatChapterSliceForPrompt,
  splitChapterPlanIntoSegments,
  type ChapterSegmentSlice,
} from "@/lib/novel-long-chapter-plan";
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
    .map((c) =>
      locale === "en"
        ? `Chapter ${c.num} "${c.title}": ${c.body.replace(/\s+/g, " ").slice(0, 100)}…`
        : `第${c.num}章《${c.title}》：${c.body.replace(/\s+/g, " ").slice(0, 100)}…`,
    )
    .join("\n");
  const tail = previousContent.slice(-LONG_NOVEL_PRODUCT.contextTailChars);
  const chapterBlock = formatChapterSliceForPrompt(chapterSlice.chapters, locale);
  const nums =
    locale === "en"
      ? chapterSlice.chapters.map((c) => c.num).join(", ")
      : chapterSlice.chapters.map((c) => c.num).join("、");

  const hasPrior = previousContent.trim().length > 0;
  const task =
    locale === "en"
      ? !hasPrior && segmentIndex === 0 && !isContinuation
        ? `Batch 1/${totalSegments} (${chapterSlice.phase}): write **only** chapter(s) ${nums}; open the story and introduce characters. Target ~${targetCharsThisSegment} characters.`
        : `Batch ${segmentIndex + 1}/${totalSegments} (${chapterSlice.phase}): write **only** chapter(s) ${nums}; ${hasPrior || isContinuation ? "continue smoothly from prior text; " : ""}do not repeat written beats. Target ~${targetCharsThisSegment} characters.`
      : !hasPrior && segmentIndex === 0 && !isContinuation
        ? `第 1/${totalSegments} 批（${chapterSlice.phase}）：**只写**第 ${nums} 章，完成开篇与人物登场。本批目标约 ${targetCharsThisSegment} 字。`
        : `第 ${segmentIndex + 1}/${totalSegments} 批（${chapterSlice.phase}）：**只写**第 ${nums} 章，${hasPrior || isContinuation ? "紧接前文续写，" : ""}不要重复已写情节。本批目标约 ${targetCharsThisSegment} 字。`;

  if (locale === "en") {
    return `[User concept] ${prompt.trim()}
${title?.trim() ? `[Suggested title] ${title.trim()}` : ""}

[Story bible]
${bibleText}

[Chapters to write in this batch]
${chapterBlock}

${recap ? `[Recent recap]\n${recap}\n` : ""}${tail ? `[Prior ending—continue naturally]\n…${tail}\n` : ""}
[Batch task] ${task}`;
  }

  return `【用户创意】${prompt.trim()}
${title?.trim() ? `【建议书名】${title.trim()}` : ""}

【设定圣经】
${bibleText}

【本批须完成的章节规划】
${chapterBlock}

${recap ? `【前文摘要（最近章节）】\n${recap}\n` : ""}${tail ? `【上一批末尾原文（请自然衔接）】\n…${tail}\n` : ""}
【本批任务】${task}`;
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
    chapterPlan = await fetchNovelChapterPlan(model, promptTrim, bible, plan, lengthTier);
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
  const slices = splitChapterPlanIntoSegments(chapterPlan, plan, (index, total) =>
    longNovelSegmentPhaseLabel(index, total, outputLocale),
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

  const { content } = await writeNovelSegmentSlices({
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

  const finalContent = fitNovelContentToMaxChars(content, hardMax);
  return { content: finalContent, pipelineMeta: baseMeta };
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
      : getNovelSystemPrompt("long", undefined, promptTrim);

    let segmentText = "";
    for await (const delta of llmNovelTextStream(
      {
        model,
        system,
        user: userMsg,
        temperature: 0.82,
        maxTokens: segmentMaxTokens,
        timeoutMs: segmentTimeout,
      },
      lengthTier,
    )) {
      segmentText += delta;
      emit({ step: "delta", text: delta, segment: i + 1 });
    }

    segmentText = segmentText.trim();
    if (!segmentText) {
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
        emit,
        segmentIndex: i + 1,
      });
      emit({ step: "polish_batch_done", index: i + 1, message: progressNovelMessage(uiLocale, "polishBatchDone", { index: i + 1 }) });
    }

    content = content ? `${content}\n\n${segmentText}` : segmentText;
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
