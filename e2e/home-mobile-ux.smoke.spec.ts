import { expect, test } from "./test";

test("首页手机端保留清晰首屏与可展开全量导航", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/zh-Hans", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "立即开始创作" }).first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBeTruthy();

  const menu = page.locator("header details");
  await expect(menu).toBeVisible();
  await menu.locator("summary").click();
  await expect(menu.getByRole("link", { name: "游戏创作" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "创作者工作台" })).toBeVisible();
});
