import { expect, test } from "@playwright/test";
import { sampleProjectId } from "@/lib/sample-gallery";

/** 英文路径样品馆：Rail in Air 专用 CoasterScene + 英文化 HUD */
test("英文试玩页 sample-rail-in-air 加载 CoasterScene HUD", async ({ page }) => {
  const id = sampleProjectId("rail-in-air");
  await page.goto(`/en/play/${id}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Rail in Air", {
    timeout: 20_000,
  });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 25_000 });

  // CoasterScene canvas HUD（Phaser 文本在 canvas 内，通过页面不应出现中文操控提示）
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/视角 · V/);
});
