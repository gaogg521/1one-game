/**
 * Phase C：14 款样品 PM 上架清单（封面 / 资产 / parity / hook）
 * npm run qa:sample-launch-checklist
 *
 * 输出：qa-output/sample-launch-checklist/REPORT.md
 */
import fs from "node:fs";
import path from "node:path";
import { SAMPLES } from "@/lib/samples";
import { sampleProjectId } from "@/lib/sample-gallery";
import { repoPublicPath } from "@/lib/public-path";
import {
  buildSampleTemplateSkillParityRow,
  checkSampleTemplateSkillParity,
} from "@/lib/opengame-skills/template-sample-parity";

const OUT = path.join(process.cwd(), "qa-output", "sample-launch-checklist");
const CORE_SPRITES = ["player", "hazard", "gem"] as const;

type LaunchRow = {
  sampleId: string;
  title: string;
  coverOk: boolean;
  spritesOk: boolean;
  bgOk: boolean;
  parityOk: boolean;
  hooksOk: boolean;
  ok: boolean;
  notes: string[];
};

function publicFileExists(webPath: string): boolean {
  const rel = webPath.replace(/^\//, "");
  return fs.existsSync(path.join(process.cwd(), "public", rel));
}

function checkSampleAssets(sampleId: string): { spritesOk: boolean; bgOk: boolean } {
  const pid = sampleProjectId(sampleId);
  const spriteDir = path.join(repoPublicPath(), "game-sprites", pid);
  const spritesOk = CORE_SPRITES.every((k) => fs.existsSync(path.join(spriteDir, `${k}.png`)));
  const bgOk = fs.existsSync(path.join(repoPublicPath(), "game-bg", `${pid}.png`));
  return { spritesOk, bgOk };
}

function evaluateSample(sample: (typeof SAMPLES)[number]): LaunchRow {
  const notes: string[] = [];
  const coverOk = publicFileExists(sample.coverImageSrc);
  if (!coverOk) notes.push(`missing cover ${sample.coverImageSrc}`);

  const { spritesOk, bgOk } = checkSampleAssets(sample.id);
  if (!spritesOk) notes.push("missing core sprites (player/hazard/gem)");
  if (!bgOk) notes.push("missing game-bg png");

  const parityIssues = checkSampleTemplateSkillParity(sample);
  const parityOk = parityIssues.length === 0;
  if (!parityOk) notes.push(...parityIssues.slice(0, 3));

  const row = buildSampleTemplateSkillParityRow(sample);
  const hooksOk = Boolean(row.pilotSceneHooks?.length);
  if (!hooksOk) notes.push("no pilotSceneHooks registered");

  const ok = coverOk && spritesOk && bgOk && parityOk && hooksOk;
  return {
    sampleId: sample.id,
    title: sample.title,
    coverOk,
    spritesOk,
    bgOk,
    parityOk,
    hooksOk,
    ok,
    notes,
  };
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const rows = SAMPLES.map(evaluateSample);
  const passCount = rows.filter((r) => r.ok).length;
  const pass = passCount === rows.length;

  const report = [
    "# 样品馆 PM 上架清单 · 14 款",
    "",
    `- 时间：${new Date().toISOString()}`,
    `- 结果：**${passCount}/${rows.length}** ${pass ? "✅ 可上架（自动化项）" : "❌ 有失败项"}`,
    "",
    "| 样品 | 封面 | 精灵 | 背景 | Parity | Hook | 结果 |",
    "|------|------|------|------|--------|------|------|",
    ...rows.map(
      (r) =>
        `| ${r.title} | ${r.coverOk ? "✅" : "❌"} | ${r.spritesOk ? "✅" : "❌"} | ${r.bgOk ? "✅" : "❌"} | ${r.parityOk ? "✅" : "❌"} | ${r.hooksOk ? "✅" : "❌"} | ${r.ok ? "✅" : "❌"} |`,
    ),
    "",
    "## 失败明细",
    "",
    ...(rows.some((r) => !r.ok)
      ? rows
          .filter((r) => !r.ok)
          .flatMap((r) => [`### ${r.sampleId}`, ...r.notes.map((n) => `- ${n}`), ""])
      : ["（无）", ""]),
    "",
    "## 说明",
    "",
    "- **封面**：`public/samples/{id}.png` 或 `coverImageSrc` 指向的 PNG 存在。",
    "- **精灵/背景**：`public/game-sprites/sample-*` 与 `public/game-bg/sample-*.png`。",
    "- **Parity**：Template Skill + Debug Skill + dedicated 路由。",
    "- **Hook**：`SAMPLE_TEMPLATE_SKILL_PILOTS` 源码断言。",
    "- **可选肉眼**：章节横幅动效、消消乐/神庙手感（见 `qa:sample-behavior-signoff`）。",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(OUT, "REPORT.md"), report, "utf8");
  fs.writeFileSync(
    path.join(OUT, "summary.json"),
    JSON.stringify({ at: new Date().toISOString(), passCount, total: rows.length, pass, rows }, null, 2),
    "utf8",
  );

  for (const r of rows) {
    console.log(`${r.ok ? "[OK]" : "[FAIL]"} ${r.sampleId}`);
    if (!r.ok) {
      for (const n of r.notes.slice(0, 2)) console.log(`  - ${n}`);
    }
  }

  console.log(`\nqa:sample-launch-checklist: ${passCount}/${rows.length} → qa-output/sample-launch-checklist/REPORT.md`);
  if (!pass) process.exit(1);
  console.log("[OK] qa:sample-launch-checklist");
}

main();
