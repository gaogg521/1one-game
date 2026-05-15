import { expect, test } from "@playwright/test";

test("创作台可加载且含创意输入", async ({ page }) => {
  await page.goto("/create");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByPlaceholder(/场景 \+ 目标 \+ 障碍/)).toBeVisible();
});
