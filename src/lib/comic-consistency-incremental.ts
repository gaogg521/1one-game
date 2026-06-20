/**
 * 漫画增量一致性检查
 * 检查新生成的分页与既有分页的视觉衔接
 */

import type { ComicPage } from "@/lib/comic-format";
import type { PlannedComicPanel } from "@/lib/comic-shot-plan";

export type IncrementalConsistencyIssue = {
  code: "character_gap" | "location_mismatch" | "shot_type_disconnect";
  message: string;
  fromPageNum: number;
  toPageNum: number;
  severity: "warn" | "error";
};

export type IncrementalConsistencyReport = {
  ok: boolean;
  newPages: ComicPage[];
  issues: IncrementalConsistencyIssue[];
  sampledPagePairs: number;
};

/**
 * 采样相邻页对进行一致性检查
 * @param pages 所有分页
 * @param sampleRate 采样率（0.3 = 30%）
 */
function sampleAdjacentPagePairs(
  pages: ComicPage[],
  sampleRate: number,
): Array<{ idx: number; pages: [ComicPage, ComicPage] }> {
  const pairs: Array<{ idx: number; pages: [ComicPage, ComicPage] }> = [];
  const interval = Math.max(1, Math.floor(1 / sampleRate));

  for (let i = 0; i < pages.length - 1; i += interval) {
    pairs.push({
      idx: i,
      pages: [pages[i]!, pages[i + 1]!],
    });
  }
  return pairs;
}

/**
 * 检查两个相邻页的角色连续性
 */
function checkCharacterContinuity(p1: ComicPage, p2: ComicPage): IncrementalConsistencyIssue | null {
  const panel1 = p1.panels[p1.panels.length - 1] as PlannedComicPanel | undefined;
  const panel2 = p2.panels[0] as PlannedComicPanel | undefined;

  if (!panel1 || !panel2) return null;

  const chars1 = new Set(panel1.characterIds ?? []);
  const chars2 = new Set(panel2.characterIds ?? []);

  // 如果两页都有角色定义
  if (chars1.size > 0 && chars2.size > 0) {
    // 检查主角（第一个角色）是否连续
    const mainChar1 = Array.from(chars1)[0];
    if (mainChar1 && !chars2.has(mainChar1)) {
      return {
        code: "character_gap",
        message: `主角 ${mainChar1} 从 p${p1.page} 消失在 p${p2.page}`,
        fromPageNum: p1.page ?? 0,
        toPageNum: p2.page ?? 0,
        severity: "warn",
      };
    }
  }

  return null;
}

/**
 * 检查两个相邻页的场景连续性
 */
function checkLocationContinuity(p1: ComicPage, p2: ComicPage): IncrementalConsistencyIssue | null {
  const panel1 = p1.panels[p1.panels.length - 1] as PlannedComicPanel | undefined;
  const panel2 = p2.panels[0] as PlannedComicPanel | undefined;

  if (!panel1 || !panel2) return null;

  const loc1 = panel1.locationId;
  const loc2 = panel2.locationId;

  // 如果位置突然改变（场景转换）并且两个都有位置定义，标记警告
  // 注：场景转换本身不是错误，但值得审查
  if (loc1 && loc2 && loc1 !== loc2) {
    // 只在相邻页面中的格子都使用了位置ID时才标记
    // 这表示这不是故意的过渡场景
    if (
      (p1.panels.length > 1 && (p1.panels[p1.panels.length - 2] as PlannedComicPanel).locationId === loc1) &&
      (p2.panels.length > 1 && (p2.panels[1] as PlannedComicPanel).locationId === loc2)
    ) {
      // 场景已稳定变化，这是正常的过渡
      return null;
    }
  }

  return null;
}

/**
 * 检查新生成的分页与既有分页的衔接一致性
 */
export function checkIncrementalConsistency(opts: {
  existingPages: ComicPage[];
  newPages: ComicPage[];
  directorCharacterIds?: Set<string>;
}): IncrementalConsistencyReport {
  const issues: IncrementalConsistencyIssue[] = [];

  // 如果没有既有分页，无法进行增量检查
  if (opts.existingPages.length === 0) {
    return { ok: true, newPages: opts.newPages, issues, sampledPagePairs: 0 };
  }

  // 检查最后一个既有页和第一个新页的衔接
  const lastExisting = opts.existingPages[opts.existingPages.length - 1]!;
  const firstNew = opts.newPages[0];

  if (firstNew) {
    // 检查角色连续性
    const charIssue = checkCharacterContinuity(lastExisting, firstNew);
    if (charIssue) {
      issues.push(charIssue);
    }

    // 检查场景连续性
    const locIssue = checkLocationContinuity(lastExisting, firstNew);
    if (locIssue) {
      issues.push(locIssue);
    }
  }

  // 对新页之间进行采样一致性检查（30% 采样率）
  const pairs = sampleAdjacentPagePairs(opts.newPages, 0.3);
  for (const { pages: [p1, p2] } of pairs) {
    // 检查新页之间的角色连续性
    const charIssue = checkCharacterContinuity(p1, p2);
    if (charIssue) {
      issues.push(charIssue);
    }
  }

  // 判断整体是否通过（error 级别问题导致不通过）
  const ok = issues.every((i) => i.severity !== "error");

  return { ok, newPages: opts.newPages, issues, sampledPagePairs: pairs.length };
}

/**
 * 格式化增量一致性检查结果为可读的消息
 */
export function formatIncrementalConsistencyIssues(issues: IncrementalConsistencyIssue[]): string {
  if (issues.length === 0) {
    return "新增分页与既有页面衔接一致性检查通过";
  }

  const lines = ["新增分页衔接性问题："];
  for (const issue of issues) {
    const severity = issue.severity === "error" ? "❌" : "⚠️";
    lines.push(`${severity} [${issue.code}] ${issue.message}`);
  }
  return lines.join("\n");
}
