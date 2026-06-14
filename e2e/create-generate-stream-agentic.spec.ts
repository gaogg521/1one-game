import { expect, test } from "./test";
import { ensureOwnerSession } from "./helpers/owner";
import {
  stubBackgroundGenApi,
  stubGameSpriteAssets,
  stubGenerateStreamAgentic,
} from "./helpers/generate-stream-stub";
import { shouldUseAgenticRuntime } from "@/lib/agentic/game-module";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";

/** 创作页闭环：/create → SSE generate/stream → dedicated Scene → 保存试玩 canvas */
test.describe.configure({ mode: "serial" });

test("创作页 generate/stream 闭环并试玩 PhysicsScene canvas", async ({ page }) => {
  test.setTimeout(120_000);

  const prompt = "打击 dummy 假人解压";
  let streamHits = 0;

  await stubGameSpriteAssets(page);
  await stubBackgroundGenApi(page);
  await stubGenerateStreamAgentic(page, {
    prompt,
    onHit: () => {
      streamHits += 1;
    },
  });

  await ensureOwnerSession(page);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main textarea").first()).toBeVisible();

  await page.locator("main textarea").first().fill(prompt);
  const planBtn = page.getByRole("button", { name: /提炼创作方向|Plan creative direction/i });
  await expect(planBtn).toBeEnabled({ timeout: 15_000 });
  await planBtn.click();
  await expect(page.getByText(/physics|物理|dummy|假人/i).first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /生成可玩版本|Generate playable/i }).click();
  await expect(page.getByRole("button", { name: /保存并试玩|Save and play/i })).toBeEnabled({
    timeout: 20_000,
  });

  expect(streamHits).toBeGreaterThan(0);

  await page.getByRole("button", { name: /保存并试玩|Save and play/i }).click();
  await page.waitForURL(/\/play\//, { timeout: 60_000 });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 25_000 });

  const projectId = page.url().split("/play/")[1]?.split(/[?#]/)[0];
  expect(projectId).toBeTruthy();

  const get = await page.request.get(`/api/projects/${projectId}`);
  expect(get.ok()).toBeTruthy();
  const saved = (await get.json()) as {
    spec?: { agenticModule?: { source?: string }; templateId?: string };
  };
  expect(shouldUseAgenticRuntime(saved.spec!)).toBe(false);
  expect(saved.spec?.agenticModule?.source).toBeUndefined();
  expect(expectedPhaserSceneName(saved.spec!)).toBe("PhysicsScene");
});
