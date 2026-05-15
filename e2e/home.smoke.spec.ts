import { expect, test } from "@playwright/test";

test("首页可加载且指向创作入口", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("link", { name: "开始创作", exact: true })).toBeVisible();
});
