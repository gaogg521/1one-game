export interface NovelChapter {
  num: number;
  title: string;
  body: string;
  id: string;
}

const CHAPTER_MARKER = /===\s*第\s*(\d+)\s*章\s+(.+?)\s*===/g;

/** 解析「=== 第N章 标题 ===」分隔的正文；无标记时按段落自动分章 */
export function parseNovelChapters(content: string): NovelChapter[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(CHAPTER_MARKER);
  const chapters: NovelChapter[] = [];

  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i += 3) {
      const num = parseInt(parts[i] ?? "1", 10) || Math.floor(i / 3) + 1;
      const title = (parts[i + 1] ?? "").trim() || `第${num}章`;
      const body = (parts[i + 2] ?? "").trim();
      chapters.push({ num, title, body, id: `chapter-${num}` });
    }
    return chapters;
  }

  const paras = trimmed.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paras.length <= 1) {
    return [{ num: 1, title: "正文", body: trimmed, id: "chapter-1" }];
  }

  const chunkSize = Math.max(2, Math.ceil(paras.length / Math.min(6, Math.ceil(paras.length / 3))));
  let idx = 0;
  let ch = 1;
  while (idx < paras.length) {
    const slice = paras.slice(idx, idx + chunkSize);
    chapters.push({
      num: ch,
      title: ch === 1 ? "开篇" : `第${ch}节`,
      body: slice.join("\n\n"),
      id: `chapter-${ch}`,
    });
    idx += chunkSize;
    ch += 1;
  }
  return chapters;
}

/** 将章节列表写回正文存储格式 */
export function serializeNovelChapters(
  chapters: Array<{ num: number; title: string; body: string }>,
): string {
  return chapters
    .map((ch, i) => {
      const num = ch.num > 0 ? ch.num : i + 1;
      const title = ch.title.trim() || "正文";
      const body = ch.body.trim();
      return `=== 第${num}章 ${title} ===\n\n${body}`;
    })
    .filter((block) => block.length > 20)
    .join("\n\n");
}
