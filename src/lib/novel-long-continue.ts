import { parseNovelChapters, truncateNovelToMaxChars } from "@/lib/novel-chapters";
import { novelMaxChars, parseNovelLengthTier, type NovelLengthTier } from "@/lib/novel-length";
import { fetchNovelBible, formatNovelBibleForPrompt } from "@/lib/novel-long-bible";
import {
  fetchExtendedChapterPlan,
  fetchNovelChapterPlan,
  getRemainingChapterPlan,
  splitChapterPlanIntoSegments,
  type ChapterPlanItem,
} from "@/lib/novel-long-chapter-plan";
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
}): NovelContinuationAssessment {
  const tier = parseNovelLengthTier(opts.lengthTier);
  const hardMax = novelMaxChars("long");
  const charsRemaining = Math.max(0, hardMax - opts.content.length);

  if (tier !== "long") {
    return { canContinue: false, reason: "仅长篇支持 AI 续写", remainingChapterCount: 0, charsRemaining };
  }
  if (charsRemaining < 500) {
    return { canContinue: false, reason: "已达长篇字数上限", remainingChapterCount: 0, charsRemaining };
  }

  if (opts.meta) {
    const remaining = getRemainingChapterPlan(opts.meta.chapterPlan, opts.content);
    if (remaining.length > 0) {
      return {
        canContinue: true,
        reason: `尚有 ${remaining.length} 章未完成，可继续写作`,
        remainingChapterCount: remaining.length,
        charsRemaining,
      };
    }
    return {
      canContinue: true,
      reason: "原章规划已写完，可续写新章节",
      remainingChapterCount: 0,
      charsRemaining,
    };
  }

  return {
    canContinue: true,
    reason: "将根据正文与创意恢复设定后续写",
    remainingChapterCount: -1,
    charsRemaining,
  };
}

function recentChapterRecap(content: string, maxChars = 600): string {
  const chapters = parseNovelChapters(content);
  if (chapters.length === 0) return content.slice(-maxChars);
  return chapters
    .slice(-3)
    .map((c) => `第${c.num}章《${c.title}》：${c.body.replace(/\s+/g, " ").slice(0, 120)}…`)
    .join("\n")
    .slice(0, maxChars);
}

function segmentPhaseLabel(index: number, total: number): string {
  if (index === 0) return "续写开篇";
  if (index === total - 1) return "续写收束";
  if (index === total - 2 && total > 2) return "续写高潮";
  return "续写推进";
}

/** 长篇续写：基于 generationMetaJson + 已有正文，写剩余或新增章节。 */
export async function streamLongNovelContinue(params: {
  model: string;
  promptTrim: string;
  titleTrim: string;
  existingContent: string;
  meta: NovelGenerationMeta | null;
  lengthTier: NovelLengthTier;
  emit: NovelStreamEmitter;
  /** 本次最多写几章；null = 写完所有待写章 */
  maxChaptersToWrite?: number | null;
  polish?: boolean;
}): Promise<LongNovelGenerateResult> {
  const { model, promptTrim, titleTrim, existingContent, lengthTier, emit } = params;
  const polish = params.polish ?? LONG_NOVEL_PRODUCT.polishAfterSegment;
  const maxChaptersToWrite = params.maxChaptersToWrite;
  let meta = params.meta;
  const content = existingContent.trim();
  const hardMax = novelMaxChars(lengthTier);
  const basePlan = planLongNovelSegments(lengthTier);

  emit({ step: "continue_start", message: "正在准备长篇续写…" });

  if (!meta) {
    emit({ step: "bible_start", message: "未找到流水线存档，正在恢复设定圣经…" });
    const bible = await fetchNovelBible(model, promptTrim, titleTrim, basePlan, lengthTier);
    emit({ step: "bible_ready", message: `设定恢复完成：《${bible.title}》` });
    emit({ step: "chapter_plan_start", message: "正在根据已有正文规划后续章节…" });
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
        recentChapterRecap(content),
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
      message: `后续 ${newChapters.length} 章已规划，开始续写…`,
      chapterCount: newChapters.length,
    });
  }

  const bible = meta.bible;
  const bibleText = formatNovelBibleForPrompt(bible);

  let remaining = getRemainingChapterPlan(meta.chapterPlan, content);
  if (remaining.length === 0) {
    emit({ step: "chapter_plan_start", message: "原规划章节已全部写完，正在规划新章节…" });
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
      recentChapterRecap(content),
      lengthTier,
    );
    meta = {
      ...meta,
      chapterPlan: { chapters: [...meta.chapterPlan.chapters, ...newChapters] },
    };
    remaining = newChapters;
    emit({
      step: "chapter_plan_ready",
      message: `已追加 ${newChapters.length} 章规划`,
      chapterCount: remaining.length,
    });
  }

  if (remaining.length === 0) {
    throw new Error("无可续写章节且无法追加规划");
  }

  const chapterLimit = clampContinueChapterCount(maxChaptersToWrite, remaining.length);
  if (chapterLimit != null && chapterLimit < remaining.length) {
    remaining = remaining.slice(0, chapterLimit);
    emit({
      step: "continue_limit",
      message: `本次续写 ${remaining.length} 章（已按你的设置限制）`,
      maxChapters: remaining.length,
    });
  }

  const slices = splitChapterPlanIntoSegments(
    { chapters: remaining },
    basePlan,
    segmentPhaseLabel,
    { maxSegmentCap: LONG_NOVEL_PRODUCT.maxSegments },
  );

  emit({
    step: "continue_ready",
    message: `将分 ${slices.length} 批续写 ${remaining.length} 章（剩余篇幅约 ${(hardMax - content.length).toLocaleString()} 字）`,
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
    stopWhenLength: hardMax,
  });

  const finalContent = truncateNovelToMaxChars(writeResult.content, hardMax);

  return {
    content: finalContent,
    pipelineMeta: {
      ...meta,
      segmentCount: (meta.segmentCount ?? 0) + slices.length,
      createdAt: meta.createdAt,
    },
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
