import { truncateNovelToMaxChars } from "@/lib/novel-chapters";

/** 消费 LLM 流式输出并在达到篇幅上限时停止接收。 */
export async function accumulateNovelTextStream(params: {
  stream: AsyncIterable<string>;
  maxChars: number;
  onDelta: (text: string) => void;
}): Promise<{ content: string; capped: boolean }> {
  let content = "";
  let capped = false;

  for await (const delta of params.stream) {
    if (content.length >= params.maxChars) {
      capped = true;
      break;
    }
    const room = params.maxChars - content.length;
    const piece = delta.length > room ? delta.slice(0, room) : delta;
    if (!piece) {
      capped = true;
      break;
    }
    content += piece;
    params.onDelta(piece);
    if (content.length >= params.maxChars) {
      capped = true;
      break;
    }
  }

  const trimmed = truncateNovelToMaxChars(content, params.maxChars);
  if (trimmed.length !== content.length) capped = true;
  return { content: trimmed, capped };
}
