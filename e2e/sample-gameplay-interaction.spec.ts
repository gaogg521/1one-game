/**
 * 17 款样品馆玩法交互 E2E（CI bundle-e2e / competitor-gates）
 */
import { expect, test } from "@playwright/test";
import { SAMPLES } from "@/lib/samples";
import { sampleProjectId } from "@/lib/sample-gallery";
import {
  bufferDiffRatio,
  idleDiffCeiling,
  interactionDiffPasses,
} from "@/lib/qa/canvas-interaction-diff";
import {
  defaultClickRel,
  SAMPLE_GAMEPLAY_CASES,
} from "@/lib/qa/sample-gameplay-interaction";
import {
  performInteraction,
  readSceneKey,
  waitPlayReady,
} from "@/lib/qa/run-sample-gameplay-interaction-audit";

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.beforeAll(async ({ request }) => {
  const res = await request.post("/api/samples/ensure");
  expect(res.ok()).toBeTruthy();
});

for (const sample of SAMPLES) {
  test(`玩法交互 ${sample.id}`, async ({ page }) => {
    const c = SAMPLE_GAMEPLAY_CASES.find((x) => x.sampleId === sample.id)!;
    const id = sampleProjectId(sample.id);

    await page.goto(`/play/${id}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/加载失败|数据不完整|继续共创/i);

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    expect(await waitPlayReady(page)).toBeTruthy();

    const sceneKey = await readSceneKey(page);
    expect(sceneKey).toBe(c.expectedScene);

    const clickRel = c.clickRel ?? defaultClickRel(c.interaction);
    const before = await canvas.screenshot();

    let idleCeiling = 0;
    if (c.animated) {
      const idleFrames = [before];
      for (let i = 0; i < 3; i += 1) {
        await page.waitForTimeout(280);
        idleFrames.push(await canvas.screenshot());
      }
      idleCeiling = await idleDiffCeiling(idleFrames);
    }

    await performInteraction(page, c.interaction, clickRel, c.clickBurst ?? 1);
    await page.waitForTimeout(c.animated ? 520 : 380);
    const after = await canvas.screenshot();
    const diff = await bufferDiffRatio(before, after);

    expect(
      interactionDiffPasses({
        animated: Boolean(c.animated),
        idleCeiling,
        interactionDiff: diff,
      }),
    ).toBeTruthy();
  });
}
