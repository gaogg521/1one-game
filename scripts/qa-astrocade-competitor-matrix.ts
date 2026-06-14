/**
 * Astrocade 竞品架构对照矩阵 + 运行时断言
 * npm run qa:astrocade-competitor-matrix
 * 报告：qa-output/astrocade-competitor-matrix.md
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildCompetitorArchitectureRows,
  runCompetitorArchitectureChecks,
  summarizeCompetitorReport,
} from "../src/lib/astrocade-competitor-matrix";

function statusIcon(s: string): string {
  if (s === "aligned") return "✅";
  if (s === "partial") return "⚠️";
  return "❌";
}

function main() {
  console.log("# qa:astrocade-competitor-matrix — 竞品架构对照\n");

  const rows = buildCompetitorArchitectureRows();
  const summary = summarizeCompetitorReport(rows);
  const checks = runCompetitorArchitectureChecks();

  for (const r of rows) {
    console.log(`${statusIcon(r.status)} ${r.pillar}`);
    console.log(`   竞品: ${r.astrocade}`);
    console.log(`   我们: ${r.ourDesign}`);
    console.log(`   证据: ${r.evidence}`);
    if (r.qa) console.log(`   QA: ${r.qa}`);
    console.log("");
  }

  console.log(`汇总: aligned=${summary.aligned} partial=${summary.partial} gap=${summary.gaps}\n`);

  if (summary.promptParity) {
    const p = summary.promptParity;
    console.log(
      `同 prompt 路由: Scene ${p.sceneAligned}/${p.total} · template ${p.templateAligned}/${p.total} · agentic leak ${p.userAgenticLeaks}\n`,
    );
  }

  console.log("## 平台级竞品差距（已闭合项见 aligned 支柱；剩余为产品策略非 blockers）");
  console.log("  · 非样品 prompt 走 template 族默认（Astrocade 同款：非 demo prompt 无 per-game 脚本）");
  console.log("  · Primary 为 template 族 Scene，非竞品每款独立 JS 仓库");
  console.log("  · 精品 demo 绝对视觉密度仍可继续迭代\n");

  if (!checks.ok) {
    console.error("[FAIL] 架构断言:");
    for (const f of checks.failures) console.error(`  · ${f}`);
    process.exit(1);
  }
  console.log("[OK] 架构运行时断言通过");

  const md = [
    "# Astrocade 竞品架构对照",
    "",
    `生成时间: ${summary.at}`,
    "",
    `| 状态 | 支柱 | 竞品 (Astrocade) | 本平台 | 证据 | QA |`,
    `| --- | --- | --- | --- | --- | --- |`,
    ...rows.map(
      (r) =>
        `| ${statusIcon(r.status)} ${r.status} | ${r.pillar} | ${r.astrocade} | ${r.ourDesign} | ${r.evidence} | ${r.qa ?? "-"} |`,
    ),
    "",
    `**汇总**: aligned ${summary.aligned} · partial ${summary.partial} · gap ${summary.gaps}`,
    "",
    summary.promptParity
      ? `**同 prompt 路由**: Scene ${summary.promptParity.sceneAligned}/${summary.promptParity.total} · template ${summary.promptParity.templateAligned}/${summary.promptParity.total}`
      : "",
    "",
    "## 平台级竞品差距（已闭合项见 aligned 支柱；剩余为产品策略非 blockers）",
    "",
    "1. 非样品 prompt 走 template 族默认（与 Astrocade 非 demo 描述一致）",
    "2. Primary 为 template 族 Scene，非竞品每款独立 JS 仓库",
    "3. 精品 demo 绝对视觉密度可持续迭代",
    "",
    "## 平台不变量",
    "",
    ...rows
      .filter((r) => r.status === "aligned")
      .map((r) => `- ${r.pillar}`),
    "",
  ].join("\n");

  const outDir = path.join(process.cwd(), "qa-output");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "astrocade-competitor-matrix.md"), md);
  console.log("[OK] report → qa-output/astrocade-competitor-matrix.md");
}

main();
