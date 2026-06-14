/**
 * 归档竞品 strict parity / 平台 PM / 架构矩阵报告快照（供定期回归对比）
 * npm run qa:regression-archive
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "qa-output");
const ARCHIVE = path.join(ROOT, "regression-archive");

type Snap = {
  label: string;
  relPath: string;
  exists: boolean;
  pass?: boolean | null;
  note?: string;
};

function stampDir(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function copyIfExists(src: string, dest: string): boolean {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function readJson<T>(p: string): T | null {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function main() {
  const id = stampDir();
  const dest = path.join(ARCHIVE, id);
  fs.mkdirSync(dest, { recursive: true });

  const bundles: { from: string; to: string }[] = [
    { from: "competitor-parity/REPORT.md", to: "competitor-parity-REPORT.md" },
    { from: "competitor-parity/summary.json", to: "competitor-parity-summary.json" },
    { from: "competitor-gates.json", to: "competitor-gates.json" },
    { from: "platform-user-journey/REPORT.md", to: "platform-user-journey-REPORT.md" },
    { from: "platform-user-journey/summary.json", to: "platform-user-journey-summary.json" },
    { from: "user-journey-parity/REPORT.md", to: "user-journey-parity-REPORT.md" },
    { from: "user-journey-parity/summary.json", to: "user-journey-parity-summary.json" },
    { from: "literary-user-journey/summary.json", to: "literary-user-journey-summary.json" },
    { from: "start-intake/REPORT.md", to: "start-intake-REPORT.md" },
    { from: "astrocade-competitor-matrix.md", to: "astrocade-competitor-matrix.md" },
    { from: "godot-matrix/REPORT.md", to: "godot-matrix-REPORT.md" },
    { from: "godot-matrix/summary.json", to: "godot-matrix-summary.json" },
  ];

  const snaps: Snap[] = [];
  for (const b of bundles) {
    const src = path.join(ROOT, b.from);
    const ok = copyIfExists(src, path.join(dest, b.to));
    snaps.push({ label: b.to, relPath: b.from, exists: ok });
  }

  const parity = readJson<{
    pass?: boolean;
    at?: string;
    method1_samePrompt?: {
      total?: number;
      routeOk?: number;
      visualOk?: number;
      allOk?: number;
      rows?: Array<{ sampleId?: string; title?: string; visualOk?: boolean; ok?: boolean }>;
    };
    method2_randomClone?: {
      pickCount?: number;
      structuralOk?: number;
      allOk?: number;
      pickedIds?: string[];
      rows?: Array<{ sampleId?: string; title?: string; visualOk?: boolean; ok?: boolean }>;
    };
  }>(path.join(ROOT, "competitor-parity", "summary.json"));
  const gates = readJson<{
    e2eAllOk?: boolean;
    parityValidationOk?: boolean;
    e2eGodotOk?: boolean;
    e2eAstrocadeOk?: boolean;
    e2eCloneOk?: boolean;
    e2eSamplesEnOk?: boolean;
    specCanonicalOk?: boolean;
    godotMatrix?: {
      templateCount?: number;
      templates?: string[];
      e2eSpecs?: string[];
      e2eGodotOk?: boolean;
    };
  }>(path.join(ROOT, "competitor-gates.json"));
  const godotSummary = readJson<{
    passCount?: number;
    total?: number;
    suiteOk?: boolean;
    templates?: Array<{ templateId: string | null; ok: boolean; durationMs: number }>;
  }>(path.join(ROOT, "godot-matrix", "summary.json"));
  const platform = readJson<{ pass?: boolean }>(path.join(ROOT, "platform-user-journey", "summary.json"));

  const godotLines =
    gates?.godotMatrix?.templates?.length ?
      [
        "",
        "### Godot 模板矩阵",
        "",
        `- 模板数：${gates.godotMatrix.templateCount ?? gates.godotMatrix.templates.length}`,
        `- e2eGodotOk：${gates.godotMatrix.e2eGodotOk ?? gates.e2eGodotOk ?? "—"}`,
        `- E2E：${(gates.godotMatrix.e2eSpecs ?? []).join(" · ") || "—"}`,
        `- 模板：${gates.godotMatrix.templates.join(", ")}`,
        godotSummary?.templates?.length
          ? [
              "",
              "### Godot 试玩摘要（逐模板）",
              "",
              `- 通过：${godotSummary.passCount ?? "?"}/${godotSummary.total ?? "?"}`,
              "",
              "| 模板 | 状态 | 耗时 |",
              "|------|------|------|",
              ...godotSummary.templates
                .filter((t) => t.templateId)
                .map(
                  (t) =>
                    `| ${t.templateId} | ${t.ok ? "✅" : "❌"} | ${((t.durationMs ?? 0) / 1000).toFixed(1)}s |`,
                ),
            ].join("\n")
          : "",
        "",
        "| 门禁项 | 状态 |",
        "|--------|------|",
        `| e2eAstrocadeOk | ${gates.e2eAstrocadeOk ?? "—"} |`,
        `| e2eCloneOk | ${gates.e2eCloneOk ?? "—"} |`,
        `| e2eGodotOk | ${gates.e2eGodotOk ?? "—"} |`,
        `| e2eSamplesEnOk | ${gates.e2eSamplesEnOk ?? "—"} |`,
        `| specCanonicalOk | ${gates.specCanonicalOk ?? "—"} |`,
        `| parityValidationOk | ${gates.parityValidationOk ?? "—"} |`,
      ].join("\n")
    : "";

  const parityLines = parity
    ? [
        "## 竞品 strict parity（`competitor-parity/summary.json`）",
        "",
        `- 生成时间：${parity.at ?? "—"}`,
        `- 总评：${parity.pass === false ? "❌ 失败" : "✅ 通过"}`,
        `- 同 prompt：${parity.method1_samePrompt?.allOk ?? "?"}/${parity.method1_samePrompt?.total ?? "?"} 全通过（路由 ${parity.method1_samePrompt?.routeOk ?? "?"}/${parity.method1_samePrompt?.total ?? "?"} · 视觉 ${parity.method1_samePrompt?.visualOk ?? "?"}/${parity.method1_samePrompt?.total ?? "?"}）`,
        `- 随机克隆：${parity.method2_randomClone?.allOk ?? "?"}/${parity.method2_randomClone?.pickCount ?? "?"} 全通过（结构 ${parity.method2_randomClone?.structuralOk ?? "?"}/${parity.method2_randomClone?.pickCount ?? "?"}）`,
        parity.method2_randomClone?.pickedIds?.length
          ? `- 本轮抽样：${parity.method2_randomClone.pickedIds.join(", ")}`
          : "",
        `- 明细报告：\`qa-output/competitor-parity/REPORT.md\``,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const visualFailures = [
    ...(parity?.method1_samePrompt?.rows ?? []).filter((r) => r.visualOk === false),
    ...(parity?.method2_randomClone?.rows ?? []).filter((r) => r.visualOk === false),
  ];
  const screenshotLines =
    visualFailures.length > 0
      ? [
          "",
          "### 视觉未通过样品（截图已归档）",
          "",
          ...visualFailures.map(
            (r) =>
              `- ${r.title ?? r.sampleId ?? "?"} → \`qa-output/competitor-parity/prompt/\` · \`clone/\``,
          ),
          "",
          "CI artifact 含 `qa-output/competitor-parity/prompt/**` 与 `clone/**`。",
        ].join("\n")
      : "";

  const md = [
    "# 回归报告归档",
    "",
    `归档 ID：\`${id}\``,
    `生成时间：${new Date().toISOString()}`,
    "",
    "## 快照摘要",
    "",
    "| 来源 | 存在 | 备注 |",
    "|------|------|------|",
    ...snaps.map((s) => `| \`${s.relPath}\` | ${s.exists ? "✅" : "—"} | |`),
    "",
    "## 竞品 / Godot 门禁（若已跑过 qa:competitor-gates）",
    "",
    ...(parity ? [] : ["- strict parity：未生成", ""]),
    parityLines,
    screenshotLines,
    "",
    `- competitor-gates.e2eGodotOk：${gates?.e2eGodotOk ?? "—"}`,
    `- competitor-gates 全绿：${gates?.e2eAllOk ?? "—"}`,
    godotLines,
    "",
    "## 平台 PM",
    "",
    `- platform-user-journey：${platform?.pass === false ? "失败" : platform ? "通过/有数据" : "未生成"}`,
    "",
    "复跑：`npm run qa:platform-user-journey` · `COMPETITOR_PARITY_STRICT=1 npm run qa:competitor-parity-validation` · `npm run qa:competitor-gates`",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(dest, "INDEX.md"), md, "utf8");
  fs.writeFileSync(
    path.join(ARCHIVE, "LATEST.json"),
    JSON.stringify({ id, at: new Date().toISOString(), dir: path.relative(process.cwd(), dest) }, null, 2),
  );

  console.log(`[OK] qa:regression-archive → ${path.relative(process.cwd(), dest)}`);
  console.log(`     LATEST → qa-output/regression-archive/LATEST.json`);
}

main();
