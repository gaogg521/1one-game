import { test, expect } from "@playwright/test";

test.describe("小说模块", () => {
  test("小说创作页可加载", async ({ page }) => {
    await page.goto("http://127.0.0.1:8888/novel/create");
    await expect(page.getByRole("heading", { name: "创作小说" })).toBeVisible();
    await expect(page.getByPlaceholder(/书名|例如/)).toBeVisible();
    await expect(page.getByRole("button", { name: /下一步/ })).toBeVisible();
  });

  test("小说创作页在接口失败时会退出加载态", async ({ page }) => {
    test.setTimeout(90_000);

    const stubBrief = {
      version: 1,
      userPrompt: "断点恢复测试",
      title: "断点恢复测试",
      genreId: "urban",
      genreLabel: "都市",
      logline: "测试梗概",
      setting: "现代都市",
      world: "现实世界",
      protagonist: "主角",
      characters: ["主角"],
      antagonists: ["对手"],
      coreConflict: "成长与选择",
      protagonistGoal: "完成目标",
      plotBeats: ["开篇", "转折", "高潮"],
      keyScenes: ["雨夜相遇"],
      tone: "写实",
      writingStyle: ["第三人称"],
      narrativeHints: ["快节奏"],
      negatives: [],
      expandSource: "pack",
    };

    await page.route("**/api/creative-brief/expand", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          briefKind: "novel",
          oneLineSummary: "测试梗概",
          brief: stubBrief,
        }),
      });
    });

    await page.route("**/api/novel/generate/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `data: ${JSON.stringify({ step: "error", message: "小说生成失败：模型未返回足够内容" })}\n\n`,
      });
    });

    await page.goto("http://127.0.0.1:8888/novel/create", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "创作小说" })).toBeVisible();
    const titleInput = page.getByTestId("novel-title-input");
    await expect(titleInput).toBeVisible();
    await titleInput.fill("断点恢复测试");
    const urbanButton = page.locator('button[data-genre-id="urban"]');
    await expect(urbanButton).toBeVisible();
    for (let i = 0; i < 3; i += 1) {
      await urbanButton.click();
      if ((await urbanButton.getAttribute("aria-pressed")) === "true") break;
      await page.waitForTimeout(300);
    }
    await expect(urbanButton).toHaveAttribute("aria-pressed", "true");
    const nextButton = page.getByRole("button", { name: /下一步/ });
    await titleInput.fill("断点恢复测试");
    await expect(nextButton).toBeEnabled();
    await nextButton.click();
    await page.getByRole("button", { name: /确认构思，进入写作/ }).click({ timeout: 20_000 });
    await page.getByRole("button", { name: /开始生成正文/ }).click();

    await expect(page.getByRole("button", { name: /正在写作/ })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/小说生成失败|生成失败/)).toBeVisible({ timeout: 15_000 });
  });

  test("小说广场可加载", async ({ page }) => {
    await page.goto("http://127.0.0.1:8888/novel/discover");
    await expect(page.locator("text=小说广场")).toBeVisible();
    await expect(page.getByRole("link", { name: /创作小说|开始创作/ }).first()).toBeVisible();
  });
});

test.describe("漫画模块", () => {
  test("漫画创作页可加载", async ({ page }) => {
    await page.goto("http://127.0.0.1:8888/comic/create");
    await expect(page.locator("text=创作漫画")).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.getByRole("button", { name: /生成分镜/ })).toBeVisible();
  });

  test("漫画广场可加载", async ({ page }) => {
    await page.goto("http://127.0.0.1:8888/comic/discover");
    await expect(page.locator("text=动漫广场")).toBeVisible();
  });
});
