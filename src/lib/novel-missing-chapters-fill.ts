import type { AppLocale } from "@/i18n/routing";
import { progressNovelMessage } from "@/lib/i18n/progress-message";
import {
  fitNovelContentToMaxChars,
  mergeNovelChapterContents,
  normalizeSegmentToChapterPlan,
  parseNovelChapters,
} from "@/lib/novel-chapters";
import { formatNovelBibleForPrompt } from "@/lib/novel-long-bible";
import {
  getRemainingChapterPlan,
  splitChapterPlanIntoSegments,
} from "@/lib/novel-long-chapter-plan";
import { LONG_NOVEL_PRODUCT, planLongNovelSegments } from "@/lib/novel-long-config";
import type { ChapterPlanItem, NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import {
  buildLongNovelSegmentUserMessage,
  getNovelContinuationSystemPrompt,
  type NovelStreamEmitter,
} from "@/lib/novel-long-generate";
import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";
import { getNovelSystemPrompt } from "@/lib/novel-generate-config";
import { formatNovelChapterMarkerHead } from "@/lib/novel-locale-prompts";
import { llmNovelText } from "@/lib/llm";
import { novelMaxChars, type NovelLengthOptions, type NovelLengthTier } from "@/lib/novel-length";

const MAX_FILL_ROUNDS = 5;

function finalizeFilledContent(
  merged: string,
  hardMax: number,
  chapterPlan: NovelGenerationMeta["chapterPlan"],
): string {
  const remaining = getRemainingChapterPlan(chapterPlan, merged);
  if (remaining.length > 0) return merged.trim();
  return fitNovelContentToMaxChars(merged, hardMax);
}

function extractFilledChapterBody(
  text: string,
  plan: ChapterPlanItem,
  locale: ReturnType<typeof resolveNovelOutputLocale>,
): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const parsed = parseNovelChapters(trimmed);
  const exact = parsed.find((c) => c.num === plan.num);
  if (exact?.body.trim()) return exact.body.trim();
  const last = parsed.at(-1);
  if (last && last.num === plan.num && last.body.trim()) return last.body.trim();
  const withoutHead = trimmed.replace(/^===\s*(?:Chapter\s*\d+|第\s*\d+\s*章).+===\s*/im, "").trim();
  return withoutHead || trimmed;
}

function ensurePlannedChapterBlock(text: string, plan: ChapterPlanItem, locale: ReturnType<typeof resolveNovelOutputLocale>): string {
  const body = extractFilledChapterBody(text, plan, locale);
  if (!body) return "";
  const parsed = parseNovelChapters(text);
  if (parsed.some((c) => c.num === plan.num && c.body.trim().length > 20)) {
    return `${formatNovelChapterMarkerHead(plan.num, plan.title, locale)}\n\n${body}`;
  }
  const title = plan.title.trim() || body.slice(0, 12);
  return `${formatNovelChapterMarkerHead(plan.num, title, locale)}\n\n${body}`;
}

