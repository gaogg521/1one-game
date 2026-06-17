/** 样品馆试玩 smoke：canvas 加载 + 模板特征 */
import { chromium } from "@playwright/test";
import { sampleProjectId } from "@/lib/sample-gallery";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";

const CASES = [
  { slug: "temple-relic-runner", expectHeading: "Temple Relic", expectHud: /距离|金币|遗迹/i },
  { slug: "crashy-roads", expectHeading: "Crashy Roads", expectHud: /距离|得分|生命/i },
  { slug: "gun-merge-3d-zombie-apocalypse", expectHeading: "Gun Merge", expectHud: /塔|波次|金币/i },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let failed = 0;

  for (const c of CASES) {
    const id = sampleProjectId(c.slug);
    const url = `${BASE}/play/${id}`;
    console.log(`→ ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    try {
      await page.getByText("继续共创").waitFor({ timeout: 20_000 });
      await page.locator("canvas").first().waitFor({ timeout: 25_000 });
      const heading = await page.getByRole("heading", { level: 1 }).textContent();
      if (!heading?.includes(c.expectHeading.split(" ")[0]!)) {
        console.error(`[FAIL] ${c.slug} heading=${heading}`);
        failed += 1;
      } else {
        console.log(`[OK] ${c.slug} canvas loaded, title=${heading?.slice(0, 40)}`);
      }
    } catch (e) {
      console.error(`[FAIL] ${c.slug}`, e instanceof Error ? e.message : e);
      failed += 1;
    }
  }

  await browser.close();
  if (failed > 0) process.exit(1);
  console.log(`qa-sample-play: ${CASES.length}/${CASES.length} OK`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
