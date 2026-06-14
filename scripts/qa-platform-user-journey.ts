/**
 * 平台级 PM 用户主路径（游戏 + 小说/漫画 离线验收汇总）
 * npm run qa:platform-user-journey
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "qa-output", "platform-user-journey");

function run(name: string, cmd: string) {
  console.log(`\n→ ${name}`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
}

function readSummary(subdir: string): Record<string, unknown> | null {
  const p = path.join(process.cwd(), "qa-output", subdir, "summary.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
}

function main() {
  console.log("\n# qa:platform-user-journey — 三模块 PM 汇总\n");

  run("游戏用户故事", "npm run qa:user-journey-parity");
  run("文学用户故事", "npm run qa:literary-user-journey");
  run("文学产品规则", "npm run qa:comic-novel-product-rules");
  run("/start 分流", "npm run qa:start-intake");

  const game = readSummary("user-journey-parity");
  const literary = readSummary("literary-user-journey");

  fs.mkdirSync(OUT, { recursive: true });
  const at = new Date().toISOString();
  const summary = {
    at,
    pass: true,
    modules: {
      game: game ?? { note: "missing summary" },
      literary: literary ?? { note: "missing summary" },
    },
    e2e: "npx playwright test e2e/platform-user-journey.smoke.spec.ts e2e/platform-user-journey.en.spec.ts e2e/platform-user-journey.ms-th.spec.ts e2e/platform-user-journey.zh-hant.spec.ts",
  };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# 平台 PM 用户主路径（汇总）",
    "",
    `生成时间：${at}`,
    "",
    "## 模块",
    "",
    "| 模块 | 离线 QA | E2E |",
    "|------|---------|-----|",
    "| 游戏 | `qa:user-journey-parity` | 样品馆 start/create prefill · parity 信任条 |",
    "| 小说 | `qa:literary-user-journey` story1 | 完成页改编 CTA |",
    "| 漫画 | story2–6 + product-rules | 改编信任条 · ?adaptComic=1 |",
    "| 统一入口 | `qa:start-intake` | 样品→游戏 · `/start?prefill=` · 小说/漫画 prefill |",
    "",
    "## 游戏",
    "",
    `- 同 prompt：${game?.story1Ok ?? "?"}/${game?.story1Total ?? "?"} OK`,
    "",
    "## 文学",
    "",
    `- 用户故事：${literary?.pass === false ? "有失败" : "全部通过"}`,
    "",
    "## E2E",
    "",
    "```bash",
    "npx playwright test e2e/platform-user-journey.smoke.spec.ts",
    "npx playwright test e2e/platform-user-journey.en.spec.ts",
    "npx playwright test e2e/platform-user-journey.ms-th.spec.ts",
    "npx playwright test e2e/platform-user-journey.zh-hant.spec.ts",
    "```",
    "",
    "## 归档",
    "",
    "运行 `npm run qa:regression-archive` 将 competitor-parity / gates / PM 报告快照到 `qa-output/regression-archive/`。",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "REPORT.md"), md, "utf8");

  console.log(`\n报告：${path.relative(process.cwd(), path.join(OUT, "REPORT.md"))}`);

  console.log("\n→ 回归归档");
  execSync("npm run qa:regression-archive", { stdio: "inherit", cwd: process.cwd() });

  console.log("[OK] qa:platform-user-journey");
}

main();
