/** 客户端：消费 POST /api/comic/generate/stream 的 SSE。 */

export type ComicGenerateStreamEvent = {
  step?: string;
  message?: string;
  summary?: string;
  brief?: unknown;
  lines?: string[];
  comic?: { id?: string };
  needsPanelRender?: boolean;
  imagesWarning?: string;
  consistencyWarnings?: string;
  panelCount?: number;
  panelsRendered?: number;
  pipeline?: string;
  index?: number;
  total?: number;
  chunkStart?: number;
  chunkEnd?: number;
};

export type ComicGenerateStreamResult =
  | { ok: true; comicId: string; needsPanelRender: boolean; events: ComicGenerateStreamEvent }
  | { ok: false; error: string };

export async function consumeComicGenerateStream(
  body: Record<string, unknown>,
  onEvent?: (ev: ComicGenerateStreamEvent) => void,
): Promise<ComicGenerateStreamResult> {
  const res = await fetch("/api/comic/generate/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error || `请求失败（${res.status}）` };
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/event-stream") || !res.body) {
    return { ok: false, error: "服务器未返回流式响应" };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuf = "";
  let streamError = "";
  let comicId: string | null = null;
  let needsPanelRender = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    sseBuf += decoder.decode(value, { stream: true });
    for (;;) {
      const sep = sseBuf.indexOf("\n\n");
      if (sep < 0) break;
      const rawBlock = sseBuf.slice(0, sep).trim();
      sseBuf = sseBuf.slice(sep + 2);
      for (const line of rawBlock.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let ev: ComicGenerateStreamEvent;
        try {
          ev = JSON.parse(payload) as ComicGenerateStreamEvent;
        } catch {
          continue;
        }
        if (ev.step !== "ping") onEvent?.(ev);
        if (ev.step === "done" && ev.comic?.id) {
          comicId = ev.comic.id;
          needsPanelRender = Boolean(ev.needsPanelRender);
        }
        if (ev.step === "error") {
          streamError = ev.message ?? "生成失败";
        }
      }
    }
  }

  if (comicId) {
    return { ok: true, comicId, needsPanelRender, events: [] };
  }
  return { ok: false, error: streamError || "漫画生成未完成" };
}
