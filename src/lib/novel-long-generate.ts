import { llmNovelText } from "@/lib/llm";
import { llmNovelTextStream } from "@/lib/llm";
import { parseNovelChapters, truncateNovelToMaxChars } from "@/lib/novel-chapters";
import { novelMaxChars } from "@/lib/novel-length";
import { getNovelSystemPrompt } from "@/lib/novel-generate-config";
import { LONG_NOVEL_PRODUCT, planLongNovelSegments, type LongNovelSegmentPlan } from "@/lib/novel-long-config";
import { novelLengthConfig, type NovelLengthTier } from "@/lib/novel-length";

export type NovelStreamEmitter = (event: Record<string, unknown>) => void;

export { planLongNovelSegments, type LongNovelSegmentPlan };

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
1. **剧情连贯**：人物姓名、性格、关系、世界观必须与前文及大纲一致，禁止重启故事、禁止吃书、禁止重复已发生的关键情节。
2. **章节连续**：章节号必须从前文最后章节之后递增，格式「=== 第X章 标题 ===」，不要重复已写章节。
3. **只输出正文**：不要输出大纲、回顾、作者说明或 markdown 代码块。
4. **承上启下**：开头自然衔接上一段末尾情境，不要突兀转场。`;
}

export function buildLongNovelOutlineUserMessage(prompt: string, title: string | undefined, plan: LongNovelSegmentPlan): string {
  const cfg = novelLengthConfig("long");
  return `用户创意：${prompt.trim()}
${title?.trim() ? `建议书名：${title.trim()}` : ""}

请为一部目标 ${cfg.minChars}–${cfg.maxChars} 字的长篇网络小说输出**连载大纲**（纯文本，约 800–1500 字），供后续 ${plan.totalSegments} 次分段写作保持一致。必须包含：

【书名】（一句）
【主要人物】（至少 3 人：姓名 + 身份 + 性格关键词）
【核心矛盾】（2–4 句）
【情节脉络】（按 ${plan.totalSegments} 段划分，每段 2–3 句说明发生什么，含开端/发展/高潮/结局）
【结局方向】（1–3 句，避免烂尾）

不要写具体章节正文。`;
}

export function buildLongNovelSegmentUserMessage(opts: {
  prompt: string;
  title?: string;
  outline: string;
  segmentIndex: number;
  plan: LongNovelSegmentPlan;
  previousContent: string;
}): string {
  const { prompt, title, outline, segmentIndex, plan, previousContent } = opts;
  const phase = segmentPhaseLabel(segmentIndex, plan.totalSegments);
  const chapters = parseNovelChapters(previousContent);
  const nextChapter = chapters.length > 0 ? Math.max(...chapters.map((c) => c.num)) + 1 : 1;
  const recap = chapters
    .slice(-LONG_NOVEL_PRODUCT.contextRecapChapters)
    .map((c) => `第${c.num}章《${c.title}》：${c.body.replace(/\s+/g, " ").slice(0, 100)}…`)
    .join("\n");
  const tail = previousContent.slice(-LONG_NOVEL_PRODUCT.contextTailChars);

  if (segmentIndex === 0) {
    return `【用户创意】${prompt.trim()}
${title?.trim() ? `【建议书名】${title.trim()}` : ""}

【全书大纲】
${outline}

【本段任务】第 1/${plan.totalSegments} 段（${phase}）：写第 ${nextChapter} 章起，本段约 ${plan.charsPerSegment} 字，完成开篇与人物登场。全书目标约 ${plan.targetTotalChars} 字。`;
  }

  return `【用户创意】${prompt.trim()}

【全书大纲】
${outline}

【前文摘要（最近章节）】
${recap || "（首段已写）"}

【上一段末尾原文（请自然衔接）】
…${tail}

【本段任务】第 ${segmentIndex + 1}/${plan.totalSegments} 段（${phase}）：从第 ${nextChapter} 章继续，本段约 ${plan.charsPerSegment} 字。不要重复前文情节，推进主线 toward 大纲中的高潮与结局。`;
}

export async function fetchLongNovelOutline(
  model: string,
  prompt: string,
  title: string | undefined,
  plan: LongNovelSegmentPlan,
  lengthTier: NovelLengthTier,
): Promise<string | null> {
  const result = await llmNovelText(
    {
      model,
      system: getNovelSystemPrompt("long"),
      user: buildLongNovelOutlineUserMessage(prompt, title, plan),
      temperature: 0.7,
      maxTokens: LONG_NOVEL_PRODUCT.outlineMaxTokens,
      timeoutMs: LONG_NOVEL_PRODUCT.outlineTimeoutMs,
    },
    lengthTier,
  );
  if (!result.ok || !result.text.trim()) return null;
  return result.text.trim();
}

/** 长篇：分段流式生成，通过 emit 推送 delta / segment 事件。 */
export async function streamLongNovelBody(params: {
  model: string;
  promptTrim: string;
  titleTrim?: string;
  plan: LongNovelSegmentPlan;
  lengthTier: NovelLengthTier;
  emit: NovelStreamEmitter;
}): Promise<string> {
  const { model, promptTrim, titleTrim, plan, lengthTier, emit } = params;

  emit({ step: "outline_start", message: "正在生成全书大纲以锁定人物与剧情…" });
  const outline =
    (await fetchLongNovelOutline(model, promptTrim, titleTrim, plan, lengthTier)) ??
    `【书名】${titleTrim ?? "未命名"}\n【主线】${promptTrim}\n【分段】共 ${plan.totalSegments} 段连载完成`;
  emit({ step: "outline_ready", message: "大纲完成，开始分段续写…" });

  let content = "";
  const segmentTimeout = LONG_NOVEL_PRODUCT.segmentTimeoutMs;
  const segmentMaxTokens = LONG_NOVEL_PRODUCT.segmentMaxTokens;

  for (let i = 0; i < plan.totalSegments; i++) {
    const phase = segmentPhaseLabel(i, plan.totalSegments);
    emit({
      step: "segment_start",
      index: i + 1,
      total: plan.totalSegments,
      label: phase,
      message: `第 ${i + 1}/${plan.totalSegments} 段（${phase}）生成中…`,
    });

    const userMsg = buildLongNovelSegmentUserMessage({
      prompt: promptTrim,
      title: titleTrim,
      outline,
      segmentIndex: i,
      plan,
      previousContent: content,
    });
    const system = i === 0 ? getNovelSystemPrompt("long") : getNovelContinuationSystemPrompt();

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
      throw new Error(`第 ${i + 1} 段未返回正文`);
    }

    content = content ? `${content}\n\n${segmentText}` : segmentText;
    emit({
      step: "segment_done",
      index: i + 1,
      total: plan.totalSegments,
      length: content.length,
      target: plan.targetTotalChars,
    });

    const hardMax = novelMaxChars(lengthTier);
    if (content.length >= plan.targetTotalChars || content.length >= hardMax) break;
  }

  return truncateNovelToMaxChars(content, novelMaxChars(lengthTier));
}

/** 长篇：非流式分段生成（供 POST /api/novel/generate）。 */
export async function generateLongNovelBody(
  params: Omit<Parameters<typeof streamLongNovelBody>[0], "emit">,
): Promise<string> {
  return streamLongNovelBody({ ...params, emit: () => {} });
}
