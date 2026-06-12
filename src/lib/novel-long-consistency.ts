import type { AppLocale } from "@/i18n/routing";
import { novelConsistencyMessage } from "@/lib/i18n/progress-message";
import { parseNovelChapters } from "@/lib/novel-chapters";
import type { ChapterPlanItem, NovelBible } from "@/lib/novel-long-pipeline-types";

export type ConsistencyIssue = {
  code: string;
  message: string;
  severity: "warn" | "error";
};

export type ConsistencyReport = {
  ok: boolean;
  issues: ConsistencyIssue[];
};

/** 规则 + 轻量启发：章号连续、重复章、计划章缺失、主要人名漂移。 */
export function checkSegmentConsistency(opts: {
  bible: NovelBible;
  expectedChapters: ChapterPlanItem[];
  segmentText: string;
  previousContent: string;
  uiLocale?: AppLocale;
}): ConsistencyReport {
  const issues: ConsistencyIssue[] = [];
  const { bible, expectedChapters, segmentText, previousContent } = opts;
  const uiLocale = opts.uiLocale ?? "zh-Hans";
  const msg = (key: string, params?: Record<string, string | number>) =>
    novelConsistencyMessage(uiLocale, key, params);
  const listSep = uiLocale.startsWith("zh") ? "、" : ", ";

  const parsed = parseNovelChapters(segmentText);
  if (parsed.length === 0) {
    issues.push({
      code: "no_chapter_markers",
      message: msg("noChapterMarkers"),
      severity: "error",
    });
    return { ok: false, issues };
  }

  const prev = parseNovelChapters(previousContent);
  const prevMax = prev.length > 0 ? Math.max(...prev.map((c) => c.num)) : 0;
  const nums = parsed.map((c) => c.num);
  const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
  if (dup.length > 0) {
    issues.push({
      code: "duplicate_chapter_num",
      message: msg("duplicateChapterNum", { nums: [...new Set(dup)].join(listSep) }),
      severity: "error",
    });
  }

  const expectedNums = new Set(expectedChapters.map((c) => c.num));
  for (const ch of parsed) {
    if (!expectedNums.has(ch.num)) {
      issues.push({
        code: "unexpected_chapter",
        message: msg("unexpectedChapter", { num: ch.num }),
        severity: "warn",
      });
    }
    if (ch.num <= prevMax) {
      issues.push({
        code: "chapter_rewind",
        message: msg("chapterRewind", { num: ch.num, prevMax }),
        severity: "error",
      });
    }
  }

  for (const exp of expectedChapters) {
    if (!parsed.some((c) => c.num === exp.num)) {
      issues.push({
        code: "missing_planned_chapter",
        message: msg("missingPlannedChapter", { num: exp.num, title: exp.title }),
        severity: "warn",
      });
    }
  }

  const mainNames = bible.characters
    .map((c) => c.name.trim())
    .filter((n) => n.length >= 2 && n !== "主角" && n !== "对手");
  const body = segmentText;
  for (const name of mainNames.slice(0, 5)) {
    if (previousContent.includes(name) && !body.includes(name)) {
      issues.push({
        code: "character_absent_in_segment",
        message: msg("characterAbsentInSegment", { name }),
        severity: "warn",
      });
    }
  }

  const hasError = issues.some((i) => i.severity === "error");
  return { ok: !hasError, issues };
}

export function formatConsistencyIssues(issues: ConsistencyIssue[]): string {
  if (issues.length === 0) return "";
  return issues.map((i) => `[${i.severity}] ${i.message}`).join("\n");
}
