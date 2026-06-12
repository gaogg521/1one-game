export type BriefInputLocale = "zh" | "zh-Hant" | "en" | "ja" | "ms" | "th";

/** 简体专用字（与繁体写法不同） */
const SIMPLIFIED_ONLY = "请这为开关说与时里后来对于实际无响应让国义经发现爱广东云气电";
/** 繁体专用字（与简体写法不同） */
const TRADITIONAL_ONLY = "請這為開關說與時裡後來對於實際無響應讓國義經發現愛廣東雲氣電";

const TRADITIONAL_HINT_RE =
  /繁體|繁体|請用繁體|繁體中文|繁体中文|Traditional\s*Chinese|zh[-_]?Hant|zh[-_]?TW|zh[-_]?HK/i;

/** 从中文文本推断简繁（默认简体） */
export function detectChineseScriptVariant(text: string): "zh" | "zh-Hant" {
  const t = text.trim();
  if (!t) return "zh";
  if (TRADITIONAL_HINT_RE.test(t)) return "zh-Hant";

  let tradScore = 0;
  let simpScore = 0;
  for (const ch of t) {
    if (TRADITIONAL_ONLY.includes(ch)) tradScore++;
    if (SIMPLIFIED_ONLY.includes(ch)) simpScore++;
  }
  if (tradScore >= 2 && tradScore > simpScore) return "zh-Hant";
  return "zh";
}

/** 从用户一句话推断主要输入语言（规则层，不调用 LLM） */
export function detectBriefInputLocale(prompt: string): BriefInputLocale {
  const t = prompt.trim();
  if (!t) return "zh";

  const hiragana = (t.match(/[\u3040-\u309f]/g) ?? []).length;
  const katakana = (t.match(/[\u30a0-\u30ff]/g) ?? []).length;
  const cjk = (t.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latin = (t.match(/[a-zA-Z]/g) ?? []).length;
  const thai = (t.match(/[\u0E00-\u0E7F]/g) ?? []).length;
  const malayHints =
    (t.match(/\b(yang|dan|dengan|untuk|seorang|sebuah|dalam|malam|kisah|pendek|wira|tentang|cerpen|bahasa|melayu|tulis)\b/gi) ??
      []).length;

  if (hiragana + katakana >= 2 && hiragana + katakana >= latin) return "ja";
  if (thai >= 2 && thai >= latin) return "th";
  if (malayHints >= 2 && latin >= 4) return "ms";
  if (cjk >= 2 && cjk >= latin) return detectChineseScriptVariant(t);
  if (latin >= 4 && latin > cjk) return "en";
  if (cjk > 0) return detectChineseScriptVariant(t);
  if (thai > 0) return "th";
  if (hiragana + katakana > 0) return "ja";
  return latin > 0 ? "en" : "zh";
}

/** 小说正文输出语言（与 UI locale 解耦，优先用户原话） */
export function resolveNovelOutputLocale(prompt: string, uiLocaleHint?: string | null): BriefInputLocale {
  const fromPrompt = detectBriefInputLocale(prompt);
  if (fromPrompt !== "zh" || !uiLocaleHint) return fromPrompt;
  if (uiLocaleHint === "zh-Hant") return "zh-Hant";
  return fromPrompt;
}
