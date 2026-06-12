import { fitNovelContentToMaxChars } from "@/lib/novel-chapters";

/** 消费 LLM 流式输出；不在中途硬截断，写完后按章贴合篇幅预算。 */
export async function accumulateNovelTextStream(params: {
  stream: AsyncIterable<string>;
  maxChars: number;
  onDelta: (text: string) => void;
}): Promise<{ content: string; overBudget: boolean }> {
  let content = "";

  for await (const delta of params.stream) {
    content += delta;
    params.onDelta(delta);
  }

  const trimmed = content.trim();
  const fitted = fitNovelContentToMaxChars(trimmed, params.maxChars);
  return { content: fitted, overBudget: fitted.length < trimmed.length };
}
