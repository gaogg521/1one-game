/**
 * 游戏 / 小说 / 漫画 三线独立验收
 * npm run qa:product-lines          — 全部三线（离线为主）
 * npm run qa:product-lines:game     — 仅游戏
 * npm run qa:product-lines:novel    — 仅小说
 * npm run qa:product-lines:comic    — 仅漫画
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type Line = "game" | "novel" | "comic";
type StepResult = { cmd: string; ok: boolean; detail?: string };

const OUT_ROOT = path.join(process.cwd(), "qa-output", "product-lines");
const filter = (process.argv[2] as Line | undefined)?.replace(/^--line=/, "") as Line | undefined;

const LINES: Record<
  Line,
  { label: string; steps: string[]; e2e?: string }
> = {
  game: {
    label: "游戏",
    steps: [
      "npm run qa:user-journey-parity",
      "npm run qa:template-matrix",
      "npm run qa:architecture-parity",
      "npm run qa:director-spec",
      "npm run qa:co-create-loop",
      "npm run qa:generate-stream-agentic",
    ],
    e2e: "npx playwright test e2e/create.smoke.spec.ts e2e/create-play.smoke.spec.ts e2e/templates-handtest.spec.ts --workers=1",
  },
  novel: {
    label: "小说",
    steps: [
      "npm run qa:literary-user-journey",
      "npm run qa:novel-comic-smoke",
      "npm run qa:novel-locale",
    ],
    e2e: "npx playwright test e2e/novel-comic.smoke.spec.ts --grep \"小说模块\" --workers=1",
  },
  comic: {
    label: "漫画",
    steps: [
      "npm run qa:database-url",
      "npm run qa:songliao:artifacts",
      "npm run qa:comic-novel-product-rules",
      "npm run qa:comic-director-pipeline",
      "npm run qa:comic-storyboard-resilience",
      "npm run qa:comic-panel-eta",
      "npm run qa:comic-featured:offline",
    ],
    e2e: "npx playwright test e2e/novel-comic.smoke.spec.ts --grep \"漫画模块\" --workers=1",
  },
};

function run(cmd: string): StepResult {
  try {
    execSync(cmd, { stdio: "pipe", encoding: "utf8", cwd: process.cwd(), env: process.env });
    return { cmd, ok: true };
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    const detail = (err.stderr || err.stdout || err.message || "").trim().slice(0, 500);
    return { cmd, ok: false, detail };
  }
}

async function healthOk(): Promise<boolean> {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";
  try {
    const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function runLine(line: Line) {
  const cfg = LINES[line];
  const results: StepResult[] = [];
  console.log(`\n# ${cfg.label}线 — 离线/HTTP 验收\n`);

  for (const cmd of cfg.steps) {
    const r = run(cmd);
    results.push(r);
    console.log(`${r.ok ? "[OK]" : "[FAIL]"} ${cmd}${r.detail ? `\n  ${r.detail.slice(0, 200)}` : ""}`);
  }

  let e2e: StepResult | null = null;
  if (cfg.e2e && (await healthOk())) {
    console.log(`\n→ E2E (${cfg.label})`);
    e2e = run(cfg.e2e);
    results.push(e2e);
    console.log(`${e2e.ok ? "[OK]" : "[FAIL]"} ${cfg.e2e}${e2e.detail ? `\n  ${e2e.detail.slice(0, 200)}` : ""}`);
  } else if (cfg.e2e) {
    console.log(`\n[SKIP] E2E — dev 未在 ${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888"} 运行`);
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    at: new Date().toISOString(),
    line,
    label: cfg.label,
    pass: failed.length === 0,
    offlineSteps: cfg.steps.length,
    e2eRan: Boolean(e2e),
    results,
  };

  const outDir = path.join(OUT_ROOT, line);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    path.join(outDir, "REPORT.md"),
    [
      `# ${cfg.label}线独立验收`,
      "",
      `- 时间：${summary.at}`,
      `- 结果：**${summary.pass ? "PASS" : "FAIL"}**`,
      `- 离线步骤：${summary.offlineSteps}${summary.e2eRan ? " + E2E" : ""}`,
      "",
      "## 步骤",
      "",
      ...results.map((r) => `- [${r.ok ? "x" : " "}] \`${r.cmd}\`${r.detail ? ` — ${r.detail.slice(0, 120)}` : ""}`),
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(`\n报告：qa-output/product-lines/${line}/REPORT.md`);
  return summary;
}

async function main() {
  const targets: Line[] = filter && filter in LINES ? [filter] : (["game", "novel", "comic"] as Line[]);
  const summaries = [];
  for (const line of targets) {
    summaries.push(await runLine(line));
  }

  fs.mkdirSync(OUT_ROOT, { recursive: true });
  const allPass = summaries.every((s) => s.pass);
  fs.writeFileSync(
    path.join(OUT_ROOT, "summary.json"),
    JSON.stringify({ at: new Date().toISOString(), pass: allPass, lines: summaries }, null, 2),
  );

  console.log("\n--- 三线汇总 ---");
  for (const s of summaries) {
    console.log(`${s.pass ? "OK" : "FAIL"} ${s.label} (${s.line})`);
  }

  if (!allPass) process.exit(1);
  console.log("\nqa:product-lines: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
