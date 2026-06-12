/** 客户端：消费 POST /api/comic/generate/stream 的 SSE。 */

import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { apiErrorMessage, clientErrorMessage } from "@/lib/i18n/progress-message";

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
  | { ok: true; comicId: string; needsPanelRender: boolean; events: ComicGenerateStreamEvent[] }
  | { ok: false; error: string; code?: string; needed?: number; available?: number };

export async function consumeComicGenerateStream(
  body: Record<string, unknown>,
  onEvent?: (ev: ComicGenerateStreamEvent) => void,
  uiLocale: AppLocale = "zh-Hans",
): Promise<ComicGenerateStreamResult> {
  const res = await fetch("/api/comic/generate/stream", {
    method: "POST",
    headers: mergeLocaleHeaders(uiLocale, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      needed?: number;
      available?: number;
    };
    return {
      ok: false,
      error: data.error || clientErrorMessage(uiLocale, "requestFailed", { status: res.status }),
      code: data.code,
      needed: data.needed,
      available: data.available,
    };
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/event-stream") || !res.body) {
    return { ok: false, error: clientErrorMessage(uiLocale, "streamNotSse") };
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
          streamError = ev.message ?? apiErrorMessage(uiLocale, "generateFailed");
        }
      }
    }
  }

  if (comicId) {
    return { ok: true, comicId, needsPanelRender, events: [] as ComicGenerateStreamEvent[] };
  }
  return {
    ok: false,
    error: streamError || clientErrorMessage(uiLocale, "comicGenerateIncomplete"),
  };
}
