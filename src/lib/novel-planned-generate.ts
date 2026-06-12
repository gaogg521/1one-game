import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";
import { llmNovelText, llmNovelTextStream } from "@/lib/llm";
import { fitNovelContentToMaxChars } from "@/lib/novel-chapters";
import {
  getNovelSystemPrompt,
  novelLlmMaxOutputTokens,
  novelLlmTemperature,
  novelLlmTimeoutMs,
  novelMinAcceptChars,
} from "@/lib/novel-generate-config";
import type { NovelLengthOptions, NovelLengthTier } from "@/lib/novel-length";
import { fetchNovelBible } from "@/lib/novel-long-bible";
import {
  fetchNovelChapterPlan,
  formatChapterSliceForPrompt,
} from "@/lib/novel-long-chapter-plan";
import type { LongNovelSegmentPlan } from "@/lib/novel-long-config";
import type { NovelChapterPlan, NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import { NOVEL_PIPELINE_VERSION } from "@/lib/novel-long-pipeline-types";
import {
  allocateChapterTargetChars,
  planNovelScope,
  type NovelScopePlan,
} from "@/lib/novel-scope-plan";
import type { NovelStreamEmitter } from "@/lib/novel-long-generate";
import type { AppLocale } from "@/i18n/routing";
import { progressNovelMessage } from "@/lib/i18n/progress-message";

function scopeToSegmentPlan(scope: NovelScopePlan): LongNovelSegmentPlan {
  return {
    totalSegments: 1,
    charsPerSegment: scope.targetTotalChars,
    targetTotalChars: scope.targetTotalChars,
    minAcceptChars: novelMinAcceptChars(scope.tier),
  };
}

function buildPlannedNovelWriteUserMessage(opts: {
  prompt: string;
  title?: string;
  scope: NovelScopePlan;
  chapterPlan: NovelChapterPlan;
  locale: ReturnType<typeof resolveNovelOutputLocale>;
}): string {
  const { prompt, title, scope, chapterPlan, locale } = opts;
  const planBlock = formatChapterSliceForPrompt(chapterPlan.chapters, locale);
  const totalBudget = chapterPlan.chapters.reduce((s, c) => s + (c.targetChars ?? 0), 0);

  if (locale === "en") {
    return `[User concept]
${prompt.trim()}
${title?.trim() ? `\n[Suggested title] ${title.trim()}` : ""}

[Length tier] ${scope.tier} — write the **complete** novel within ${scope.minChars}–${scope.maxChars} characters (target ~${totalBudget}).

[Chapter outline — write every chapter below, in order, with resolution in the final chapter]
${planBlock}

Requirements:
1. Follow the outline beats; do not add unplanned chapters.
2. Allocate length roughly per targetChars; the last chapter must resolve the main conflict.
3. Use the chapter marker format from the system prompt.
4. Output prose only — no meta commentary.`;
  }

  return `【用户创意】
${prompt.trim()}
${title?.trim() ? `\n【建议书名】${title.trim()}` : ""}

【篇幅档位】${scope.tier} — 在 ${scope.minChars}–${scope.maxChars} 字内写完**整部**小说（目标约 ${totalBudget} 字）。

【章节目录提纲 — 按顺序写完下列每一章，最后一章必须收束结局】
${planBlock}

要求：
1. 严格按提纲推进，不要擅自增加规划外章节。
2. 各章字数大致按 targetChars 分配，末章留出高潮与结局。
3. 使用系统提示中的章节分隔格式。
4. 只输出正文，不要解释或元信息。`;
}

export type PlannedNovelGenerateResult = {
  content: string;
  pipelineMeta: NovelGenerationMeta;
};

/** 短篇 / 中篇：设定圣经 → 章提纲 → 按提纲一次写完（不中途截断）。 */
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
  const locale = resolveNovelOutputLocale(promptTrim);

  emit({ step: "bible_start", message: progressNovelMessage(uiLocale, "bibleStart") });
  const bible = await fetchNovelBible(model, promptTrim, titleTrim, segmentPlan, lengthTier);
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

  const userMsg = buildPlannedNovelWriteUserMessage({
    prompt: promptTrim,
    title: titleTrim,
    scope,
    chapterPlan,
    locale,
  });
  const system = getNovelSystemPrompt(lengthTier, lengthOpts, promptTrim);

  let content = "";
  const llmReq = {
    model,
    system,
    user: userMsg,
    temperature: novelLlmTemperature(lengthTier),
    maxTokens: novelLlmMaxOutputTokens(lengthTier, lengthOpts),
    timeoutMs: novelLlmTimeoutMs(lengthTier),
  };

  // 短篇一次写完：非流式更稳（部分网关对流式连接超时更严）
  if (lengthTier === "short") {
    const result = await llmNovelText(llmReq, lengthTier);
    if (!result.ok || !result.text.trim()) {
      throw new Error(
        result.ok
          ? progressNovelMessage(uiLocale, "plannedShortFailed")
          : result.error || progressNovelMessage(uiLocale, "generateFailed"),
      );
    }
    content = result.text;
    const chunk = 120;
    for (let i = 0; i < content.length; i += chunk) {
      emit({ step: "delta", text: content.slice(i, i + chunk) });
    }
  } else {
    for await (const delta of llmNovelTextStream(llmReq, lengthTier)) {
      content += delta;
      emit({ step: "delta", text: delta });
    }
  }

  content = fitNovelContentToMaxChars(content.trim(), scope.maxChars);
  const pipelineMeta: NovelGenerationMeta = {
    version: NOVEL_PIPELINE_VERSION,
    bible,
    chapterPlan,
    segmentCount: 1,
    createdAt: new Date().toISOString(),
  };

  return { content, pipelineMeta };
}

/** 非流式 POST 入口 */
export async function generatePlannedNovelBody(
  params: Omit<Parameters<typeof streamPlannedNovelBody>[0], "emit">,
): Promise<PlannedNovelGenerateResult> {
  return streamPlannedNovelBody({ ...params, emit: () => {} });
}
