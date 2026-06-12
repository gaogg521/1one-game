import type { AppLocale } from "@/i18n/routing";
import {
  allChildrenBodyMarks,
  allChildrenClosingMarks,
  allChildrenInterpretMarks,
} from "@/lib/children-age-length";
import {
  childrenInterpretSectionLabel,
  childrenParentReadingSectionLabel,
  childrenStorySectionLabel,
  novelChapterBodyLabel,
} from "@/lib/i18n/chapter-labels";
import { comicScopeLabelMessage } from "@/lib/i18n/progress-message";
import type { NovelChapter } from "@/lib/novel-chapters";
import { parseChildrenStoryOutput } from "@/lib/children-story-output";

export type ChildrenComicSection = {
  num: number;
  title: string;
  body: string;
  id: string;
};

export function isChildrenFormattedNovelContent(content: string): boolean {
  const marks = [
    ...allChildrenInterpretMarks(),
    ...allChildrenBodyMarks(),
    ...allChildrenClosingMarks(),
  ];
  return marks.some((m) => content.trim().includes(m));
}

/** 儿童成稿 → 漫画改编模块（非网文章节） */
export function parseChildrenComicSections(
  content: string,
  uiLocale: AppLocale = "zh-Hans",
): ChildrenComicSection[] {
  const parsed = parseChildrenStoryOutput(content, undefined, uiLocale);
  const sections: ChildrenComicSection[] = [];
  let n = 1;

  if (parsed.interpretation.trim()) {
    sections.push({
      num: n++,
      title: childrenInterpretSectionLabel(uiLocale),
      body: parsed.interpretation.trim(),
      id: "children-interpret",
    });
  }

  const storyBody = parsed.body.trim();
  if (storyBody) {
    sections.push({
      num: n++,
      title: childrenStorySectionLabel(uiLocale, parsed.storyTitle),
      body: storyBody,
      id: "children-story",
    });
  }

  if (parsed.parentReadingTip.trim()) {
    sections.push({
      num: n++,
      title: childrenParentReadingSectionLabel(uiLocale),
      body: parsed.parentReadingTip.trim(),
      id: "children-closing",
    });
  }

  if (sections.length === 0) {
    const fallback = content.trim();
    if (!fallback) return [];
    return [{ num: 1, title: novelChapterBodyLabel(uiLocale), body: fallback, id: "children-fallback" }];
  }

  return sections;
}

export function formatChildrenComicSectionBlock(section: ChildrenComicSection): string {
  return `【${section.title}】\n\n${section.body}`;
}

export function childrenComicSectionToNovelChapter(section: ChildrenComicSection): NovelChapter {
  return {
    num: section.num,
    title: section.title,
    body: section.body,
    id: section.id,
  };
}

export function listChildrenComicScopeOptions(
  content: string,
  uiLocale: AppLocale = "zh-Hans",
): Array<{ num: number; title: string; id: string }> {
  return parseChildrenComicSections(content, uiLocale).map((s) => ({
    num: s.num,
    title: s.title,
    id: s.id,
  }));
}

/** 漫画分镜默认只用「儿童故事」正文，不含创意解读 */
export function findChildrenStoryComicSection(
  content: string,
  uiLocale: AppLocale = "zh-Hans",
): ChildrenComicSection | null {
  return parseChildrenComicSections(content, uiLocale).find((s) => s.id === "children-story") ?? null;
}

export function defaultChildrenComicChapterScope(
  content: string,
  uiLocale: AppLocale = "zh-Hans",
): {
  fromChapter: number;
  toChapter: number;
  label: string;
} | null {
  const story = findChildrenStoryComicSection(content, uiLocale);
  if (!story) return null;
  return {
    fromChapter: story.num,
    toChapter: story.num,
    label: story.title,
  };
}

export function sliceChildrenComicByScope(
  content: string,
  scope?: { fromChapter: number; toChapter: number; label?: string } | null,
  uiLocale: AppLocale = "zh-Hans",
): { content: string; chapters: NovelChapter[]; scopeLabel: string } {
  const sections = parseChildrenComicSections(content, uiLocale);
  const fullBook = comicScopeLabelMessage(uiLocale, "fullBookChildren");
  if (sections.length === 0) {
    return { content: content.trim(), chapters: [], scopeLabel: fullBook };
  }

  if (!scope || sections.length <= 1) {
    const chapters = sections.map(childrenComicSectionToNovelChapter);
    const body = sections.map(formatChildrenComicSectionBlock).join("\n\n");
    return { content: body, chapters, scopeLabel: fullBook };
  }

  const from = Math.max(1, scope.fromChapter);
  const to = Math.max(from, scope.toChapter);
  const picked = sections.filter((s) => s.num >= from && s.num <= to);
  if (picked.length === 0) {
    const chapters = sections.map(childrenComicSectionToNovelChapter);
    const body = sections.map(formatChildrenComicSectionBlock).join("\n\n");
    return { content: body, chapters, scopeLabel: fullBook };
  }

  const chapters = picked.map(childrenComicSectionToNovelChapter);
  const body = picked.map(formatChildrenComicSectionBlock).join("\n\n");
  const scopeLabel =
    scope.label?.trim() ||
    (picked.length === 1 ? picked[0]!.title : picked.map((p) => p.title).join(" + "));

  return { content: body, chapters, scopeLabel };
}
