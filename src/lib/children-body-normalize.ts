const CHAPTER_MARKER = /===\s*第\s*\d+\s*章\s+.+?\s*===\s*/g;

/** 儿童短篇正文：去掉 LLM 误加的分章标记，保持单篇连贯 */
export function stripChildrenChapterMarkers(body: string): string {
  return body.replace(CHAPTER_MARKER, "").replace(/\n{3,}/g, "\n\n").trim();
}
