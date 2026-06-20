/**
 * 漫画长篇一致性审计报告
 * 汇总所有一致性检查结果，生成可视化审计报告
 */

import type { ComicPage } from "@/lib/comic-format";
import type { ComicDirectorPack } from "@/lib/comic-director-types";
import type { ComicConsistencyIssue } from "@/lib/comic-panel-consistency";

export type ComicConsistencyAuditReport = {
  docId: string;
  generatedAt: string;
  totalPages: number;
  totalPanels: number;
  pipeline: "long_director" | "light" | "emergency";

  issues: ComicConsistencyIssue[];
  issuesByPage: Map<number, ComicConsistencyIssue[]>;
  issueSummary: {
    errorCount: number;
    warnCount: number;
    criticalPages: number[];
  };

  // 采样相邻页对的一致性检查
  sampledAdjacentPairsOk: number;
  sampledAdjacentPairsTotal: number;

  overallHealth: "ok" | "warning" | "error";
  recommendations: string[];
};

/**
 * 采样相邻页对进行一致性检查（用于高级审计）
 */
function sampleAdjacentPagePairs(pages: ComicPage[], sampleRate: number = 0.2): Array<[ComicPage, ComicPage]> {
  const pairs: Array<[ComicPage, ComicPage]> = [];
  const interval = Math.max(1, Math.floor(1 / sampleRate));

  for (let i = 0; i < pages.length - 1; i += interval) {
    pairs.push([pages[i]!, pages[i + 1]!]);
  }
  return pairs;
}

/**
 * 基础相邻页对一致性检查（仅检查角色连续性）
 */
function checkPagePairConsistency(p1: ComicPage, p2: ComicPage): boolean {
  const panel1 = p1.panels[p1.panels.length - 1] as any;
  const panel2 = p2.panels[0] as any;

  if (!panel1 || !panel2) return true;

  const chars1 = new Set((panel1.characterIds ?? []) as string[]);
  const chars2 = new Set((panel2.characterIds ?? []) as string[]);

  // 如果两页都没有角色信息，认为一致
  if (chars1.size === 0 || chars2.size === 0) return true;

  // 检查是否有角色连续
  for (const c of chars1) {
    if (chars2.has(c)) return true;
  }
  return false;
}

/**
 * 生成漫画一致性审计报告
 */
export function generateComicConsistencyAuditReport(opts: {
  docId: string;
  pages: ComicPage[];
  director?: ComicDirectorPack | null;
  issues: ComicConsistencyIssue[];
  pipeline: "long_director" | "light" | "emergency";
}): ComicConsistencyAuditReport {
  const totalPanels = opts.pages.reduce((n, p) => n + p.panels.length, 0);
  const issuesByPage = new Map<number, ComicConsistencyIssue[]>();

  // 按页码分组问题
  for (const issue of opts.issues) {
    const page = issue.scene ?? 0;
    if (!issuesByPage.has(page)) {
      issuesByPage.set(page, []);
    }
    issuesByPage.get(page)!.push(issue);
  }

  // 统计问题
  const errorCount = opts.issues.filter((i) => i.severity === "error").length;
  const warnCount = opts.issues.filter((i) => i.severity === "warn").length;
  const criticalPages = Array.from(issuesByPage.entries())
    .filter(([_, issues]) => issues.some((i) => i.severity === "error"))
    .map(([page]) => page);

  // 采样相邻页对一致性检查
  const samplePairs = sampleAdjacentPagePairs(opts.pages, 0.3);
  let sampledOk = 0;
  for (const [p1, p2] of samplePairs) {
    if (checkPagePairConsistency(p1, p2)) sampledOk++;
  }

  // 生成建议
  const recommendations: string[] = [];
  if (errorCount > 0) {
    recommendations.push(`✗ 修复 ${errorCount} 个错误（角色/场景 ID 缺失或无效）`);
  }
  if (warnCount > 0 && opts.pipeline === "light") {
    recommendations.push(`⚠️ 轻量管线生成 - 建议用导演包模式重试提升一致性`);
  }
  if (sampledOk < samplePairs.length * 0.7) {
    recommendations.push(
      `⚠️ ${Math.round(((samplePairs.length - sampledOk) / samplePairs.length) * 100)}% 的相邻页对存在视觉断裂，建议审查`,
    );
  }
  if (opts.pipeline === "emergency") {
    recommendations.push(`⚠️ 紧急降级生成 - 已保证基本可读，但强烈建议重新生成`);
  }
  if (recommendations.length === 0 && errorCount === 0 && warnCount === 0) {
    recommendations.push("✓ 一致性检查通过，质量达标");
  }

  const overallHealth: "ok" | "warning" | "error" =
    errorCount > 0 ? "error" : warnCount > 0 ? "warning" : "ok";

  return {
    docId: opts.docId,
    generatedAt: new Date().toISOString(),
    totalPages: opts.pages.length,
    totalPanels,
    pipeline: opts.pipeline,
    issues: opts.issues,
    issuesByPage,
    issueSummary: { errorCount, warnCount, criticalPages },
    sampledAdjacentPairsOk: sampledOk,
    sampledAdjacentPairsTotal: samplePairs.length,
    overallHealth,
    recommendations,
  };
}

/**
 * 将审计报告格式化为人类可读的文本
 */
export function formatComicConsistencyAuditReportAsText(report: ComicConsistencyAuditReport): string {
  const healthIcon = report.overallHealth === "ok" ? "✓" : report.overallHealth === "warning" ? "⚠️" : "✗";

  const lines = [
    "═══════════════════════════════════════",
    "漫画一致性审计报告",
    "═══════════════════════════════════════",
    "",
    `${healthIcon} 整体评分：${report.overallHealth.toUpperCase()}`,
    `生成时间：${new Date(report.generatedAt).toLocaleString("zh-Hans")}`,
    `文档 ID：${report.docId}`,
    "",
    "基本统计",
    "─────────────────────────────────────",
    `总页数：${report.totalPages}`,
    `总分镜数：${report.totalPanels}`,
    `生成管线：${report.pipeline}`,
    "",
    "一致性问题",
    "─────────────────────────────────────",
    `❌ 错误：${report.issueSummary.errorCount}`,
    `⚠️  警告：${report.issueSummary.warnCount}`,
    `严重页：${report.issueSummary.criticalPages.length > 0 ? report.issueSummary.criticalPages.join(", ") : "无"}`,
    "",
    "相邻页检查",
    "─────────────────────────────────────",
    `采样对数：${report.sampledAdjacentPairsTotal}`,
    `一致性通过：${report.sampledAdjacentPairsOk}/${report.sampledAdjacentPairsTotal}`,
    `通过率：${Math.round((report.sampledAdjacentPairsOk / report.sampledAdjacentPairsTotal) * 100)}%`,
    "",
    "改进建议",
    "─────────────────────────────────────",
    ...report.recommendations.map((r) => `• ${r}`),
    "",
    "═══════════════════════════════════════",
  ];

  return lines.join("\n");
}

/**
 * 获取审计报告的简短摘要（用于日志或进度显示）
 */
export function getAuditReportSummary(report: ComicConsistencyAuditReport): string {
  return `[${report.overallHealth.toUpperCase()}] 错误${report.issueSummary.errorCount} 警告${report.issueSummary.warnCount} 采样通过${report.sampledAdjacentPairsOk}/${report.sampledAdjacentPairsTotal}`;
}
