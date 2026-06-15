/**
 * 竞品克隆可玩度批量验收（17 款 Astrocade 样品）
 * npm run qa:competitor-clone-batch
 *
 * 环境：dev @8888
 * COMPETITOR_CLONE_BATCH=smoke — 8 款快验（historical-closure 默认）
 * COMPETITOR_CLONE_BATCH=all — 全部 17 款
 * COMPETITOR_SAMPLE_IDS=id1,id2 — 自定义列表
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { SAMPLES } from "../src/lib/samples";
import type { Sample } from "../src/lib/samples";
import { sampleProjectId } from "../src/lib/sample-gallery";
import { expectedPhaserSceneName } from "../src/lib/game-templates/runtime";
import {
  buildCompetitorClonePlayabilityChecks,
  playabilityChecksPass,
} from "../src/lib/qa/competitor-clone-playability-checks";
import { compareCloneVisualParity } from "../src/lib/qa/competitor-clone-screenshots";
import { chromiumLaunchOptions, healthOk } from "../src/lib/qa/run-sample-gameplay-interaction-audit";
import { ensureSampleGalleryProjects } from "../src/lib/sample-gallery-seed";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";
const OUT = path.join(process.cwd(), "qa-output", "competitor-clone-batch");

const SMOKE_SAMPLE_IDS = [
  "crashy-roads",
  "elastic-thief-2",
  "pottery-master-3d",
  "state-conquest",
  "kids-puzzle",
  "color-bloom",
  "ultimate-3d-chess",
  "grow-a-garden",
] as const;

function pickSamples(): Sample[] {
  const custom = process.env.COMPETITOR_SAMPLE_IDS?.trim();
  if (custom) {
    const ids = custom.split(",").map((s) => s.trim()).filter(Boolean);
    return ids.map((id) => {
      const s = SAMPLES.find((x) => x.id === id);
      if (!s) throw new Error(`unknown sample id: ${id}`);
      return s;
    });
  }
  const batch = (process.env.COMPETITOR_CLONE_BATCH ?? "smoke").trim().toLowerCase();
  if (batch === "all") return [...SAMPLES];
  return SAMPLES.filter((s) => (SMOKE_SAMPLE_IDS as readonly string[]).includes(s.id));
}

async function runOne(
  page: import("@playwright/test").Page,
  sample: Sample,
): Promise<{
  sampleId: string;
  title: string;
  pass: boolean;
  playabilityOk: boolean;
  visualOk: boolean;
  scene: string;
  cloneId: string;
  playabilityChecks: Record<string, boolean>;
  visual: { colorDist: number; diffRatio: number };
}> {
  const sourceId = sampleProjectId(sample.id);
  const sourceGet = await page.request.get(`${BASE}/api/projects/${sourceId}`);
  if (!sourceGet.ok()) throw new Error(`GET source failed ${sample.id}`);

  const dup = await page.request.post(`${BASE}/api/projects/${sourceId}/duplicate`);
  if (!dup.ok()) throw new Error(`duplicate failed ${sample.id}: ${await dup.text()}`);
  const { project } = (await dup.json()) as { project?: { id?: string } };
  const cloneId = project?.id;
  if (!cloneId) throw new Error(`no clone id for ${sample.id}`);

  const cloneGet = await page.request.get(`${BASE}/api/projects/${cloneId}`);
  const cloneBody = (await cloneGet.json()) as { spec?: import("@/lib/game-spec").GameSpec };
  const cloneSpec = cloneBody.spec!;
  const scene = expectedPhaserSceneName(cloneSpec);
  const playabilityChecks = buildCompetitorClonePlayabilityChecks(sample, cloneSpec);
  const playabilityOk = playabilityChecksPass(playabilityChecks);

  const { metrics, visualOk } = await compareCloneVisualParity({
    page,
    baseUrl: BASE,
    sampleId: sample.id,
    sourceId,
    cloneId,
    shotsDir: path.join(OUT, "shots"),
  });

  return {
    sampleId: sample.id,
    title: sample.title,
    pass: playabilityOk && visualOk,
    playabilityOk,
    visualOk,
    scene,
    cloneId,
    playabilityChecks,
    visual: { colorDist: metrics.colorDist, diffRatio: metrics.diffRatio },
  };
}

async function main() {
  if (!(await healthOk(BASE))) {
    console.error(`[FAIL] 服务未就绪 @ ${BASE}`);
    process.exit(1);
  }

  const samples = pickSamples();
  fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
  const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(new URL(BASE).hostname);
  if (isLocal) {
    await ensureSampleGalleryProjects();
  }

  const browser = await chromium.launch(chromiumLaunchOptions(BASE));

  const rows = [];
  for (const sample of samples) {
    process.stdout.write(`\n→ ${sample.id} … `);
    const context = await browser.newContext({ viewport: { width: 900, height: 640 } });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      const row = await runOne(page, sample);
      rows.push(row);
      console.log(row.pass ? "OK" : "FAIL");
      if (!row.pass) {
        const failed = Object.entries(row.playabilityChecks)
          .filter(([, v]) => !v)
          .map(([k]) => k);
        if (failed.length) console.log(`  可玩度: ${failed.join(", ")}`);
        if (!row.visualOk) {
          console.log(
            `  视觉: colorDist=${row.visual.colorDist.toFixed(1)} diff=${(row.visual.diffRatio * 100).toFixed(1)}%`,
          );
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      rows.push({
        sampleId: sample.id,
        title: sample.title,
        pass: false,
        playabilityOk: false,
        visualOk: false,
        scene: "error",
        cloneId: "",
        playabilityChecks: { error: false },
        visual: { colorDist: 999, diffRatio: 1 },
        error: msg,
      } as (typeof rows)[0] & { error?: string });
      console.log(`ERROR: ${msg}`);
    } finally {
      await context.close();
    }
  }

  await browser.close();

  const passCount = rows.filter((r) => r.pass).length;
  const summary = {
    at: new Date().toISOString(),
    batch: process.env.COMPETITOR_CLONE_BATCH ?? "smoke",
    total: rows.length,
    passCount,
    pass: passCount === rows.length,
    rows,
  };

  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    path.join(OUT, "REPORT.md"),
    [
      "# 竞品克隆可玩度批量验收",
      "",
      `- 时间：${summary.at}`,
      `- 批次：${summary.batch} · ${passCount}/${summary.total} PASS`,
      "",
      "| 样品 | Scene | 可玩度 | 视觉 | diff% | 克隆 |",
      "|------|-------|--------|------|-------|------|",
      ...rows.map((r) => {
        const err = "error" in r ? (r as { error?: string }).error : undefined;
        return `| ${r.title} | ${r.scene} | ${err ? "ERR" : r.playabilityOk ? "✅" : "❌"} | ${r.visualOk ? "✅" : "❌"} | ${(r.visual.diffRatio * 100).toFixed(1)} | \`${r.cloneId || "—"}\` |`;
      }),
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(`\n批量: ${passCount}/${rows.length} PASS`);
  console.log(`报告: qa-output/competitor-clone-batch/REPORT.md`);

  if (!summary.pass) process.exit(1);
  console.log("\nqa:competitor-clone-batch: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
