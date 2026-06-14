import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { resolveNovelOutputLocale } from "@/lib/creative-brief/detect-input-locale";
import { parseNovelChapters, serializeNovelChapters } from "@/lib/novel-chapters";
import { llmNovelText } from "@/lib/llm";
import { LONG_NOVEL_PRODUCT } from "@/lib/novel-long-config";
import type { NovelLengthTier } from "@/lib/novel-length";
import { formatNovelBibleForPrompt } from "@/lib/novel-long-bible";
import type { NovelBible } from "@/lib/novel-long-pipeline-types";
import type { NovelStreamEmitter } from "@/lib/novel-long-generate";
import {
  buildLongNovelPolishUserMessage,
  getLongNovelPolishSystemPrompt,
} from "@/lib/novel-locale-prompts";

/** 润色一批刚写完的章节段落（保留章节标记结构）。 */
export async function polishNovelSegmentText(params: {
  segmentText: string;
  bible: NovelBible;
  model: string;
  lengthTier: NovelLengthTier;
  prompt?: string;
  outputLocale?: BriefInputLocale;
  emit?: NovelStreamEmitter;
  segmentIndex?: number;
}): Promise<string> {
  const { segmentText, bible, model, lengthTier, emit, segmentIndex } = params;
  const locale = params.outputLocale ?? resolveNovelOutputLocale(params.prompt ?? "");
  const chapters = parseNovelChapters(segmentText.trim());
  if (chapters.length === 0) return segmentText;

  const bibleBrief = formatNovelBibleForPrompt(bible, locale).slice(0, 1200);
  const polished: Array<{ num: number; title: string; body: string }> = [];

  for (const ch of chapters) {
    emit?.({
      step: "polish_start",
      chapter: ch.num,
      segment: segmentIndex,
      message: `润色第 ${ch.num} 章…`,
    });

    const body = ch.body.trim();
    if (body.length < 80) {
      polished.push({ num: ch.num, title: ch.title, body });
      emit?.({ step: "polish_skip", chapter: ch.num, message: "本章过短，跳过润色" });
      continue;
    }

    const result = await llmNovelText(
      {
        model,
        system: getLongNovelPolishSystemPrompt(locale),
        user: buildLongNovelPolishUserMessage({
          locale,
          bibleBrief,
          chapterNum: ch.num,
          chapterTitle: ch.title,
          body,
        }),
        temperature: 0.35,
        maxTokens: Math.min(
          LONG_NOVEL_PRODUCT.polishMaxTokens,
          Math.ceil(body.length * 1.2) + 256,
        ),
        timeoutMs: LONG_NOVEL_PRODUCT.polishTimeoutMs,
      },
      lengthTier,
    );

    const nextBody =
      result.ok && result.text.trim().length >= Math.min(body.length * 0.5, 60)
        ? result.text.trim()
        : body;
    polished.push({ num: ch.num, title: ch.title, body: nextBody });
    emit?.({
      step: "polish_done",
      chapter: ch.num,
      segment: segmentIndex,
      message: `第 ${ch.num} 章润色完成`,
    });
  }

  return serializeNovelChapters(polished, { outputLocale: locale });
}
