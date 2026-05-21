/**
 * 将小说正文拆为段落，并按页批次绑定分镜，减少「只抓关键词、不读上下文」。
 */

import { formatDialogueHintsForSegment } from "@/lib/comic-dialogue-extract";

export type NovelStorySegment = {
  index: number;
  text: string;
  charStart: number;
};

/** 按空行 / 句号分段，过滤过短碎片 */
export function splitNovelIntoSegments(content: string, minLen = 24): NovelStorySegment[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const rawBlocks = normalized.split(/\n\s*\n+/);
  const segments: NovelStorySegment[] = [];
  let cursor = 0;

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (trimmed.length < minLen) continue;
    const start = normalized.indexOf(trimmed, cursor);
    const charStart = start >= 0 ? start : cursor;
    segments.push({ index: segments.length, text: trimmed.slice(0, 1200), charStart });
    cursor = charStart + trimmed.length;
  }

  if (segments.length > 0) return segments;

  const sentences = normalized.split(/(?<=[。！？!?])\s*/).filter((s) => s.trim().length >= minLen);
  let pos = 0;
  for (const s of sentences) {
    const t = s.trim();
    segments.push({ index: segments.length, text: t.slice(0, 1200), charStart: pos });
    pos += t.length;
  }
  return segments;
}

/** 为第 chunkStart～chunkEnd 页分配对应段落（约 1 段 → 1～2 格） */
export function segmentsForPageChunk(
  segments: NovelStorySegment[],
  chunkStart: number,
  chunkEnd: number,
  totalPages: number,
): NovelStorySegment[] {
  if (segments.length === 0) return [];
  const startPct = (chunkStart - 1) / Math.max(1, totalPages);
  const endPct = chunkEnd / Math.max(1, totalPages);
  const from = Math.floor(startPct * segments.length);
  const to = Math.max(from + 1, Math.ceil(endPct * segments.length));
  return segments.slice(from, Math.min(to, segments.length));
}

export function formatSegmentsForStoryboardPrompt(segs: NovelStorySegment[]): string {
  if (segs.length === 0) return "（正文过短，请结合标题与简介改编）";
  return segs
    .map((s) => {
      const dlg = formatDialogueHintsForSegment(s);
      return dlg
        ? `[段落#${s.index + 1}]\n${s.text}\n【本段对白提取 — 请用 dialogue+speaker 填入分镜】\n${dlg}`
        : `[段落#${s.index + 1}]\n${s.text}`;
    })
    .join("\n\n");
}
