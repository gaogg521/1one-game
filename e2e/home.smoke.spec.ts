import { expect, test } from "./test";

test("首页可加载且指向创作入口", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: /开始创作|Start Creating/i }).first()).toBeVisible();
});
