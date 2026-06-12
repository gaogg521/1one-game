import type { AppLocale } from "@/i18n/routing";
import { buildNovelSynopsisHeuristic } from "@/lib/novel-synopsis";
import {
  isGenericNovelChapterTitle,
  novelSynopsisMessage,
  untitledShortLabel,
} from "@/lib/i18n/chapter-labels";
import { tMessage } from "@/lib/i18n/messages";

export type NovelTitleValidationError = "titleEmpty" | "titleTooLong";

/** 小说书名最大字数（含用户手动编辑） */
export const NOVEL_TITLE_MAX_LEN = 15;

export function formatNovelTitleValidationError(
  locale: AppLocale,
  errorKey: NovelTitleValidationError,
): string {
  return tMessage(locale, `apiErrors.${errorKey}`, { max: NOVEL_TITLE_MAX_LEN });
}

/**
 * 以“展示宽度”近似估算标题长度：
 * - CJK / 全角按 1
 * - 拉丁字母、数字与半角符号按 0.5
 * 这样中文仍维持 15 字上限，英文标题也不会被过早误杀。
 */
export function measureNovelTitleUnits(title: string): number {
  let units = 0;
  for (const ch of title.trim()) {
    if (!ch.trim()) continue;
    units += /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\uff00-\uffef]/u.test(ch) ? 1 : 0.5;
  }
  return units;
}

function sliceNovelTitleByUnits(title: string, maxUnits = NOVEL_TITLE_MAX_LEN): string {
  let units = 0;
  let out = "";
  for (const ch of title.trim().replace(/\s+/g, " ")) {
    const next = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\uff00-\uffef]/u.test(ch) ? 1 : 0.5;
    if (units + next > maxUnits) break;
    out += ch;
    units += next;
  }
  return out.trim();
}

