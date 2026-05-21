import { childrenMaxCharsForAge, parseChildrenTargetAge, type ChildrenTargetAge } from "@/lib/children-age-length";
import {
  childrenNovelDbTitle,
  parseChildrenStoryOutput,
  type ParsedChildrenStoryOutput,
} from "@/lib/children-story-output";
import { truncateNovelToMaxChars } from "@/lib/novel-chapters";

export function finalizeChildrenNovelContent(
  raw: string,
  opts: { targetAge: ChildrenTargetAge; fallbackTitle?: string },
): ParsedChildrenStoryOutput & { dbTitle: string } {
  const max = childrenMaxCharsForAge(parseChildrenTargetAge(opts.targetAge));
  const parsed = parseChildrenStoryOutput(raw);
  const body = truncateNovelToMaxChars(parsed.body, max + 50);
  const storyTitle = parsed.storyTitle || opts.fallbackTitle || "未命名";
  return {
    storyTitle,
    body,
    parentReadingTip: parsed.parentReadingTip,
    dbTitle: childrenNovelDbTitle(storyTitle, opts.fallbackTitle),
  };
}
