import { NOVEL_TITLE_MAX_LEN, clampNovelTitle } from "@/lib/novel-display";

const TITLE_MARK = "【故事标题】";
const BODY_MARK = "【正文】";
const PARENT_MARK = "【家长共读】";

export type ParsedChildrenStoryOutput = {
  storyTitle: string;
  body: string;
  parentReadingTip: string;
};

const CHILDREN_STORY_TITLE_MAX = 12;
const PARENT_TIP_MAX = 20;

export function clampChildrenStoryTitle(raw: string): string {
  const t = raw.trim().replace(/\s+/g, "");
  if (!t) return "未命名";
  return t.length <= CHILDREN_STORY_TITLE_MAX ? t : t.slice(0, CHILDREN_STORY_TITLE_MAX);
}

export function clampParentReadingTip(raw: string): string {
  const t = raw.trim().replace(/\s+/g, "");
  if (!t) return "";
  return t.length <= PARENT_TIP_MAX ? t : t.slice(0, PARENT_TIP_MAX);
}

/** 解析儿童成稿三块格式；失败时尽量从全文兜底 */
export function parseChildrenStoryOutput(raw: string): ParsedChildrenStoryOutput {
  const text = raw.trim();
  if (!text) {
    return { storyTitle: "未命名", body: "", parentReadingTip: "" };
  }

  const titleIdx = text.indexOf(TITLE_MARK);
  const bodyIdx = text.indexOf(BODY_MARK);
  const parentIdx = text.indexOf(PARENT_MARK);

  if (titleIdx >= 0 && bodyIdx > titleIdx) {
    let storyTitle = text.slice(titleIdx + TITLE_MARK.length, bodyIdx).trim();
    storyTitle = storyTitle.split("\n").map((l) => l.trim()).find(Boolean) ?? storyTitle;

    let body = "";
    let parentReadingTip = "";

    if (parentIdx > bodyIdx) {
      body = text.slice(bodyIdx + BODY_MARK.length, parentIdx).trim();
      parentReadingTip = text
        .slice(parentIdx + PARENT_MARK.length)
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .find(Boolean) ?? "";
    } else {
      body = text.slice(bodyIdx + BODY_MARK.length).trim();
    }

    return {
      storyTitle: clampChildrenStoryTitle(storyTitle),
      body: body || text,
      parentReadingTip: clampParentReadingTip(parentReadingTip),
    };
  }

  const lines = text.split("\n");
  const first = lines[0]?.trim() ?? "";
  const storyTitle = clampChildrenStoryTitle(
    first.length <= CHILDREN_STORY_TITLE_MAX + 2 ? first : "未命名",
  );
  return {
    storyTitle,
    body: text,
    parentReadingTip: "",
  };
}

/** 入库书名：儿童标题 ≤12，且不超过全局 15 字上限 */
export function childrenNovelDbTitle(parsedTitle: string, fallbackTitle?: string): string {
  const t = clampChildrenStoryTitle(parsedTitle || fallbackTitle || "未命名");
  return clampNovelTitle(t, NOVEL_TITLE_MAX_LEN);
}
