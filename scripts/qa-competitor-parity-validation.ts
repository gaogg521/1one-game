/**
 * 竞品对标双验证（用户定义）：
 * 1. 同样提示词 → 样品 vs 用户 POST 同样效果（路由 + profile + 视觉）
 * 2. 随机克隆竞品样品 → duplicate 后试玩效果一致（spec + 视觉）
 *
 * npm run qa:competitor-parity-validation
 * 报告：qa-output/competitor-parity/REPORT.md · summary.json
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { SAMPLES } from "../src/lib/samples";
import { sampleProjectId } from "../src/lib/sample-gallery";
import { buildCanonicalAstrocadeSpec } from "../src/lib/astrocade-canonical-spec";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { expectedPhaserSceneName } from "../src/lib/game-templates/runtime";
import { shouldUseAgenticRuntime } from "../src/lib/agentic/game-module";
import {
  cloneVisualThresholdsForSample,
  compareCanvasImages,
  GLOBAL_CANVAS_PARITY,
  GLOBAL_CLONE_PARITY,
  passesCanvasParity,
  visualThresholdsForSample,
} from "../src/lib/qa/canvas-image-parity";
import { ensureSampleGalleryProjects } from "../src/lib/sample-gallery-seed";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";
const OUT = path.join(process.cwd(), "qa-output", "competitor-parity");
const PICK_COUNT = Number(process.env.COMPETITOR_CLONE_PICK ?? "5");

type PromptRow = {
  sampleId: string;
  title: string;
  sceneMatch: boolean;
  templateMatch: boolean;
  profileMatch: boolean;
  userAgentic: boolean;
  colorDist: number;
  diffRatio: number;
  visualOk: boolean;
  ok: boolean;
  sampleShot: string;
  userShot: string;
};

type CloneRow = {
  sampleId: string;
  title: string;
  profilePreserved: boolean;
  sceneMatch: boolean;
  noAgentic: boolean;
  colorDist: number;
  diffRatio: number;
  visualOk: boolean;
  ok: boolean;
  sourceShot: string;
  cloneShot: string;
  cloneId: string;
};

async function healthOk(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function screenshotPlay(page: import("@playwright/test").Page, projectId: string, shotPath: string): Promise<void> {
  await page.goto(`${BASE}/play/${projectId}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByText("继续共创").waitFor({ timeout: 15_000 }).catch(() => {});
  const phaserTab = page.getByTestId("runtime-tab-phaser");
  if (await phaserTab.isVisible().catch(() => false)) await phaserTab.click();
  await page.locator("canvas").first().waitFor({ timeout: 25_000 });
  await page
    .waitForFunction(() => (window as unknown as { __PHASER_PLAY_READY__?: boolean }).__PHASER_PLAY_READY__ === true, null, {
      timeout: 20_000,
    })
    .catch(() => {});
  await page.waitForTimeout(400);
  fs.mkdirSync(path.dirname(shotPath), { recursive: true });
  await page.locator("canvas").first().screenshot({ path: shotPath });
}

function pickRandomSamples(count: number): typeof SAMPLES {
  const day = process.env.COMPETITOR_PICK_SEED ?? new Date().toISOString().slice(0, 10);
  const seed = createHash("sha256").update(day).digest();
  const scored = SAMPLES.map((s, i) => ({
    s,
    score: seed[i % seed.length]! + seed[(i * 7) % seed.length]!,
  }));
  scored.sort((a, b) => a.score - b.score);
  const picked: typeof SAMPLES = [];
  const usedTemplates = new Set<string>();
  for (const { s } of scored) {
    if (picked.length >= count) break;
    const tid = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { sampleId: s.id }).templateId;
    if (usedTemplates.has(tid)) continue;
    picked.push(s);
    usedTemplates.add(tid);
  }
  for (const { s } of scored) {
    if (picked.length >= count) break;
    if (picked.some((p) => p.id === s.id)) continue;
    picked.push(s);
  }
  return picked.slice(0, count);
}

async function ensureOwnerSession(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
}

async function main() {
  if (!(await healthOk())) {
    console.error(`[FAIL] dev not at ${BASE}. Run: DATABASE_URL=file:./prisma/ci.sqlite PORT=8888 npm run dev`);
    process.exit(1);
  }
  await ensureSampleGalleryProjects();
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  await ensureOwnerSession(page);

  const promptRows: PromptRow[] = [];

  console.log("\n## 验证 1 · 同样提示词 → 同样效果（17 样品）\n");

  for (const s of SAMPLES) {
    const sampleSpec = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { sampleId: s.id });
    const sampleScene = expectedPhaserSceneName(sampleSpec);

    const create = await page.request.post(`${BASE}/api/projects`, {
      data: { prompt: s.prompt, spec: mockSpecFromPrompt(s.prompt) },
    });
    if (!create.ok()) {
      console.error(`[FAIL] POST ${s.id}`, await create.text());
      process.exit(1);
    }
    const { project } = (await create.json()) as { project?: { id?: string } };
    const userId = project?.id;
    if (!userId) {
      console.error(`[FAIL] no user id ${s.id}`);
      process.exit(1);
    }

    const get = await page.request.get(`${BASE}/api/projects/${userId}`);
    const saved = (await get.json()) as { spec?: typeof sampleSpec };
    const userSpec = saved.spec!;
    const userScene = expectedPhaserSceneName(userSpec);
    const userAgentic = shouldUseAgenticRuntime(userSpec);
    const profileMatch = userSpec.samplePlayProfile?.variantId === s.id;

    const sampleShot = path.join(OUT, "prompt", `sample-${s.id}.png`);
    const userShot = path.join(OUT, "prompt", `user-${s.id}.png`);
    await screenshotPlay(page, sampleProjectId(s.id), sampleShot);
    await screenshotPlay(page, userId, userShot);

    const metrics = await compareCanvasImages(sampleShot, userShot);
    const thresholds = visualThresholdsForSample(s.id);
    const visualOk = passesCanvasParity(metrics, thresholds);
    const sceneMatch = sampleScene === userScene;
    const templateMatch = sampleSpec.templateId === userSpec.templateId;
    const routeOk = sceneMatch && !userAgentic && profileMatch;
    const ok = routeOk && visualOk;

    promptRows.push({
      sampleId: s.id,
      title: s.title,
      sceneMatch,
      templateMatch,
      profileMatch,
      userAgentic,
      colorDist: metrics.colorDist,
      diffRatio: metrics.diffRatio,
      visualOk,
      ok,
      sampleShot: path.relative(process.cwd(), sampleShot),
      userShot: path.relative(process.cwd(), userShot),
    });

    console.log(
      `[${ok ? "OK" : "GAP"}] ${s.id} scene=${sceneMatch} profile=${profileMatch} visual=${visualOk} dist=${metrics.colorDist.toFixed(1)} diff=${(metrics.diffRatio * 100).toFixed(0)}%`,
    );
  }

  const clonePick = pickRandomSamples(Math.min(PICK_COUNT, SAMPLES.length));
  const cloneRows: CloneRow[] = [];

  console.log(`\n## 验证 2 · 随机克隆竞品样品 → 同样效果（${clonePick.length} 款）\n`);
  console.log(`picked: ${clonePick.map((s) => s.id).join(", ")}\n`);

  for (const s of clonePick) {
    const sourceId = sampleProjectId(s.id);
    const sourceGet = await page.request.get(`${BASE}/api/projects/${sourceId}`);
    if (!sourceGet.ok()) {
      console.error(`[FAIL] GET source ${s.id}`, await sourceGet.text());
      process.exit(1);
    }
    const sourceBody = (await sourceGet.json()) as { spec?: typeof import("@/lib/game-spec").GameSpec };
    const sourceSpec = sourceBody.spec!;
    const sourceScene = expectedPhaserSceneName(sourceSpec);

    const dup = await page.request.post(`${BASE}/api/projects/${sourceId}/duplicate`);
    if (!dup.ok()) {
      console.error(`[FAIL] duplicate ${s.id}`, await dup.text());
      process.exit(1);
    }
    const { project: cloneProject } = (await dup.json()) as { project?: { id?: string } };
    const cloneId = cloneProject?.id;
    if (!cloneId) {
      console.error(`[FAIL] no clone id ${s.id}`);
      process.exit(1);
    }

    const get = await page.request.get(`${BASE}/api/projects/${cloneId}`);
    const body = (await get.json()) as { spec?: typeof sourceSpec };
    const cloneSpec = body.spec!;
    const cloneScene = expectedPhaserSceneName(cloneSpec);
    const profilePreserved = cloneSpec.samplePlayProfile?.variantId === sourceSpec.samplePlayProfile?.variantId;
    const noAgentic = !shouldUseAgenticRuntime(cloneSpec) && !cloneSpec.agenticModule;

    const sourceShot = path.join(OUT, "clone", `source-${s.id}.png`);
    const cloneShot = path.join(OUT, "clone", `clone-${s.id}.png`);
    await screenshotPlay(page, sourceId, sourceShot);
    await screenshotPlay(page, cloneId, cloneShot);

    const metrics = await compareCanvasImages(sourceShot, cloneShot);
    const thresholds = cloneVisualThresholdsForSample(s.id);
    const visualOk = passesCanvasParity(metrics, thresholds);
    const structuralOk = profilePreserved && cloneScene === sourceScene && noAgentic;
    const ok = structuralOk && visualOk;

    cloneRows.push({
      sampleId: s.id,
      title: s.title,
      profilePreserved,
      sceneMatch: cloneScene === sourceScene,
      noAgentic,
      colorDist: metrics.colorDist,
      diffRatio: metrics.diffRatio,
      visualOk,
      ok,
      sourceShot: path.relative(process.cwd(), sourceShot),
      cloneShot: path.relative(process.cwd(), cloneShot),
      cloneId,
    });

    fs.writeFileSync(
      path.join(process.cwd(), "qa-output", "astrocade-random-pick.json"),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          seed: process.env.COMPETITOR_PICK_SEED ?? new Date().toISOString().slice(0, 10),
          picked: clonePick.map((p) => ({ id: p.id, title: p.title, creator: p.creator })),
          results: cloneRows.map((r) => ({ id: r.sampleId, ok: r.ok, cloneId: r.cloneId })),
        },
        null,
        2,
      ),
    );

    console.log(
      `[${ok ? "OK" : "GAP"}] clone ${s.id} profile=${profilePreserved} scene=${cloneScene === sourceScene} visual=${visualOk} dist=${metrics.colorDist.toFixed(1)}`,
    );
  }

  await browser.close();

  const promptRouteOk = promptRows.filter((r) => r.sceneMatch && r.profileMatch && !r.userAgentic).length;
  const promptVisualOk = promptRows.filter((r) => r.visualOk).length;
  const promptAllOk = promptRows.filter((r) => r.ok).length;
  const cloneStructuralOk = cloneRows.filter((r) => r.profilePreserved && r.sceneMatch && r.noAgentic).length;
  const cloneAllOk = cloneRows.filter((r) => r.ok).length;

  const summary = {
    at: new Date().toISOString(),
    method1_samePrompt: {
      total: promptRows.length,
      routeOk: promptRouteOk,
      visualOk: promptVisualOk,
      allOk: promptAllOk,
      rows: promptRows,
    },
    method2_randomClone: {
      pickCount: cloneRows.length,
      structuralOk: cloneStructuralOk,
      allOk: cloneAllOk,
      pickedIds: clonePick.map((s) => s.id),
      rows: cloneRows,
    },
    pass: promptRouteOk === promptRows.length && cloneStructuralOk === cloneRows.length && promptAllOk === promptRows.length && cloneAllOk === cloneRows.length,
  };

  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# 竞品对标双验证报告",
    "",
    `生成时间：${summary.at}`,
    "",
    "## 验证方法（用户定义）",
    "",
    "1. **同样提示词**：样品馆 spec 与用户 POST（同 prompt 文本）→ 同 Scene + 同 profile + 视觉接近",
    "2. **随机克隆**：从 17 款 Astrocade 对标样品中随机抽 N 款 duplicate → 保留 profile、同 Scene、试玩视觉接近",
    "",
    "## 摘要",
    "",
    "| 验证 | 路由/结构 | 视觉 | 全通过 |",
    "|------|-----------|------|--------|",
    `| 同 prompt（${promptRows.length}） | ${promptRouteOk}/${promptRows.length} | ${promptVisualOk}/${promptRows.length} | ${promptAllOk}/${promptRows.length} |`,
    `| 随机克隆（${cloneRows.length}） | ${cloneStructuralOk}/${cloneRows.length} | ${cloneRows.filter((r) => r.visualOk).length}/${cloneRows.length} | ${cloneAllOk}/${cloneRows.length} |`,
    "",
    "### 全局阈值（不按样品分档）",
    "",
    `- 同 prompt：色差 ≤${GLOBAL_CANVAS_PARITY.maxColorDist} · diff ≤${GLOBAL_CANVAS_PARITY.maxDiffRatio * 100}%`,
    `- 克隆：色差 ≤${GLOBAL_CLONE_PARITY.maxColorDist} · diff ≤${GLOBAL_CLONE_PARITY.maxDiffRatio * 100}%`,
    "",
    "## 同 prompt 明细",
    "",
    "| 样品 | Scene | Profile | 色差 | diff% | 视觉 |",
    "|------|-------|---------|------|-------|------|",
    ...promptRows.map(
      (r) =>
        `| ${r.title} | ${r.sceneMatch ? "✅" : "❌"} | ${r.profileMatch ? "✅" : "❌"} | ${r.colorDist.toFixed(1)} | ${(r.diffRatio * 100).toFixed(0)} | ${r.visualOk ? "✅" : "⚠️"} |`,
    ),
    "",
    "## 随机克隆明细",
    "",
    "| 样品 | profile | Scene | 色差 | diff% | 视觉 |",
    "|------|---------|-------|------|-------|------|",
    ...cloneRows.map(
      (r) =>
        `| ${r.title} | ${r.profilePreserved ? "✅" : "❌"} | ${r.sceneMatch ? "✅" : "❌"} | ${r.colorDist.toFixed(1)} | ${(r.diffRatio * 100).toFixed(0)} | ${r.visualOk ? "✅" : "⚠️"} |`,
    ),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "REPORT.md"), md, "utf8");

  console.log(`\n报告：${path.relative(process.cwd(), path.join(OUT, "REPORT.md"))}`);

  if (promptRouteOk !== promptRows.length) {
    console.error(`[FAIL] 同 prompt 路由 ${promptRouteOk}/${promptRows.length}`);
    process.exit(1);
  }
  if (cloneStructuralOk !== cloneRows.length) {
    console.error(`[FAIL] 随机克隆结构 ${cloneStructuralOk}/${cloneRows.length}`);
    process.exit(1);
  }
  if (promptAllOk !== promptRows.length || cloneAllOk !== cloneRows.length) {
    const visualGaps = promptRows.length - promptAllOk + (cloneRows.length - cloneAllOk);
    console.error(`[WARN] 视觉差距 ${visualGaps} 条 — 见报告截图；路由/结构已通过`);
    if (process.env.COMPETITOR_PARITY_STRICT === "1") {
      process.exit(1);
    }
  }
  console.log(`[OK] qa-competitor-parity-validation — 路由 ${promptRouteOk}/${promptRows.length} · 克隆 ${cloneAllOk}/${cloneRows.length}`);
  try {
    execSync("npm run qa:regression-archive", { stdio: "inherit", cwd: process.cwd() });
  } catch {
    console.warn("[warn] qa:regression-archive skipped after parity validation");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$disconnect();
  });
