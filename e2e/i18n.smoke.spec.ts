import { expect, test } from "@playwright/test";

test("首次访问可根据浏览器语言进入英文界面", async ({ browser }) => {
  const context = await browser.newContext({
    locale: "en-US",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const page = await context.newPage();

  await page.goto("/");

  await expect(page).toHaveURL(/\/en(?:\/)?$/);
  await expect(page.locator("main").getByRole("link", { name: /^Start Creating$/ }).first()).toBeVisible();

  await context.close();
});

test("手动切换到英文后刷新仍保持", async ({ page }) => {
  await page.goto("/zh-Hans");

  await page.getByRole("button", { name: /语言|Language/i }).click();
  await page.getByRole("menuitem", { name: /English/i }).click();

  await expect(page).toHaveURL(/\/en(?:\/)?$/);
  await page.reload();
  await expect(page.locator("main").getByRole("link", { name: /^Start Creating$/ }).first()).toBeVisible();
});
