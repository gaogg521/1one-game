import { test, expect } from "@playwright/test";

test.describe("小说模块", () => {
  test("小说创作页可加载", async ({ page }) => {
    await page.goto("http://127.0.0.1:8888/novel/create");
    await expect(page.getByRole("heading", { name: "创作小说" })).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.locator("button:has-text('开始创作')")).toBeVisible();
  });

  test("小说创作页在接口失败时会退出加载态", async ({ page }) => {
    await page.route("**/api/novel/generate/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `data: ${JSON.stringify({ step: "error", message: "小说生成失败：模型未返回足够内容" })}\n\n`,
      });
    });

    await page.goto("http://127.0.0.1:8888/novel/create");
    await page.locator("textarea").fill("一个会在请求失败时正确恢复状态的故事");
    await page.locator("button:has-text('开始创作')").click();

    await expect(page.getByRole("button", { name: "生成中…" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/小说生成失败/)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("button:has-text('开始创作')")).toBeEnabled();
  });

  test("小说广场可加载", async ({ page }) => {
    await page.goto("http://127.0.0.1:8888/novel/discover");
    await expect(page.locator("text=小说广场")).toBeVisible();
    await expect(page.locator("a:has-text('+ 创作小说')")).toBeVisible();
  });
});

test.describe("漫画模块", () => {
  test("漫画创作页可加载", async ({ page }) => {
    await page.goto("http://127.0.0.1:8888/comic/create");
    await expect(page.locator("text=创作漫画")).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.locator("button:has-text('生成漫画')")).toBeVisible();
  });

  test("漫画广场可加载", async ({ page }) => {
    await page.goto("http://127.0.0.1:8888/comic/discover");
    await expect(page.locator("text=动漫广场")).toBeVisible();
  });
});
