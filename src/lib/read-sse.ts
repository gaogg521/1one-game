import type { AppLocale } from "@/i18n/routing";
import { clientErrorMessage } from "@/lib/i18n/progress-message";

/** 浏览器端解析 text/event-stream（按行 data: JSON）。 */
export async function consumeSSE(
  response: Response,
  onData: (obj: Record<string, unknown>) => void,
  opts?: { locale?: AppLocale },
): Promise<void> {
  const locale = opts?.locale ?? "zh-Hans";
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(clientErrorMessage(locale, "sseNoBody"));
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let doneReading = false;
  while (!doneReading) {
    const { done, value } = await reader.read();
    if (done) {
      doneReading = true;
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      for (const line of block.split("\n")) {
        const t = line.trim();
        if (t.startsWith("data: ")) {
          try {
            onData(JSON.parse(t.slice(6)) as Record<string, unknown>);
          } catch {
            /* 忽略损坏帧 */
          }
        }
      }
    }
  }
}
