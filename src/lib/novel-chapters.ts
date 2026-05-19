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

const LENGTH_CAP_FOOTER = "（已达本篇幅字数上限，故事在此收束。）";

/** 超出 maxChars 时保留完整章节，丢弃后续未完成章。 */
export function truncateNovelToMaxChars(content: string, maxChars: number): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const chapters = parseNovelChapters(trimmed);
  if (chapters.length <= 1) {
    const slice = trimmed.slice(0, Math.max(0, maxChars - LENGTH_CAP_FOOTER.length - 2)).trimEnd();
    return `${slice}\n\n${LENGTH_CAP_FOOTER}`;
  }

  const kept: Array<{ num: number; title: string; body: string }> = [];
  for (const ch of chapters) {
    const trial = serializeNovelChapters([...kept, { num: ch.num, title: ch.title, body: ch.body }]);
    if (trial.length > maxChars) break;
    kept.push({ num: ch.num, title: ch.title, body: ch.body });
  }

  if (kept.length === 0) {
    const first = chapters[0]!;
    const head = `=== 第${first.num}章 ${first.title} ===\n\n`;
    const bodyRoom = Math.max(80, maxChars - head.length - LENGTH_CAP_FOOTER.length - 4);
    return `${head}${first.body.slice(0, bodyRoom).trimEnd()}\n\n${LENGTH_CAP_FOOTER}`;
  }

  let out = serializeNovelChapters(kept);
  if (kept.length < chapters.length && out.length + LENGTH_CAP_FOOTER.length + 2 <= maxChars) {
    out += `\n\n${LENGTH_CAP_FOOTER}`;
  }
  return out.length > maxChars ? out.slice(0, maxChars).trimEnd() : out;
}
