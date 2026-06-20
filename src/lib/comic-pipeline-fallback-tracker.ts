/**
 * 漫画管线降级事件追踪
 * 记录从 long_director 到 light 或 emergency 的降级事件
 */

export type ComicFallbackContext = "director_pack" | "director_chunk" | "light_generation";

export type ComicFallbackEvent = {
  fromMode: "long_director" | "light";
  toMode: "light" | "emergency";
  errorCode?: string;
  errorMessage: string;
  context: ComicFallbackContext;
  pageNum?: number;
  chunkIdx?: number;
  timestamp: string;
};

export function recordComicModeFallback(opts: {
  fromMode: "long_director" | "light";
  toMode: "light" | "emergency";
  error: unknown;
  context: ComicFallbackContext;
  page?: number;
  chunk?: number;
}): ComicFallbackEvent {
  const errorMessage = extractErrorMessage(opts.error);
  return {
    fromMode: opts.fromMode,
    toMode: opts.toMode,
    errorMessage,
    context: opts.context,
    pageNum: opts.page,
    chunkIdx: opts.chunk,
    timestamp: new Date().toISOString(),
  };
}

export function logComicModeFallback(event: ComicFallbackEvent): void {
  const location =
    event.pageNum !== undefined
      ? `page=${event.pageNum}`
      : event.chunkIdx !== undefined
        ? `chunk=${event.chunkIdx}`
        : "unknown";

  const line = [
    "[COMIC_FALLBACK]",
    `${event.timestamp}`,
    `${event.fromMode}->${event.toMode}`,
    location,
    `context=${event.context}`,
    `error="${event.errorMessage.slice(0, 80)}"`,
  ].join(" | ");

  console.warn(line);
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}