async function writeOneMissingChapter(params: {
  model: string;
  promptTrim: string;
  titleTrim?: string;
  content: string;
  chapter: ChapterPlanItem;
  pipelineMeta: NovelGenerationMeta;
  lengthTier: NovelLengthTier;
  hardMax: number;
  uiLocale: AppLocale;
  emit: NovelStreamEmitter;
}): Promise<string> {
  const { chapter, pipelineMeta, lengthTier, hardMax, uiLocale, emit } = params;
  const outputLocale = resolveNovelOutputLocale(params.promptTrim);
  let content = params.content;
  const written = parseNovelChapters(content);
  const minWritten = written.length > 0 ? Math.min(...written.map((c) => c.num)) : Number.POSITIVE_INFINITY;
  const isEarly = chapter.num < minWritten;
  const previousContent = isEarly ? "" : content.trim();
  const bibleText = formatNovelBibleForPrompt(pipelineMeta.bible);
  const basePlan = planLongNovelSegments(lengthTier);
  const slice = splitChapterPlanIntoSegments(
    { chapters: [chapter] },
    basePlan,
    () => "fill",
    { maxSegmentCap: 1 },
  )[0]!;
  const targetChars = chapter.targetChars ?? LONG_NOVEL_PRODUCT.avgCharsPerChapter;

  emit({
    step: "missing_chapter_write",
    chapter: chapter.num,
    message: progressNovelMessage(uiLocale, "missingChapterWrite", { num: chapter.num, title: chapter.title }),
  });

  const userMsg = buildLongNovelSegmentUserMessage({
    prompt: params.promptTrim,
    title: params.titleTrim,
    bibleText,
    chapterSlice: slice,
    segmentIndex: 0,
    totalSegments: 1,
    previousContent,
    targetCharsThisSegment: targetChars,
    isContinuation: !isEarly,
    locale: outputLocale,
  });
  const system = isEarly
    ? getNovelSystemPrompt(lengthTier, undefined, params.promptTrim)
    : getNovelContinuationSystemPrompt(outputLocale);

  for (let attempt = 1; attempt <= 5; attempt++) {
    const result = await llmNovelText(
      {
        model: params.model,
        system,
        user: userMsg,
        temperature: attempt === 1 ? 0.82 : 0.75,
        maxTokens: Math.min(LONG_NOVEL_PRODUCT.segmentMaxTokens, Math.ceil(targetChars * 1.6)),
        timeoutMs: LONG_NOVEL_PRODUCT.segmentTimeoutMs,
      },
      lengthTier,
    );

    if (!result.ok || !result.text.trim()) continue;
    const block = normalizeSegmentToChapterPlan(result.text, [chapter], outputLocale);
    if (!block) continue;
    const merged = mergeNovelChapterContents(content, block, outputLocale);
    const written = parseNovelChapters(merged).find((c) => c.num === chapter.num);
    if (written && written.body.trim().length > 20) {
      return merged;
    }
    content = merged;
  }

  return content;
}

/** 按章提纲补写缺失章节（中/长篇生成后完整性门禁前的修复 pass）。 */
export async function fillMissingPlannedNovelChapters(params: {
  model: string;
  promptTrim: string;
  titleTrim?: string;
  content: string;
  lengthTier: NovelLengthTier;
  lengthOpts?: NovelLengthOptions;
  pipelineMeta?: NovelGenerationMeta | null;
  uiLocale?: AppLocale;
  emit?: NovelStreamEmitter;
}): Promise<string> {
  const {
    model,
    promptTrim,
    titleTrim,
    content,
    lengthTier,
    lengthOpts,
    pipelineMeta,
    uiLocale = "zh-Hans",
    emit = () => {},
  } = params;

  if (!pipelineMeta?.chapterPlan?.chapters?.length) return content;

  const hardMax = novelMaxChars(lengthTier, lengthOpts);
  let merged = content.trim();

  for (let round = 0; round < MAX_FILL_ROUNDS; round++) {
    const remaining = getRemainingChapterPlan(pipelineMeta.chapterPlan, merged);
    if (remaining.length === 0) break;

    emit({
      step: "missing_chapters_fill",
      message: progressNovelMessage(uiLocale, "missingChaptersFill", {
        count: remaining.length,
        nums: remaining.map((c) => c.num).join(uiLocale.startsWith("zh") ? "、" : ", "),
      }),
      remainingChapters: remaining.map((c) => c.num),
      round: round + 1,
    });

    for (const chapter of remaining) {
      merged = await writeOneMissingChapter({
        model,
        promptTrim,
        titleTrim,
        content: merged,
        chapter,
        pipelineMeta,
        lengthTier,
        hardMax,
        uiLocale,
        emit,
      });
    }
  }

  return finalizeFilledContent(merged, hardMax, pipelineMeta.chapterPlan);
}
