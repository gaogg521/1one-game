import {
  allChildrenBodyMarks,
  allChildrenClosingMarks,
  allChildrenInterpretMarks,
} from "@/lib/children-age-length";
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
export function parseChildrenComicSections(content: string): ChildrenComicSection[] {
  const parsed = parseChildrenStoryOutput(content);
  const sections: ChildrenComicSection[] = [];
  let n = 1;

  if (parsed.interpretation.trim()) {
    sections.push({
      num: n++,
      title: "创意解读",
      body: parsed.interpretation.trim(),
      id: "children-interpret",
    });
  }

  const storyBody = parsed.body.trim();
  if (storyBody) {
    const storyTitle =
      parsed.storyTitle && parsed.storyTitle !== "未命名" ? `·${parsed.storyTitle}` : "";
    sections.push({
      num: n++,
      title: `儿童故事${storyTitle}`,
      body: storyBody,
      id: "children-story",
    });
  }

  if (parsed.parentReadingTip.trim()) {
    sections.push({
      num: n++,
      title: "亲子共读",
      body: parsed.parentReadingTip.trim(),
      id: "children-closing",
    });
  }

  if (sections.length === 0) {
    const fallback = content.trim();
    if (!fallback) return [];
    return [{ num: 1, title: "正文", body: fallback, id: "children-fallback" }];
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
): Array<{ num: number; title: string }> {
  return parseChildrenComicSections(content).map((s) => ({
    num: s.num,
    title: s.title,
  }));
}

/** 漫画分镜默认只用「儿童故事」正文，不含创意解读 */
export function findChildrenStoryComicSection(
  content: string,
): ChildrenComicSection | null {
  return parseChildrenComicSections(content).find((s) => s.id === "children-story") ?? null;
}

export function defaultChildrenComicChapterScope(content: string): {
  fromChapter: number;
  toChapter: number;
  label: string;
} | null {
  const story = findChildrenStoryComicSection(content);
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
): { content: string; chapters: NovelChapter[]; scopeLabel: string } {
  const sections = parseChildrenComicSections(content);
  if (sections.length === 0) {
    return { content: content.trim(), chapters: [], scopeLabel: "全书" };
  }

  if (!scope || sections.length <= 1) {
    const chapters = sections.map(childrenComicSectionToNovelChapter);
    const body = sections.map(formatChildrenComicSectionBlock).join("\n\n");
    return { content: body, chapters, scopeLabel: "全书" };
  }

  const from = Math.max(1, scope.fromChapter);
  const to = Math.max(from, scope.toChapter);
  const picked = sections.filter((s) => s.num >= from && s.num <= to);
  if (picked.length === 0) {
    const chapters = sections.map(childrenComicSectionToNovelChapter);
    const body = sections.map(formatChildrenComicSectionBlock).join("\n\n");
    return { content: body, chapters, scopeLabel: "全书" };
  }

  const chapters = picked.map(childrenComicSectionToNovelChapter);
  const body = picked.map(formatChildrenComicSectionBlock).join("\n\n");
  const scopeLabel =
    scope.label?.trim() ||
    (picked.length === 1 ? picked[0]!.title : picked.map((p) => p.title).join(" + "));

  return { content: body, chapters, scopeLabel };
}
