/**
 * 竞品克隆可玩度验收：duplicate → spec 断言 → canvas 对标
 * npm run qa:competitor-clone-playability
 *
 * 环境：dev @8888 · COMPETITOR_SAMPLE_ID=crashy-roads（默认随机 1 款）
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { SAMPLES } from "../src/lib/samples";
import { sampleProjectId } from "../src/lib/sample-gallery";
import { expectedPhaserSceneName } from "../src/lib/game-templates/runtime";
import {
  buildCompetitorClonePlayabilityChecks,
  playabilityChecksPass,
} from "../src/lib/qa/competitor-clone-playability-checks";
import { compareCloneVisualParity } from "../src/lib/qa/competitor-clone-screenshots";
import { ensureSampleGalleryProjects } from "../src/lib/sample-gallery-seed";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";
const OUT = path.join(process.cwd(), "qa-output", "competitor-clone-playability");

function pickSample() {
  const forced = process.env.COMPETITOR_SAMPLE_ID?.trim();
  if (forced) {
    const s = SAMPLES.find((x) => x.id === forced);
    if (!s) throw new Error(`unknown COMPETITOR_SAMPLE_ID=${forced}`);
    return s;
  }
  const day = process.env.COMPETITOR_PICK_SEED ?? new Date().toISOString().slice(0, 10);
  const seed = createHash("sha256").update(day).digest();
  const idx = seed[0]! % SAMPLES.length;
  return SAMPLES[idx]!;
}

async function healthOk() {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await healthOk())) {
    console.error(`[FAIL] dev 未启动 @ ${BASE}`);
    process.exit(1);
  }

  const sample = pickSample();
  fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
  await ensureSampleGalleryProjects();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

  const sourceId = sampleProjectId(sample.id);
  const sourceGet = await page.request.get(`${BASE}/api/projects/${sourceId}`);
  if (!sourceGet.ok()) throw new Error(`GET source failed ${sample.id}`);

  const dup = await page.request.post(`${BASE}/api/projects/${sourceId}/duplicate`);
  if (!dup.ok()) throw new Error(`duplicate failed: ${await dup.text()}`);
  const { project } = (await dup.json()) as { project?: { id?: string; title?: string } };
  const cloneId = project?.id;
  if (!cloneId) throw new Error("no clone id");

  const cloneGet = await page.request.get(`${BASE}/api/projects/${cloneId}`);
  const cloneBody = (await cloneGet.json()) as { spec?: import("@/lib/game-spec").GameSpec };
  const cloneSpec = cloneBody.spec!;

  const scene = expectedPhaserSceneName(cloneSpec);
  const playabilityChecks = buildCompetitorClonePlayabilityChecks(sample, cloneSpec);

  const { metrics, visualOk } = await compareCloneVisualParity({
    page,
    baseUrl: BASE,
    sampleId: sample.id,
    sourceId,
    cloneId,
    shotsDir: path.join(OUT, "shots"),
  });

  await browser.close();

  const playabilityOk = playabilityChecksPass(playabilityChecks);
  const summary = {
    at: new Date().toISOString(),
    sampleId: sample.id,
    title: sample.title,
    competitorPrompt: sample.prompt,
    sourceId,
    cloneId,
    cloneTitle: project?.title,
    scene,
    playabilityChecks,
    visual: metrics,
    visualOk,
    pass: playabilityOk && visualOk,
    urls: {
      source: `/play/${sourceId}`,
      clone: `/play/${cloneId}`,
    },
  };

  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    path.join(OUT, "REPORT.md"),
    [
      `# 竞品克隆可玩度 — ${sample.title}`,
      "",
      `- 时间：${summary.at}`,
      `- 样品：\`${sample.id}\` → 克隆 \`${cloneId}\``,
      `- Scene：${scene}`,
      `- 可玩度断言：${playabilityOk ? "PASS" : "FAIL"}`,
      `- 视觉对标：${visualOk ? "PASS" : "FAIL"}（colorDist=${metrics.colorDist.toFixed(1)} diff=${(metrics.diffRatio * 100).toFixed(1)}%）`,
      "",
      "## 竞品能力 vs 我们的实现",
      "",
      `> ${sample.subtitle}`,
      "",
      "| 检查项 | 结果 |",
      "|--------|------|",
      ...Object.entries(playabilityChecks).map(([k, v]) => `| ${k} | ${v ? "✅" : "❌"} |`),
      "",
      "## 试玩链接",
      "",
      `- 竞品样品：${summary.urls.source}`,
      `- 克隆副本：${summary.urls.clone}`,
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(`\n样品: ${sample.title} (${sample.id})`);
  console.log(`克隆: ${cloneId} → ${summary.urls.clone}`);
  console.log(`Scene: ${scene}`);
  console.log(`可玩度: ${playabilityOk ? "OK" : "FAIL"} · 视觉: ${visualOk ? "OK" : "FAIL"}`);
  console.log(`报告: qa-output/competitor-clone-playability/REPORT.md`);

  if (!summary.pass) process.exit(1);
  console.log("\nqa:competitor-clone-playability: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
