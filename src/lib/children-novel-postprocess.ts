import type { AppLocale } from "@/i18n/routing";
import { childrenUnnamedLabel, isUntitledLabel } from "@/lib/i18n/chapter-labels";
import { stripChildrenChapterMarkers } from "@/lib/children-body-normalize";
import {
  childrenCoreSubjectFromUserPrompt,
  isChildrenTitleOffTopic,
  resolveChildrenInputKind,
} from "@/lib/children-source-fidelity";
import {
  childrenMaxCharsForAge,
  childrenMinCharsForAge,
  parseChildrenTargetAge,
  type ChildrenTargetAge,
} from "@/lib/children-age-length";
import { formatChildrenPublishedContent } from "@/lib/children-novel-creative";
import {
  childrenNovelDbTitle,
  parseChildrenStoryOutput,
  type ParsedChildrenStoryOutput,
} from "@/lib/children-story-output";
import { truncateNovelToMaxChars } from "@/lib/novel-chapters";

function resolveChildrenStoryTitle(
  parsedTitle: string,
  uiLocale: AppLocale,
  userPrompt?: string,
  fallbackTitle?: string,
): string {
  const parsed = parsedTitle?.trim();
  const core = userPrompt ? childrenCoreSubjectFromUserPrompt(userPrompt) : "";
  const kind = userPrompt ? resolveChildrenInputKind(userPrompt) : "daily_phrase";
  const unnamed = childrenUnnamedLabel(uiLocale);

  if (userPrompt && isChildrenTitleOffTopic(userPrompt, parsed || unnamed, kind)) {
    return core.slice(0, 12) || fallbackTitle || unnamed;
  }
  if (parsed && !isUntitledLabel(parsed)) return parsed;
  if (core.length >= 2) return core.slice(0, 12);
  return fallbackTitle || unnamed;
}

export function finalizeChildrenNovelContent(
  raw: string,
  opts: {
    targetAge: ChildrenTargetAge;
    fallbackTitle?: string;
    userPrompt?: string;
    uiLocale?: AppLocale;
  },
): ParsedChildrenStoryOutput & { dbTitle: string; publishedContent: string } {
  const uiLocale = opts.uiLocale ?? "zh-Hans";
  const age = parseChildrenTargetAge(opts.targetAge);
  const max = childrenMaxCharsForAge(age);
  const parsed = parseChildrenStoryOutput(raw, age, uiLocale);
  let body = stripChildrenChapterMarkers(parsed.body.trim());
  if (body.length > max + 20) {
    body = truncateNovelToMaxChars(body, max + 20);
  }
  const storyTitle = resolveChildrenStoryTitle(
    parsed.storyTitle,
    uiLocale,
    opts.userPrompt,
    opts.fallbackTitle,
  );
  const interpretation = parsed.interpretation;
  const parentReadingTip = parsed.parentReadingTip;
  return {
    interpretation,
    storyTitle,
    body,
    parentReadingTip,
    dbTitle: childrenNovelDbTitle(storyTitle, opts.fallbackTitle, uiLocale),
    publishedContent: formatChildrenPublishedContent(
      interpretation,
      body,
      parentReadingTip,
      age,
    ),
  };
}

/** 供验收：正文是否落在档位区间内（允许略超上限 20 字） */
export function childrenBodyWithinTier(body: string, age: ChildrenTargetAge): boolean {
  const len = body.trim().length;
  const max = childrenMaxCharsForAge(age) + 20;
  return len >= childrenMinCharsForAge(age) && len <= max;
}
