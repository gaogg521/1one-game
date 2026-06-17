/** 样品馆语义模板试玩 smoke（扩展 Phase 4） */
import { chromium } from "@playwright/test";
import { sampleProjectId } from "@/lib/sample-gallery";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";

const SAMPLES = [
  "elastic-thief-2",
  "blade-defender-merge",
  "pottery-master-3d",
  "gun-merge-3d-zombie-apocalypse",
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let failed = 0;

  for (const slug of SAMPLES) {
    const id = sampleProjectId(slug);
    const url = `${BASE}/play/${id}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByText("继续共创").waitFor({ timeout: 20_000 });
      await page.locator("canvas").first().waitFor({ timeout: 25_000 });
      console.log(`[OK] ${slug}`);
    } catch (e) {
      console.error(`[FAIL] ${slug}`, e instanceof Error ? e.message : e);
      failed += 1;
    }
  }

  await browser.close();
  if (failed > 0) process.exit(1);
  console.log(`qa-sample-play-extended: ${SAMPLES.length}/${SAMPLES.length} OK`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
