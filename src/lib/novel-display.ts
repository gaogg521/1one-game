/** 小说书名最大字数（含用户手动编辑） */
export const NOVEL_TITLE_MAX_LEN = 10;

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

export function clampNovelTitle(title: string, maxLen = NOVEL_TITLE_MAX_LEN): string {
  const t = title.trim().replace(/\s+/g, "");
  if (!t) return "未命名";
  return t.length <= maxLen ? t : t.slice(0, maxLen);
}

export function validateNovelTitleInput(
  title: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const t = title.trim();
  if (!t) return { ok: false, error: "标题不能为空" };
  if (t.length > NOVEL_TITLE_MAX_LEN) {
    return { ok: false, error: `标题不能超过 ${NOVEL_TITLE_MAX_LEN} 个字` };
  }
  return { ok: true, value: t };
}

/** 从创意描述截取短书名 */
export function shortTitleFromPrompt(prompt: string, maxLen = NOVEL_TITLE_MAX_LEN): string | null {
  const raw = prompt.trim().replace(/\s+/g, " ");
  if (!raw) return null;
  const first = raw.split(/[。！？\n；;]/)[0]?.trim() ?? raw;
  const cleaned = first.replace(/^(请|帮我|写|创作|生成)+/u, "").trim();
  if (cleaned.length < 2) return null;
  if (looksLikeOutlineOrPrompt(cleaned)) {
    const m = cleaned.match(/《([^》]{2,10})》/);
    if (m?.[1]) return clampNovelTitle(m[1], maxLen);
    const hit = cleaned.match(/(?:穿越|重生|魂穿|回到)(.{2,8}?)(?:的|之|，|。|,|$)/);
    if (hit?.[1]) return clampNovelTitle((hit[0].includes("魂穿") || hit[0].includes("穿越") ? hit[0].slice(0, 4) : "") + hit[1], maxLen);
    if (/崇祯|煤山|明末/.test(cleaned)) {
      const m2 = cleaned.match(/(魂穿|穿越).{0,4}(崇祯|煤山)/);
      if (m2) return clampNovelTitle(m2[0], maxLen);
    }
  }
  if (!looksLikeOutlineOrPrompt(cleaned)) return clampNovelTitle(cleaned, maxLen);
  return null;
}

/** 入库 / 展示用书名规范化（≤10 字） */
export function normalizeNovelTitle(
  title: string,
  prompt?: string,
  contentFirstLine?: string,
): string {
  const user = title.trim();
  if (user && user.length <= NOVEL_TITLE_MAX_LEN && !looksLikeOutlineOrPrompt(user)) {
    return clampNovelTitle(user);
  }

  const fromPrompt = prompt ? shortTitleFromPrompt(prompt) : null;
  if (fromPrompt) return fromPrompt;

  const line = (contentFirstLine ?? "").trim().replace(/^#+\s*/, "");
  if (line && line.length <= NOVEL_TITLE_MAX_LEN && !looksLikeOutlineOrPrompt(line)) {
    return clampNovelTitle(line);
  }

  if (user) {
    const head = user.split(/[（(【\n]/)[0]?.trim() ?? user;
    if (head.length >= 2) return clampNovelTitle(head);
  }

  return "未命名";
}

/** 从生成正文推断书名（避免把大纲首行当标题） */
export function extractNovelTitleFromContent(
  content: string,
  userTitle?: string,
  prompt?: string,
): string {
  if (userTitle?.trim()) {
    const v = validateNovelTitleInput(userTitle.trim());
    if (v.ok && !looksLikeOutlineOrPrompt(v.value)) return v.value;
    if (!looksLikeOutlineOrPrompt(userTitle)) return clampNovelTitle(userTitle);
  }

  const trimmed = content.trim();
  const chapterMatch = trimmed.match(/===\s*第\s*1\s*章\s+(.+?)\s*===/);
  if (chapterMatch?.[1]) {
    const chTitle = chapterMatch[1].trim();
    if (
      chTitle.length <= NOVEL_TITLE_MAX_LEN &&
      !looksLikeOutlineOrPrompt(chTitle) &&
      chTitle !== "正文" &&
      chTitle !== "开篇"
    ) {
      return clampNovelTitle(chTitle);
    }
  }

  const firstLine = trimmed.split("\n")[0]?.replace(/^#+\s*/, "").trim() ?? "";
  const normalized = normalizeNovelTitle(firstLine, prompt, firstLine);
  if (looksLikeOutlineOrPrompt(normalized) && prompt) {
    const alt = shortTitleFromPrompt(prompt);
    if (alt) return alt;
  }
  return normalized;
}

/** 阅读页摘要：过滤与标题重复或过长的大纲式 summary */
export function displayNovelSummary(
  summary: string | null | undefined,
  displayTitle: string,
  prompt?: string,
): string | null {
  const s = summary?.trim();
  if (!s || s.length < 8) return null;
  if (s === displayTitle || s.startsWith(displayTitle)) return null;
  if (looksLikeOutlineOrPrompt(s) || s.length > 160) {
    const fromPrompt = prompt ? shortTitleFromPrompt(prompt, 40) : null;
    if (fromPrompt && fromPrompt !== displayTitle) return fromPrompt;
    return null;
  }
  return s.length > 120 ? s.slice(0, 118) + "…" : s;
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
