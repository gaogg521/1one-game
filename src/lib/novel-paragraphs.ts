/** 将章节正文拆成阅读段落（兼容单换行与双换行） */
export function splitNovelParagraphs(body: string): string[] {
  const text = body.trim();
  if (!text) return [];

  const byBlank = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (byBlank.length > 1) return byBlank;

  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [text];

  const paras: string[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    if (/^第\s*\d+\s*章/.test(line) || /^===\s*第/.test(line)) {
      if (buf.length) paras.push(buf.join("\n"));
      buf = [];
      continue;
    }
    buf.push(line);
  }
  if (buf.length) paras.push(buf.join("\n"));
  return paras.length > 0 ? paras : [text];
}
