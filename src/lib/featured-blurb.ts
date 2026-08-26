/**
 * 首页社区货架简介：从已有 prompt / summary 派生短文案（不另调 LLM）。
 */

const FILLER =
  /^(请|帮我|我想|做一个|制作|生成|写一篇|写一部|创作|make|create|write|generate)\s*/i;

/** 取首句并压到展示长度，适合卡片 2 行简介 */
export function deriveFeaturedBlurb(
  ...sources: Array<string | null | undefined>
): string | null {
  for (const raw of sources) {
    const cleaned = cleanSource(raw);
    if (cleaned) return cleaned;
  }
  return null;
}

function cleanSource(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let text = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(FILLER, "").trim();
  if (text.length < 8) return null;

  const sentenceBreak = text.search(/[。！？.!?\n]/);
  if (sentenceBreak > 12 && sentenceBreak < 90) {
    text = text.slice(0, sentenceBreak + ( /[。！？]/.test(text[sentenceBreak]!) ? 1 : 0 ));
  }

  const max = 72;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const soft = Math.max(cut.lastIndexOf("，"), cut.lastIndexOf(","), cut.lastIndexOf(" "));
  return `${(soft > 28 ? cut.slice(0, soft) : cut).trim()}…`;
}
