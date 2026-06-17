/**
 * 从试玩页 canvas 截取样品封面 PNG → public/samples/{sampleId}.png
 * npm run capture:sample-covers
 * npm run capture:sample-covers:arcade
 * npm run capture:sample-covers:astrocade
 * npm run capture:sample-covers:all
 * SAMPLE_COVER_IDS=temple-relic-runner npm run capture:sample-covers
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { healthOk, waitPlayReady, chromiumLaunchOptions } from "../src/lib/qa/run-sample-gameplay-interaction-audit";
import { sampleProjectId } from "../src/lib/sample-gallery";
import { SAMPLE_GAMEPLAY_CASES } from "../src/lib/qa/sample-gameplay-interaction";
import { SAMPLES, type Sample } from "../src/lib/samples";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";
const DEFAULT_IDS = [
  "temple-relic-runner",
  "number-merge-2048",
  "zen-go-board",
  "jungle-animal-chess",
  "classic-xiangqi-board",
  "classic-international-chess",
] as const;

const ARCADE_IDS = [
  "crashy-roads",
  "temple-relic-runner",
  "smash-the-dummy",
  "grow-a-garden",
  "color-bloom",
] as const;

const ASTROCADE_IDS = [
  "gun-merge-3d-zombie-apocalypse",
  "elastic-thief-2",
  "blade-defender-merge",
  "pottery-master-3d",
] as const;

const GAMEPLAY_BY_ID = Object.fromEntries(SAMPLE_GAMEPLAY_CASES.map((c) => [c.sampleId, c]));

function coverOutputRel(sample: Sample): string {
  if (sample.coverImageSrc.endsWith(".png")) return sample.coverImageSrc.replace(/^\//, "");
  return `samples/${sample.id}.png`;
}

async function warmSample(page: import("@playwright/test").Page, sampleId: string) {
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) return;

  const clickRel = (x: number, y: number) =>
    canvas.click({ position: { x: box.width * x, y: box.height * y }, force: true });

  if (sampleId === "temple-relic-runner") {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    for (let i = 0; i < 16; i += 1) {
      await page.keyboard.down("ArrowRight");
      await page.waitForTimeout(70);
    }
    await page.keyboard.up("ArrowRight");
    await page.waitForTimeout(900);
    return;
  }

  if (sampleId === "color-bloom") {
    await clickRel(0.48, 0.56);
    await page.waitForTimeout(320);
    await clickRel(0.52, 0.56);
    await page.waitForTimeout(480);
    await clickRel(0.56, 0.56);
    await page.waitForTimeout(700);
    return;
  }

  const spec = GAMEPLAY_BY_ID[sampleId];
  if (spec) {
    const burst = spec.clickBurst ?? 1;
    const rel1 = spec.clickRel ?? { x: 0.5, y: 0.48 };
    const rel2 = spec.clickRel2 ?? rel1;
    if (spec.interaction === "arrow-left" || spec.interaction === "arrow-right") {
      const key = spec.interaction === "arrow-left" ? "ArrowLeft" : "ArrowRight";
      for (let i = 0; i < burst; i += 1) {
        await page.keyboard.press(key);
        await page.waitForTimeout(spec.animated ? 90 : 120);
      }
      await page.waitForTimeout(spec.animated ? 700 : 400);
      return;
    }
    if (spec.interaction === "space") {
      for (let i = 0; i < burst; i += 1) {
        await page.keyboard.press("Space");
        await page.waitForTimeout(120);
      }
      await page.waitForTimeout(600);
      return;
    }
    for (let i = 0; i < burst; i += 1) {
      await clickRel(rel1.x, rel1.y);
      await page.waitForTimeout(280);
      if (rel2 && (rel2.x !== rel1.x || rel2.y !== rel1.y)) {
        await clickRel(rel2.x, rel2.y);
        await page.waitForTimeout(320);
      }
    }
    await page.waitForTimeout(500);
    return;
  }

  await page.waitForTimeout(1200);
}

async function captureOne(page: import("@playwright/test").Page, sampleId: string) {
  const sample = SAMPLES.find((s) => s.id === sampleId);
  if (!sample) throw new Error(`unknown sample: ${sampleId}`);

  const projectId = sampleProjectId(sampleId);
  await page.goto(`${BASE}/play/${projectId}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByText("继续共创").waitFor({ timeout: 12_000 }).catch(() => {});
  const phaserTab = page.getByTestId("runtime-tab-phaser");
  if (await phaserTab.isVisible().catch(() => false)) await phaserTab.click();

  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ timeout: 25_000 });
  const ready = await waitPlayReady(page, 30_000);
  if (!ready) throw new Error(`${sampleId}: play ready timeout`);

  await warmSample(page, sampleId);

  const outRel = coverOutputRel(sample);
  const outPath = path.join(process.cwd(), "public", outRel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await canvas.screenshot({ path: outPath });
  console.log(`[OK] ${sampleId} → ${outRel}`);
}

async function main() {
  const arcadeBatch = process.argv.includes("--arcade");
  const astrocadeBatch = process.argv.includes("--astrocade");
  const allBatch = process.argv.includes("--all");
  if (arcadeBatch) process.env.SAMPLE_COVER_BATCH = "arcade";
  if (astrocadeBatch) process.env.SAMPLE_COVER_BATCH = "astrocade";
  if (allBatch) process.env.SAMPLE_COVER_BATCH = "all";
  if (!(await healthOk(BASE))) {
    console.error(`[FAIL] dev not ready @ ${BASE}`);
    process.exit(1);
  }

  const batch = process.env.SAMPLE_COVER_BATCH;
  const envIds = process.env.SAMPLE_COVER_IDS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ids =
    batch === "all"
      ? SAMPLES.map((s) => s.id)
      : batch === "arcade"
        ? [...ARCADE_IDS]
        : batch === "astrocade"
          ? [...ASTROCADE_IDS]
          : envIds?.length
            ? envIds
            : [...DEFAULT_IDS];

  const browser = await chromium.launch({ headless: true, ...chromiumLaunchOptions(BASE) });
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });

  try {
    for (const id of ids) {
      await captureOne(page, id);
    }
  } finally {
    await browser.close();
  }

  console.log(`capture:sample-covers: ok (${ids.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
