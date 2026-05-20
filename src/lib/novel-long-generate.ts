import { llmNovelTextStream } from "@/lib/llm";
import { parseNovelChapters, truncateNovelToMaxChars } from "@/lib/novel-chapters";
import { getNovelSystemPrompt } from "@/lib/novel-generate-config";
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
import type { NovelBible, NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
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

function segmentPhaseLabel(index: number, total: number): string {
  if (index === 0) return "开篇";
  if (index === total - 1) return "收束结局";
  if (index === total - 2 && total > 3) return "高潮";
  if (index === 1) return "发展";
  return "推进";
}

export function getNovelContinuationSystemPrompt(): string {
  return `你是一位擅长中文长篇网络小说的 AI 作家，正在**续写**一部已在连载中的作品。

硬性要求：
1. **剧情连贯**：人物姓名、性格、关系、世界观必须与前文、设定圣经及章规划一致，禁止重启故事、禁止吃书、禁止重复已发生的关键情节。
2. **章节连续**：章节号必须从前文最后章节之后递增，格式「=== 第X章 标题 ===」，不要重复已写章节。
3. **只写本批章节**：严格按用户给出的章规划列表写作，不要跳章、不要合并计划外的章。
4. **只输出正文**：不要输出大纲、回顾、作者说明或 markdown 代码块。
5. **承上启下**：开头自然衔接上一段末尾情境，不要突兀转场。`;
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
  } = opts;
  const chapters = parseNovelChapters(previousContent);
  const recap = chapters
    .slice(-LONG_NOVEL_PRODUCT.contextRecapChapters)
    .map((c) => `第${c.num}章《${c.title}》：${c.body.replace(/\s+/g, " ").slice(0, 100)}…`)
    .join("\n");
  const tail = previousContent.slice(-LONG_NOVEL_PRODUCT.contextTailChars);
  const chapterBlock = formatChapterSliceForPrompt(chapterSlice.chapters);
  const nums = chapterSlice.chapters.map((c) => c.num).join("、");

  const hasPrior = previousContent.trim().length > 0;
  const task =
    !hasPrior && segmentIndex === 0 && !isContinuation
      ? `第 1/${totalSegments} 批（${chapterSlice.phase}）：**只写**第 ${nums} 章，完成开篇与人物登场。本批目标约 ${targetCharsThisSegment} 字。`
      : `第 ${segmentIndex + 1}/${totalSegments} 批（${chapterSlice.phase}）：**只写**第 ${nums} 章，${hasPrior || isContinuation ? "紧接前文续写，" : ""}不要重复已写情节。本批目标约 ${targetCharsThisSegment} 字。`;

  return `【用户创意】${prompt.trim()}
${title?.trim() ? `【建议书名】${title.trim()}` : ""}

【设定圣经】
${bibleText}

【本批须完成的章节规划】
${chapterBlock}

${recap ? `【前文摘要（最近章节）】\n${recap}\n` : ""}${tail ? `【上一批末尾原文（请自然衔接）】\n…${tail}\n` : ""}
【本批任务】${task}`;
}

/** 长篇：流水线流式生成（设定圣经 → 章规划 → 按章分批写作 → 一致性校验）。 */
export async function streamLongNovelBody(params: {
  model: string;
  promptTrim: string;
  titleTrim?: string;
  plan: LongNovelSegmentPlan;
  lengthTier: NovelLengthTier;
  emit: NovelStreamEmitter;
  polish?: boolean;
}): Promise<LongNovelGenerateResult> {
  const { model, promptTrim, titleTrim, plan, lengthTier, emit } = params;
  const polish = params.polish ?? LONG_NOVEL_PRODUCT.polishAfterSegment;

  emit({ step: "bible_start", message: "正在生成世界观与人物设定（设定圣经）…" });
  const bible = await fetchNovelBible(model, promptTrim, titleTrim, plan, lengthTier);
  const bibleText = formatNovelBibleForPrompt(bible);
  emit({ step: "bible_ready", message: `设定完成：《${bible.title}》，${bible.characters.length} 位主要角色` });

  emit({ step: "chapter_plan_start", message: "正在规划全书分章要点…" });
  const chapterPlan = await fetchNovelChapterPlan(model, promptTrim, bible, plan, lengthTier);
  emit({
    step: "chapter_plan_ready",
    message: `章规划完成，共 ${chapterPlan.chapters.length} 章，开始分批写作…`,
    chapterCount: chapterPlan.chapters.length,
  });

  const slices = splitChapterPlanIntoSegments(chapterPlan, plan, segmentPhaseLabel);
  const hardMax = novelMaxChars(lengthTier);

  const { content } = await writeNovelSegmentSlices({
    model,
    promptTrim,
    titleTrim,
    bibleText,
    bible,
    slices,
    previousContent: "",
    lengthTier,
    isContinuation: false,
    polish,
    emit,
    stopWhenLength: Math.min(plan.targetTotalChars, hardMax),
  });

  const finalContent = truncateNovelToMaxChars(content, hardMax);
  const pipelineMeta: NovelGenerationMeta = {
    version: NOVEL_PIPELINE_VERSION,
    bible,
    chapterPlan,
    segmentCount: slices.length,
    createdAt: new Date().toISOString(),
  };

  return { content: finalContent, pipelineMeta };
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
  emit: NovelStreamEmitter;
  stopWhenLength: number;
  polish?: boolean;
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
  const polish = params.polish ?? LONG_NOVEL_PRODUCT.polishAfterSegment;

  let content = previousContent.trim();
  const totalSegments = slices.length;
  const segmentTimeout = LONG_NOVEL_PRODUCT.segmentTimeoutMs;
  const segmentMaxTokens = LONG_NOVEL_PRODUCT.segmentMaxTokens;
  const hardMax = novelMaxChars(lengthTier);

  for (let i = 0; i < slices.length; i++) {
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
      message: `第 ${i + 1}/${totalSegments} 批（${slice.phase}）· 第 ${slice.chapters.map((c) => c.num).join("、")} 章…`,
    });

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
    });
    const useContinuationSystem =
      isContinuation || content.length > 0 || i > 0;
    const system = useContinuationSystem
      ? getNovelContinuationSystemPrompt()
      : getNovelSystemPrompt("long");

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
      throw new Error(`第 ${i + 1} 批未返回正文`);
    }

    emit({ step: "consistency_start", message: `第 ${i + 1} 批一致性检查…` });
    const report = checkSegmentConsistency({
      bible,
      expectedChapters: slice.chapters,
      segmentText,
      previousContent: content,
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
      emit({ step: "consistency_ok", index: i + 1, message: "本批章节结构正常" });
    }

    if (polish) {
      emit({ step: "polish_batch_start", index: i + 1, message: `第 ${i + 1} 批润色中…` });
      segmentText = await polishNovelSegmentText({
        segmentText,
        bible,
        model,
        lengthTier,
        emit,
        segmentIndex: i + 1,
      });
      emit({ step: "polish_batch_done", index: i + 1, message: `第 ${i + 1} 批润色完成` });
    }

    content = content ? `${content}\n\n${segmentText}` : segmentText;
    emit({
      step: "segment_done",
      index: i + 1,
      total: totalSegments,
      length: content.length,
      target: stopWhenLength,
    });

    if (content.length >= stopWhenLength || content.length >= hardMax) break;
  }

  return { content };
}

/** 长篇：非流式（供 POST /api/novel/generate）。 */
export async function generateLongNovelBody(
  params: Omit<Parameters<typeof streamLongNovelBody>[0], "emit">,
): Promise<LongNovelGenerateResult> {
  return streamLongNovelBody({ ...params, emit: () => {} });
}
