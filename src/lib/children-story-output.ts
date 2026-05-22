import {
  allChildrenBodyMarks,
  allChildrenClosingMarks,
  allChildrenInterpretMarks,
  CHILDREN_LEGACY_OUTPUT_MARKS,
  getChildrenAgeTier,
  parseChildrenTargetAge,
  type ChildrenTargetAge,
} from "@/lib/children-age-length";
import { NOVEL_TITLE_MAX_LEN, clampNovelTitle } from "@/lib/novel-display";

export type ParsedChildrenStoryOutput = {
  interpretation: string;
  storyTitle: string;
  body: string;
  /** 对应各档 closingMark（启蒙小道理 / 学识感悟等） */
  parentReadingTip: string;
};

const CHILDREN_STORY_TITLE_MAX = 12;

export function clampChildrenStoryTitle(raw: string): string {
  const t = raw.trim().replace(/\s+/g, "");
  if (!t) return "未命名";
  return t.length <= CHILDREN_STORY_TITLE_MAX ? t : t.slice(0, CHILDREN_STORY_TITLE_MAX);
}

export function clampParentReadingTip(raw: string, max = 100): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t.length <= max ? t : t.slice(0, max);
}

export function clampChildrenInterpretation(raw: string, max = 360): string {
  const t = raw.trim();
  if (!t) return "";
  return t.length <= max ? t : t.slice(0, max);
}

function findFirstMarkIndex(text: string, marks: string[]): { mark: string; index: number } | null {
  let best: { mark: string; index: number } | null = null;
  for (const mark of marks) {
    const idx = text.indexOf(mark);
    if (idx >= 0 && (best === null || idx < best.index)) {
      best = { mark, index: idx };
    }
  }
  return best;
}

function sliceSection(text: string, mark: string, endIdx: number): string {
  const start = text.indexOf(mark);
  if (start < 0) return "";
  return text.slice(start + mark.length, endIdx).trim();
}

function extractTitleFromBody(body: string): { storyTitle: string; body: string } {
  const lines = body.split("\n").map((l) => l.trim());
  const first = lines[0] ?? "";
  if (first && first.length <= CHILDREN_STORY_TITLE_MAX + 2 && !first.includes("。") && !first.includes("，")) {
    const rest = lines.slice(1).join("\n").trim();
    return {
      storyTitle: clampChildrenStoryTitle(first),
      body: rest || body,
    };
  }
  return { storyTitle: "未命名", body };
}

/** 解析儿童成稿（分龄标记 + 旧版标记兼容） */
export function parseChildrenStoryOutput(
  raw: string,
  targetAge?: ChildrenTargetAge,
): ParsedChildrenStoryOutput {
  const text = raw.trim();
  if (!text) {
    return { interpretation: "", storyTitle: "未命名", body: "", parentReadingTip: "" };
  }

  const age = targetAge !== undefined ? parseChildrenTargetAge(targetAge) : undefined;
  const tier = age !== undefined ? getChildrenAgeTier(age) : null;
  const interpretMax = tier?.interpretationMax ?? 360;
  const closingMax = tier?.closingMax ?? 100;

  const interpretMarks = allChildrenInterpretMarks();
  const bodyMarks = allChildrenBodyMarks();
  const closingMarks = allChildrenClosingMarks();

  const bodyHit = findFirstMarkIndex(text, bodyMarks);
  const closingHit = findFirstMarkIndex(text, closingMarks);
  const interpretHit = findFirstMarkIndex(text, interpretMarks);

  const titleIdx = text.indexOf(CHILDREN_LEGACY_OUTPUT_MARKS.title);
  const legacyBodyIdx = text.indexOf(CHILDREN_LEGACY_OUTPUT_MARKS.body);

  let interpretation = "";
  if (interpretHit) {
    const end = bodyHit?.index ?? (titleIdx >= 0 ? titleIdx : closingHit?.index ?? text.length);
    interpretation = sliceSection(text, interpretHit.mark, end);
  }

  if (titleIdx >= 0 && legacyBodyIdx > titleIdx) {
    let storyTitle = sliceSection(text, CHILDREN_LEGACY_OUTPUT_MARKS.title, legacyBodyIdx);
    storyTitle = storyTitle.split("\n").map((l) => l.trim()).find(Boolean) ?? storyTitle;
    const parentIdx = text.indexOf(CHILDREN_LEGACY_OUTPUT_MARKS.closing);
    let body = "";
    let parentReadingTip = "";
    if (parentIdx > legacyBodyIdx) {
      body = sliceSection(text, CHILDREN_LEGACY_OUTPUT_MARKS.body, parentIdx);
      parentReadingTip = sliceSection(text, CHILDREN_LEGACY_OUTPUT_MARKS.closing, text.length);
    } else {
      body = sliceSection(text, CHILDREN_LEGACY_OUTPUT_MARKS.body, text.length);
    }
    return {
      interpretation: clampChildrenInterpretation(interpretation, interpretMax),
      storyTitle: clampChildrenStoryTitle(storyTitle),
      body: body || text,
      parentReadingTip: clampParentReadingTip(parentReadingTip, closingMax),
    };
  }

  if (bodyHit) {
    const bodyEnd = closingHit && closingHit.index > bodyHit.index ? closingHit.index : text.length;
    let body = sliceSection(text, bodyHit.mark, bodyEnd);
    let parentReadingTip = "";
    if (closingHit && closingHit.index > bodyHit.index) {
      parentReadingTip = sliceSection(text, closingHit.mark, text.length);
    }
    const { storyTitle, body: bodyRest } = extractTitleFromBody(body);
    return {
      interpretation: clampChildrenInterpretation(interpretation, interpretMax),
      storyTitle,
      body: bodyRest || body,
      parentReadingTip: clampParentReadingTip(parentReadingTip, closingMax),
    };
  }

  const lines = text.split("\n");
  const first = lines[0]?.trim() ?? "";
  const storyTitle = clampChildrenStoryTitle(
    first.length <= CHILDREN_STORY_TITLE_MAX + 2 ? first : "未命名",
  );
  return {
    interpretation: clampChildrenInterpretation(interpretation, interpretMax),
    storyTitle,
    body: text,
    parentReadingTip: "",
  };
}

export function childrenNovelDbTitle(parsedTitle: string, fallbackTitle?: string): string {
  const t = clampChildrenStoryTitle(parsedTitle || fallbackTitle || "未命名");
  return clampNovelTitle(t, NOVEL_TITLE_MAX_LEN);
}
