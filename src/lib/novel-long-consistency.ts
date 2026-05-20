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
}): ConsistencyReport {
  const issues: ConsistencyIssue[] = [];
  const { bible, expectedChapters, segmentText, previousContent } = opts;

  const parsed = parseNovelChapters(segmentText);
  if (parsed.length === 0) {
    issues.push({
      code: "no_chapter_markers",
      message: "本段未解析到「=== 第X章 标题 ===」章节标记",
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
      message: `重复章节号：${[...new Set(dup)].join("、")}`,
      severity: "error",
    });
  }

  const expectedNums = new Set(expectedChapters.map((c) => c.num));
  for (const ch of parsed) {
    if (!expectedNums.has(ch.num)) {
      issues.push({
        code: "unexpected_chapter",
        message: `出现计划外章节第${ch.num}章`,
        severity: "warn",
      });
    }
    if (ch.num <= prevMax) {
      issues.push({
        code: "chapter_rewind",
        message: `第${ch.num}章号不应 ≤ 已写最大章号 ${prevMax}`,
        severity: "error",
      });
    }
  }

  for (const exp of expectedChapters) {
    if (!parsed.some((c) => c.num === exp.num)) {
      issues.push({
        code: "missing_planned_chapter",
        message: `缺少计划章节第${exp.num}章《${exp.title}》`,
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
        message: `本段未出现主要角色「${name}」（前文已登场）`,
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
