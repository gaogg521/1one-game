import type { AppLocale } from "@/i18n/routing";
import {
  defaultChapterTitle,
  novelChapterBodyLabel,
  novelChapterOpeningLabel,
  novelChapterSectionLabel,
} from "@/lib/i18n/chapter-labels";

export interface NovelChapter {
  num: number;
  title: string;
  body: string;
  id: string;
}

const CHAPTER_MARKERS = [
  /===\s*第\s*(\d+)\s*章\s+(.+?)\s*===/g,
  /===\s*Chapter\s*(\d+)\s*:\s*(.+?)\s*===/gi,
] as const;

/** 解析「=== 第N章 标题 ===」分隔的正文；无标记时按段落自动分章 */
export function parseNovelChapters(content: string, uiLocale: AppLocale = "zh-Hans"): NovelChapter[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  const chapters: NovelChapter[] = [];

  for (const marker of CHAPTER_MARKERS) {
    const parts = trimmed.split(marker);
    chapters.length = 0;
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i += 3) {
        const num = parseInt(parts[i] ?? "1", 10) || Math.floor(i / 3) + 1;
        const title =
          (parts[i + 1] ?? "").trim() || defaultChapterTitle(uiLocale, num);
        const body = (parts[i + 2] ?? "").trim();
        chapters.push({ num, title, body, id: `chapter-${num}` });
      }
      return chapters;
    }
  }

  const paras = trimmed.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paras.length <= 1) {
    return [{ num: 1, title: novelChapterBodyLabel(uiLocale), body: trimmed, id: "chapter-1" }];
  }

  const chunkSize = Math.max(2, Math.ceil(paras.length / Math.min(6, Math.ceil(paras.length / 3))));
  let idx = 0;
  let ch = 1;
  while (idx < paras.length) {
    const slice = paras.slice(idx, idx + chunkSize);
    chapters.push({
      num: ch,
      title: ch === 1 ? novelChapterOpeningLabel(uiLocale) : novelChapterSectionLabel(uiLocale, ch),
      body: slice.join("\n\n"),
      id: `chapter-${ch}`,
    });
    idx += chunkSize;
    ch += 1;
  }
  return chapters;
}

function usesLatinChapterMarkers(content: string): boolean {
  return /===\s*Chapter\s*\d+/i.test(content);
}

/** 将章节列表写回正文存储格式 */
export function serializeNovelChapters(
  chapters: Array<{ num: number; title: string; body: string }>,
  opts?: { latinMarkers?: boolean },
): string {
  const latin = opts?.latinMarkers ?? false;
  return chapters
    .map((ch, i) => {
      const num = ch.num > 0 ? ch.num : i + 1;
      const title = ch.title.trim() || (latin ? "Body" : "正文");
      const body = ch.body.trim();
      const head = latin
        ? `=== Chapter ${num}: ${title} ===`
        : `=== 第${num}章 ${title} ===`;
      return `${head}\n\n${body}`;
    })
    .filter((block) => block.length > 20)
    .join("\n\n");
}

/**
 * 超出 maxChars 时只保留能完整容纳的章节（不插入「已达上限」类收束句）。
 * 规划内写作仍偶发略超限时，由完整性校验 + 补结尾处理，而非伪造结局。
 */
export function fitNovelContentToMaxChars(content: string, maxChars: number): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const chapters = parseNovelChapters(trimmed);
  const latinMarkers = usesLatinChapterMarkers(trimmed);
  if (chapters.length <= 1) {
    return trimmed.slice(0, maxChars).trimEnd();
  }

  const kept: Array<{ num: number; title: string; body: string }> = [];
  for (const ch of chapters) {
    const trial = serializeNovelChapters([...kept, { num: ch.num, title: ch.title, body: ch.body }], {
      latinMarkers,
    });
    if (trial.length > maxChars) break;
    kept.push({ num: ch.num, title: ch.title, body: ch.body });
  }

  if (kept.length === 0) {
    const first = chapters[0]!;
    const head = latinMarkers
      ? `=== Chapter ${first.num}: ${first.title} ===\n\n`
      : `=== 第${first.num}章 ${first.title} ===\n\n`;
    const bodyRoom = Math.max(80, maxChars - head.length - 4);
    return `${head}${first.body.slice(0, bodyRoom).trimEnd()}`;
  }

  const out = serializeNovelChapters(kept, { latinMarkers });
  return out.length > maxChars ? out.slice(0, maxChars).trimEnd() : out;
}

/** @deprecated 使用 fitNovelContentToMaxChars */
export function truncateNovelToMaxChars(content: string, maxChars: number, _locale?: string): string {
  return fitNovelContentToMaxChars(content, maxChars);
}
