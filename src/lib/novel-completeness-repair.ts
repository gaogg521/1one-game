import type { AppLocale } from "@/i18n/routing";
import { progressNovelMessage } from "@/lib/i18n/progress-message";
import { parseChildrenStoryOutput } from "@/lib/children-story-output";
import {
  assessNovelCompleteness,
  type NovelCompletenessReport,
} from "@/lib/novel-completeness";
import { extendNovelToEnding } from "@/lib/novel-completion-pass";
import {
  buildNovelUserMessage,
  getNovelSystemPrompt,
  novelLlmMaxOutputTokens,
  novelLlmTemperature,
  novelLlmTimeoutMs,
  novelMinAcceptChars,
} from "@/lib/novel-generate-config";
import { llmNovelText } from "@/lib/llm";
import { getRemainingChapterPlan } from "@/lib/novel-long-chapter-plan";
import type { NovelStreamEmitter } from "@/lib/novel-long-generate";
import { fillMissingPlannedNovelChapters } from "@/lib/novel-missing-chapters-fill";
import type { NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import { isChildrenNovelTier, parseChildrenTargetAge, type NovelLengthOptions, type NovelLengthTier } from "@/lib/novel-length";

export type NovelCompletenessRepairResult = {
  content: string;
  completeness: NovelCompletenessReport;
};

/** 提纲作品：缺章补写 → 补结局 → 再补写（与 API / 回归共用）。 */
export async function repairPlannedNovelCompleteness(params: {
  model: string;
  promptTrim: string;
  titleTrim?: string;
  content: string;
  lengthTier: NovelLengthTier;
  lengthOpts?: NovelLengthOptions;
  pipelineMeta?: NovelGenerationMeta | null;
  uiLocale?: AppLocale;
  emit?: NovelStreamEmitter;
}): Promise<NovelCompletenessRepairResult> {
  const {
    model,
    promptTrim,
    titleTrim,
    lengthTier,
    lengthOpts,
    pipelineMeta,
    uiLocale = "zh-Hans",
    emit = () => {},
  } = params;
  let content = params.content.trim();
  const title = titleTrim?.trim() || promptTrim.slice(0, 24);

  // M3 修复：全局填充轮次计数器上限，防止极端情况触发 11+ 轮 LLM 调用
  const MAX_GLOBAL_FILL_ROUNDS = 5;
  let globalFillRounds = 0;

  let completeness = assessNovelCompleteness(
    content,
    lengthTier,
    lengthOpts,
    promptTrim,
    pipelineMeta?.chapterPlan,
    uiLocale,
  );

  const runFill = async (label: string) => {
    if (!pipelineMeta?.chapterPlan) return;
    if (globalFillRounds >= MAX_GLOBAL_FILL_ROUNDS) {
      emit({
        step: "fill_rounds_exhausted",
        message: progressNovelMessage(uiLocale, "missingChaptersFill", { count: 0, nums: "" }),
        round: label,
      });
      return;
    }
    const remaining = getRemainingChapterPlan(pipelineMeta.chapterPlan, content);
    if (remaining.length === 0) return;
    globalFillRounds += 1;
    emit({
      step: "missing_chapters_fill",
      message: progressNovelMessage(uiLocale, "missingChaptersFill", {
        count: remaining.length,
        nums: remaining.map((c) => c.num).join(uiLocale.startsWith("zh") ? "、" : ", "),
      }),
      remainingChapters: remaining.map((c) => c.num),
      round: label,
      globalFillRounds,
    });
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
  };

  if (pipelineMeta?.chapterPlan) {
    for (let round = 1; round <= 3 && globalFillRounds < MAX_GLOBAL_FILL_ROUNDS; round++) {
      const remainingBefore = getRemainingChapterPlan(pipelineMeta.chapterPlan, content);
      if (remainingBefore.length === 0) break;
      await runFill(String(round));
      completeness = assessNovelCompleteness(
        content,
        lengthTier,
        lengthOpts,
        promptTrim,
        pipelineMeta.chapterPlan,
        uiLocale,
      );
      if (completeness.ok) break;
      const remainingAfter = getRemainingChapterPlan(pipelineMeta.chapterPlan, content);
      if (remainingAfter.length >= remainingBefore.length) break;
    }
  }

  const stillMissing = pipelineMeta?.chapterPlan
    ? getRemainingChapterPlan(pipelineMeta.chapterPlan, content).length
    : 0;

  if (!completeness.ok && stillMissing === 0 && globalFillRounds < MAX_GLOBAL_FILL_ROUNDS) {
    emit({
      step: "completion_pass",
      message: progressNovelMessage(uiLocale, "completionPass", { reason: completeness.reason }),
    });
    content = await extendNovelToEnding({
      model,
      title,
      prompt: promptTrim,
      content,
      lengthTier,
      lengthOpts,
    });
    await runFill("after_completion");
    completeness = assessNovelCompleteness(
      content,
      lengthTier,
      lengthOpts,
      promptTrim,
      pipelineMeta?.chapterPlan,
      uiLocale,
    );
  }

  return { content, completeness };
}

/** 儿童档：与线上一致，用儿童 system prompt 非流式生成；过短则续写一次。 */
export async function generateChildrenNovelRaw(params: {
  model: string;
  promptTrim: string;
  titleTrim?: string;
  lengthOpts?: NovelLengthOptions;
  uiLocale?: AppLocale;
  emit?: NovelStreamEmitter;
}): Promise<string> {
  const { model, promptTrim, titleTrim, lengthOpts, uiLocale = "zh-Hans", emit = () => {} } = params;
  const lengthTier: NovelLengthTier = "children";
  const userMsg = buildNovelUserMessage(promptTrim, titleTrim, lengthTier, promptTrim, lengthOpts);
  const system = getNovelSystemPrompt(lengthTier, lengthOpts, promptTrim);
  const minAccept = novelMinAcceptChars(lengthTier, lengthOpts);
  const age = parseChildrenTargetAge(lengthOpts?.childrenTargetAge ?? 7);

  const llmReq = {
    model,
    system,
    user: userMsg,
    temperature: novelLlmTemperature(lengthTier),
    maxTokens: novelLlmMaxOutputTokens(lengthTier, lengthOpts),
    timeoutMs: novelLlmTimeoutMs(lengthTier),
  };

  let content = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt === 0) {
      const result = await llmNovelText(llmReq, lengthTier);
      if (!result.ok || !result.text.trim()) {
        throw new Error(
          result.ok
            ? progressNovelMessage(uiLocale, "generateFailed")
            : result.error || progressNovelMessage(uiLocale, "generateFailed"),
        );
      }
      content = result.text.trim();
    } else {
      emit({ step: "children_expand", message: "儿童正文偏短，正在续写补全…" });
      const expanded = await extendNovelToEnding({
        model,
        title: titleTrim?.trim() || promptTrim.slice(0, 24),
        prompt: promptTrim,
        content,
        lengthTier,
        lengthOpts,
      });
      if (expanded.length <= content.length) break;
      content = expanded;
    }

    const chunk = 120;
    for (let i = 0; i < content.length; i += chunk) {
      emit({ step: "delta", text: content.slice(i, i + chunk) });
    }

    const bodyLen = parseChildrenStoryOutput(content, age, uiLocale).body.trim().length;
    if (bodyLen >= minAccept) break;
  }

  return content;
}

export function childrenTierUsesPlannedPipeline(tier: NovelLengthTier): boolean {
  return tier === "short" || tier === "medium";
}

export function isPlannedNovelTier(tier: NovelLengthTier): boolean {
  return tier === "short" || tier === "medium" || tier === "long";
}
