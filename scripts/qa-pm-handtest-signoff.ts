/**
 * 六模板 + 竞品样品 PM 签收自动化（结构/事件/Scene 离线总验）
 * npm run qa:pm-handtest-signoff
 *
 * 输出：qa-output/pm-handtest-signoff/REPORT.md
 * 说明：章节横幅动效/手感仍建议 PM 可选肉眼抽测；本脚本覆盖全部可自动化项。
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "qa-output", "pm-handtest-signoff");

const STEPS: { name: string; cmd: string }[] = [
  { name: "六模板 mock + director + systems", cmd: "npm run qa:template-matrix" },
  { name: "Director 保底事件", cmd: "npm run qa:director-spec" },
  { name: "Refinement 日志", cmd: "npm run qa:refinement-log" },
  { name: "共创闭环", cmd: "npm run qa:co-create-loop" },
  { name: "17 款竞品 clone 断言", cmd: "npm run qa:competitor-clone-checks-offline" },
  { name: "B 档 smoke", cmd: "npm run qa:b-tier-smoke" },
];

function runStep(cmd: string): { ok: boolean; detail?: string } {
  try {
    execSync(cmd, { stdio: "pipe", encoding: "utf8" });
    return { ok: true };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, detail: (err.stderr || err.stdout || err.message || "").slice(0, 400) };
  }
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const rows: { name: string; ok: boolean; detail?: string }[] = [];

  for (const step of STEPS) {
    process.stdout.write(`→ ${step.name} … `);
    const r = runStep(step.cmd);
    rows.push({ name: step.name, ...r });
    console.log(r.ok ? "OK" : "FAIL");
  }

  const passCount = rows.filter((r) => r.ok).length;
  const pass = passCount === rows.length;

  const report = [
    "# PM 手测签收 · 自动化覆盖",
    "",
    `- 时间：${new Date().toISOString()}`,
    `- 结果：**${passCount}/${rows.length}** ${pass ? "✅ 可签收（自动化项）" : "❌ 有失败项"}`,
    "",
    "| 检查项 | 结果 |",
    "|--------|------|",
    ...rows.map((r) => `| ${r.name} | ${r.ok ? "✅" : "❌"} |`),
    "",
    "## 说明",
    "",
    "- **已覆盖**：六模板结构、director 事件、共创闭环、17 款竞品 Scene/profile 断言。",
    "- **可选肉眼**：章节横幅动效、胜负手感（见 `B_TEMPLATE_HANDTEST_MATRIX.md`）。",
    "- **E2E 补充**：`e2e/templates-handtest.spec.ts`（需 dev @8888）。",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(OUT, "REPORT.md"), report, "utf8");
  fs.writeFileSync(
    path.join(OUT, "summary.json"),
    JSON.stringify({ at: new Date().toISOString(), passCount, total: rows.length, pass, rows }, null, 2),
    "utf8",
  );

  console.log(`\npm-handtest-signoff: ${passCount}/${rows.length} → qa-output/pm-handtest-signoff/REPORT.md`);
  if (!pass) process.exit(1);
  console.log("qa:pm-handtest-signoff: ok");
}

main();