/** 展示用：判断字符串是否像大纲/创意说明（用于书名/摘要，勿用于长正文） */
export function looksLikeOutlineOrPrompt(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  if (/[（(【]/.test(t) && t.length > 24) return true;
  if (/[一二三四五六七八九十百千]+[、．.]|^\d+[、．.]/.test(t)) return true;
  if (/完整构思|小说完整|开篇人设|穿越契机|白领社畜|一、|二、|三、/.test(t)) return true;
  if (/魂穿|穿越/.test(t) && /构思|人设|契机|白领/.test(t)) return true;
  return false;
}

export function clampNovelTitle(
  title: string,
  maxLen = NOVEL_TITLE_MAX_LEN,
  uiLocale: AppLocale = "zh-Hans",
): string {
  const t = title.trim().replace(/\s+/g, " ");
  if (!t) return untitledShortLabel(uiLocale);
  return measureNovelTitleUnits(t) <= maxLen ? t : sliceNovelTitleByUnits(t, maxLen);
}

export function validateNovelTitleInput(
  title: string,
): { ok: true; value: string } | { ok: false; errorKey: NovelTitleValidationError } {
  const t = title.trim();
  if (!t) return { ok: false, errorKey: "titleEmpty" };
  if (measureNovelTitleUnits(t) > NOVEL_TITLE_MAX_LEN) {
    return { ok: false, errorKey: "titleTooLong" };
  }
  return { ok: true, value: t };
}

/** 从创意描述截取短书名 */
export function shortTitleFromPrompt(
  prompt: string,
  maxLen = NOVEL_TITLE_MAX_LEN,
  uiLocale: AppLocale = "zh-Hans",
): string | null {
  const raw = prompt.trim().replace(/\s+/g, " ");
  if (!raw) return null;
  const first = raw.split(/[。！？\n；;]/)[0]?.trim() ?? raw;
  const cleaned = first.replace(/^(请|帮我|写|创作|生成)+/u, "").trim();
  if (cleaned.length < 2) return null;
  if (looksLikeOutlineOrPrompt(cleaned)) {
    const m = cleaned.match(/《([^》]{2,15})》/);
    if (m?.[1]) return clampNovelTitle(m[1], maxLen, uiLocale);
    const hit = cleaned.match(/(?:穿越|重生|魂穿|回到)(.{2,8}?)(?:的|之|，|。|,|$)/);
    if (hit?.[1])
      return clampNovelTitle(
        (hit[0].includes("魂穿") || hit[0].includes("穿越") ? hit[0].slice(0, 4) : "") + hit[1],
        maxLen,
        uiLocale,
      );
    if (/崇祯|煤山|明末/.test(cleaned)) {
      const m2 = cleaned.match(/(魂穿|穿越).{0,4}(崇祯|煤山)/);
      if (m2) return clampNovelTitle(m2[0], maxLen, uiLocale);
    }
  }
  if (!looksLikeOutlineOrPrompt(cleaned)) return clampNovelTitle(cleaned, maxLen, uiLocale);
  return null;
}

/** 入库 / 展示用书名规范化（≤15 字） */
export function normalizeNovelTitle(
  title: string,
  prompt?: string,
  contentFirstLine?: string,
  uiLocale: AppLocale = "zh-Hans",
): string {
  const user = title.trim();
  if (user && measureNovelTitleUnits(user) <= NOVEL_TITLE_MAX_LEN && !looksLikeOutlineOrPrompt(user)) {
    return clampNovelTitle(user, NOVEL_TITLE_MAX_LEN, uiLocale);
  }

  const fromPrompt = prompt ? shortTitleFromPrompt(prompt, NOVEL_TITLE_MAX_LEN, uiLocale) : null;
  if (fromPrompt) return fromPrompt;

  const line = (contentFirstLine ?? "").trim().replace(/^#+\s*/, "");
  if (line && measureNovelTitleUnits(line) <= NOVEL_TITLE_MAX_LEN && !looksLikeOutlineOrPrompt(line)) {
    return clampNovelTitle(line, NOVEL_TITLE_MAX_LEN, uiLocale);
  }

  if (user) {
    const head = user.split(/[（(【\n]/)[0]?.trim() ?? user;
    if (head.length >= 2) return clampNovelTitle(head, NOVEL_TITLE_MAX_LEN, uiLocale);
  }

  return untitledShortLabel(uiLocale);
}

/** 从生成正文推断书名（避免把大纲首行当标题） */
export function extractNovelTitleFromContent(
  content: string,
  userTitle?: string,
  prompt?: string,
  uiLocale: AppLocale = "zh-Hans",
): string {
  if (userTitle?.trim()) {
    const v = validateNovelTitleInput(userTitle.trim());
    if (v.ok && !looksLikeOutlineOrPrompt(v.value)) return v.value;
    if (!looksLikeOutlineOrPrompt(userTitle)) return clampNovelTitle(userTitle, NOVEL_TITLE_MAX_LEN, uiLocale);
  }

  const trimmed = content.trim();
  const chapterMatch =
    trimmed.match(/===\s*第\s*1\s*章\s+(.+?)\s*===/) ??
    trimmed.match(/===\s*Chapter\s*1\s*:\s*(.+?)\s*===/i);
  if (chapterMatch?.[1]) {
    const chTitle = chapterMatch[1].trim();
    if (
      measureNovelTitleUnits(chTitle) <= NOVEL_TITLE_MAX_LEN &&
      !looksLikeOutlineOrPrompt(chTitle) &&
      !isGenericNovelChapterTitle(chTitle)
    ) {
      return clampNovelTitle(chTitle, NOVEL_TITLE_MAX_LEN, uiLocale);
    }
  }

  const firstLine = trimmed.split("\n")[0]?.replace(/^#+\s*/, "").trim() ?? "";
  const normalized = normalizeNovelTitle(firstLine, prompt, firstLine, uiLocale);
  if (looksLikeOutlineOrPrompt(normalized) && prompt) {
    const alt = shortTitleFromPrompt(prompt, NOVEL_TITLE_MAX_LEN, uiLocale);
    if (alt) return alt;
  }
  return normalized;
}

/** 阅读页摘要：优先 DB 梗概，否则用正文启发式（见 novel-synopsis）。 */
export function displayNovelSummary(
  summary: string | null | undefined,
  displayTitle: string,
  prompt?: string,
  content?: string,
  uiLocale: AppLocale = "zh-Hans",
): string | null {
  const s = summary?.trim();
  const excerptLike =
    s &&
    content?.trim() &&
    s.replace(/…+$/u, "").length >= 20 &&
    content.replace(/\s+/g, " ").includes(s.replace(/…+$/u, "").slice(0, 48));

  if (
    s &&
    s.length >= 8 &&
    s !== displayTitle &&
    !s.startsWith(`${displayTitle}：`) &&
    !excerptLike
  ) {
    if (!looksLikeOutlineOrPrompt(s)) {
      return s.length > 220 ? `${s.slice(0, 218)}…` : s;
    }
  }
  if (content?.trim()) {
    const h = buildNovelSynopsisHeuristic(content, prompt ?? "", displayTitle, uiLocale).trim();
    if (h.length >= 8 && h !== displayTitle) return h;
  }
  const fromPrompt = prompt ? shortTitleFromPrompt(prompt, 80) : null;
  if (fromPrompt && fromPrompt !== displayTitle && !looksLikeOutlineOrPrompt(fromPrompt)) {
    return fromPrompt;
  }
  return null;
}

/** 去掉章节正文开头重复的书名/标题段（不删减正常叙事段落） */
export function stripLeadingTitleFromBody(body: string, titles: string[]): string {
  const original = body.trim();
  if (!original) return original;

  let text = original;
  const candidates = [...new Set(titles.map((t) => t.trim()).filter((t) => t.length >= 2))];

  for (let round = 0; round < 2; round++) {
    const paras = text.split(/\n\n+/);
    if (paras.length === 0) break;
    const first = paras[0]?.trim() ?? "";
    if (!first || first.length > 500) break;

    let removed = false;
    for (const t of candidates) {
      if (first === t || (t.length >= 2 && first.startsWith(t) && first.length <= t.length + 8)) {
        paras.shift();
        text = paras.join("\n\n").trim();
        removed = true;
        break;
      }
    }

    if (!removed) break;
  }

  return text.length >= 20 ? text : original;
}
