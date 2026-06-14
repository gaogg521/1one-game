/**
 * 解析 Godot 矩阵 Playwright JSON，写入单次试玩摘要
 * npm run qa:godot-matrix-summary
 */
import fs from "node:fs";
import path from "node:path";
import { PRODUCT } from "../src/lib/product-config";

const OUT_DIR = path.join(process.cwd(), "qa-output", "godot-matrix");
const JSON_PATH = path.join(OUT_DIR, "playwright-results.json");

type PlaywrightJson = {
  suites?: PlaywrightSuite[];
};

type PlaywrightSuite = {
  title?: string;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
};

type PlaywrightSpec = {
  title?: string;
  tests?: PlaywrightTest[];
};

type PlaywrightTest = {
  results?: Array<{ status?: string; duration?: number }>;
};

export type GodotPlayRow = {
  testId: string;
  title: string;
  templateId: string | null;
  ok: boolean;
  durationMs: number;
};

function walkSuites(suite: PlaywrightSuite, rows: GodotPlayRow[]) {
  for (const spec of suite.specs ?? []) {
    const title = spec.title ?? "unknown";
    const test = spec.tests?.[0];
    const results = test?.results ?? [];
    const ok = results.length > 0 && results.every((r) => r.status === "passed");
    const durationMs = results.reduce((sum, r) => sum + (r.duration ?? 0), 0);
    const templateMatch = title.match(/Godot 标签 · (.+)/);
    rows.push({
      testId: templateMatch?.[1] ?? title.replace(/\s+/g, "-").slice(0, 48),
      title,
      templateId: templateMatch?.[1] ?? (title.includes("Godot") ? "runtime-smoke" : null),
      ok,
      durationMs,
    });
  }
  for (const child of suite.suites ?? []) walkSuites(child, rows);
}

export function parseGodotPlaywrightJson(raw: PlaywrightJson): GodotPlayRow[] {
  const rows: GodotPlayRow[] = [];
  for (const suite of raw.suites ?? []) walkSuites(suite, rows);
  return rows;
}

export function writeGodotMatrixSummary(opts: {
  rows: GodotPlayRow[];
  suiteOk: boolean;
  at?: string;
}) {
  const at = opts.at ?? new Date().toISOString();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const templateRows = opts.rows.filter((r) => r.templateId && r.templateId !== "runtime-smoke");
  const runtimeRow = opts.rows.find((r) => r.templateId === "runtime-smoke");
  const passCount = opts.rows.filter((r) => r.ok).length;

  const summary = {
    at,
    suiteOk: opts.suiteOk,
    passCount,
    total: opts.rows.length,
    runtimeSmoke: runtimeRow ?? null,
    templates: templateRows.map((r) => ({
      templateId: r.templateId,
      ok: r.ok,
      durationMs: r.durationMs,
      title: r.title,
    })),
    supportedTemplates: [...PRODUCT.godot.supportedTemplates],
  };

  fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# Godot 矩阵试玩摘要",
    "",
    `生成时间：${at}`,
    "",
    `- 套件通过：${opts.suiteOk ? "是" : "否"}`,
    `- 用例：${passCount}/${opts.rows.length} 通过`,
    "",
    "## 运行时冒烟",
    "",
    runtimeRow
      ? `| ${runtimeRow.title} | ${runtimeRow.ok ? "✅" : "❌"} | ${(runtimeRow.durationMs / 1000).toFixed(1)}s |`
      : "| — | — | — |",
    "",
    "## 模板矩阵",
    "",
    "| 模板 | 状态 | 耗时 |",
    "|------|------|------|",
    ...templateRows.map(
      (r) => `| ${r.templateId} | ${r.ok ? "✅" : "❌"} | ${(r.durationMs / 1000).toFixed(1)}s |`,
    ),
    "",
    `注册模板数：${PRODUCT.godot.supportedTemplates.length}`,
    "",
  ].join("\n");

  fs.writeFileSync(path.join(OUT_DIR, "REPORT.md"), md, "utf8");
  return summary;
}

function main() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`[FAIL] missing ${path.relative(process.cwd(), JSON_PATH)} — run Godot matrix E2E first`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(JSON_PATH, "utf8")) as PlaywrightJson;
  const rows = parseGodotPlaywrightJson(raw);
  const summary = writeGodotMatrixSummary({ rows, suiteOk: rows.every((r) => r.ok) });
  console.log(`[OK] qa:godot-matrix-summary — ${summary.passCount}/${summary.total} passed`);
  console.log(`     → ${path.relative(process.cwd(), path.join(OUT_DIR, "REPORT.md"))}`);
  if (!summary.suiteOk) process.exit(1);
}

if (process.argv[1]?.includes("qa-godot-matrix-summary")) {
  main();
}
