import { parseNovelChapters, serializeNovelChapters } from "@/lib/novel-chapters";
import { llmNovelText } from "@/lib/llm";
import { LONG_NOVEL_PRODUCT } from "@/lib/novel-long-config";
import type { NovelLengthTier } from "@/lib/novel-length";
import { formatNovelBibleForPrompt, type NovelBible } from "@/lib/novel-long-bible";
import type { NovelStreamEmitter } from "@/lib/novel-long-generate";

const POLISH_SYSTEM = `你是中文网文润色编辑。对单章正文做轻量润色。
硬性要求：情节、人物姓名、因果关系不变；不增删关键事件；不改变章节含义。
只修正语病、重复用词、生硬衔接与明显口语赘余。保持网文节奏，勿改成文艺腔。
只输出润色后的本章正文（不要输出「=== 第X章」标题行、不要输出说明）。`;

/** 润色一批刚写完的章节段落（保留章节标记结构）。 */
export async function polishNovelSegmentText(params: {
  segmentText: string;
  bible: NovelBible;
  model: string;
  lengthTier: NovelLengthTier;
  emit?: NovelStreamEmitter;
  segmentIndex?: number;
}): Promise<string> {
  const { segmentText, bible, model, lengthTier, emit, segmentIndex } = params;
  const chapters = parseNovelChapters(segmentText.trim());
  if (chapters.length === 0) return segmentText;

  const bibleBrief = formatNovelBibleForPrompt(bible).slice(0, 1200);
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
        system: POLISH_SYSTEM,
        user: `【设定参考】\n${bibleBrief}\n\n【第${ch.num}章 ${ch.title}】\n${body.slice(0, 12_000)}\n\n请润色以上正文，字数与原文接近。`,
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

  return serializeNovelChapters(polished);
}
