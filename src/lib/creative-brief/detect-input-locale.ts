export type BriefInputLocale = "zh" | "en" | "ja";

/** 从用户一句话推断主要输入语言（规则层，不调用 LLM） */
export function detectBriefInputLocale(prompt: string): BriefInputLocale {
  const t = prompt.trim();
  if (!t) return "zh";

  const hiragana = (t.match(/[\u3040-\u309f]/g) ?? []).length;
  const katakana = (t.match(/[\u30a0-\u30ff]/g) ?? []).length;
  const cjk = (t.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latin = (t.match(/[a-zA-Z]/g) ?? []).length;

  if (hiragana + katakana >= 2 && hiragana + katakana >= latin) return "ja";
  if (cjk >= 2 && cjk >= latin) return "zh";
  if (latin >= 4 && latin > cjk) return "en";
  if (cjk > 0) return "zh";
  if (hiragana + katakana > 0) return "ja";
  return latin > 0 ? "en" : "zh";
}
