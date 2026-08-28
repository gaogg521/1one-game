import { chromium } from "playwright";
import { chromiumLaunchOptions, healthOk } from "@/lib/qa/run-sample-gameplay-interaction-audit";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";
const CASES = [
  ["voxel-power-frontier", 8], ["neon-territory-loop", 12], ["hundred-gate-breaker", 10],
  ["grand-estate-merge", 8], ["blockland-sharpshooter", 8], ["voxel-daybreak-survival", 9],
  ["passenger-rail-express", 12], ["fusion-legends-arena", 8], ["sparkle-auto-spa", 12],
  ["red-blue-arsenal", 10],
] as const;

async function main() {
  if (!(await healthOk(BASE))) throw new Error(`service not ready at ${BASE}`);
  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    for (const [id, target] of CASES) {
      await page.goto(`${BASE}/zh-Hans/play/sample-${id}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => (window as Window & { __PHASER_PLAY_READY__?: boolean }).__PHASER_PLAY_READY__ === true, null, { timeout: 20_000 });
      const canvas = page.locator("canvas").first();
      await canvas.waitFor({ state: "visible", timeout: 15_000 });
      const box = await canvas.boundingBox();
      if (!box) throw new Error(`${id}: canvas bounding box missing`);
      for (let i = 0; i < target; i += 1) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.9);
        await page.waitForTimeout(35);
      }
      await page.waitForFunction(
        () => (window as Window & { __PHASER_QA_STATE__?: Record<string, unknown> }).__PHASER_QA_STATE__?.cloneCompleted === true,
        null,
        { timeout: 5_000 },
      );
      const state = await page.evaluate(() => (window as Window & { __PHASER_QA_STATE__?: Record<string, unknown> }).__PHASER_QA_STATE__);
      if (state?.cloneMode == null || Number(state.cloneProgress) < Number(state.cloneTarget)) {
        throw new Error(`${id}: invalid completion state ${JSON.stringify(state)}`);
      }
      console.log(`[OK] ${id} completed ${state.cloneProgress}/${state.cloneTarget}`);
    }
    console.log("qa:competitor-home-clones:browser: ok (10/10)");
  } finally {
    await browser.close();
  }
}

void main();
