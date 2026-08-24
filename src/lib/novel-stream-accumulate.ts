import { fitNovelSegmentToMaxChars } from "@/lib/novel-chapters";

/** 消费 LLM 流式输出；展示与落库共用同一硬字数预算。 */
export async function accumulateNovelTextStream(params: {
  stream: AsyncIterable<string>;
  maxChars: number;
  onDelta: (text: string) => void;
}): Promise<{ content: string; overBudget: boolean }> {
  let content = "";
  let emittedChars = 0;
  let overBudget = false;

  for await (const delta of params.stream) {
    content += delta;
    const visible = delta.slice(0, Math.max(0, params.maxChars - emittedChars));
    if (visible) {
      emittedChars += visible.length;
      params.onDelta(visible);
    }
    if (visible.length < delta.length) overBudget = true;
  }

  const trimmed = content.trim();
  const fitted = fitNovelSegmentToMaxChars(trimmed, params.maxChars);
  return { content: fitted, overBudget: overBudget || fitted.length < trimmed.length };
}
