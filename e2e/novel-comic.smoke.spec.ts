import { test, expect } from "./test";

test.describe.configure({ mode: "serial" });

test.describe("小说模块", () => {
  test("小说创作页可加载", async ({ page }) => {
    await page.goto("/novel/create");
    await expect(page.getByRole("heading", { name: /创作小说|Create Novel/i })).toBeVisible();
    await expect(page.getByPlaceholder(/书名|例如|title/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /下一步|Next/i })).toBeVisible();
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

    await page.goto("/novel/create", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /创作小说|Create Novel/i })).toBeVisible();
    const titleInput = page.getByTestId("novel-title-input");
    await expect(titleInput).toBeVisible();
    const urbanButton = page.locator('button[data-genre-id="urban"]');
    await expect(async () => {
      await urbanButton.scrollIntoViewIfNeeded();
      await urbanButton.click();
      await expect(urbanButton).toHaveAttribute("aria-pressed", "true");
    }).toPass({ timeout: 15_000 });
    await titleInput.fill("断点恢复测试");
    const nextButton = page.getByRole("button", { name: /下一步|Next/i });
    await titleInput.fill("断点恢复测试");
    await expect(nextButton).toBeEnabled();
    await nextButton.click();
    await page.getByRole("button", { name: /确认构思，进入写作|Confirm Brief and Start Writing/i }).click({ timeout: 20_000 });
    await page.getByRole("button", { name: /开始生成正文|Generate Story/i }).click();

    await expect(page.getByRole("button", { name: /正在写作|Writing/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/小说生成失败|生成失败|generation failed/i)).toBeVisible({ timeout: 15_000 });
  });

  test("小说广场可加载", async ({ page }) => {
    await page.goto("/novel/discover");
    await expect(page.getByRole("heading", { name: /小说作品|Novel Works/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /开始创作|Start Creating/i }).first()).toBeVisible();
  });
});

test.describe("漫画模块", () => {
  test("漫画创作页可加载（独立创作模式）", async ({ page }) => {
    await page.goto("/comic/create");
    await expect(page.getByRole("heading", { name: /创作漫画|Create Comic/i })).toBeVisible();
    await expect(page.getByTestId("comic-create-mode-standalone")).toBeVisible();
    await expect(page.getByTestId("comic-create-mode-from-novel")).toBeVisible();
    await expect(page.getByTestId("comic-create-standalone-form")).toBeVisible();
    await expect(page.locator("textarea").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /生成分镜|Generate storyboard/i })).toBeVisible();
  });

  test("漫画创作页可切换到「从我的小说」", async ({ page }) => {
    await page.goto("/comic/create");
    await page.getByTestId("comic-create-mode-from-novel").click();
    const fromNovelPanel = page.getByTestId("comic-create-from-novel-panel");
    await expect(fromNovelPanel).toBeVisible();
    await expect(fromNovelPanel.getByText(/选择你写过的小说|Pick a novel you wrote/i)).toBeVisible();
  });

  test("漫画创作页 novelId 深链可预填小说", async ({ page }) => {
    const novelId = "e2e-comic-prefill-novel";
    await page.route("**/api/novel?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ novels: [] }),
      });
    });
    await page.route(`**/api/novel/${novelId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          novel: {
            id: novelId,
            title: "深链测试小说",
            prompt: "穿越 历史",
            isOwner: true,
            lengthTier: "medium",
          },
        }),
      });
    });
    await page.goto(`/comic/create?novelId=${novelId}`);
    const selectedNovel = page.getByTestId("comic-create-selected-novel");
    await expect(selectedNovel).toBeVisible({ timeout: 15_000 });
    await expect(selectedNovel.getByText(/深链测试小说/)).toBeVisible();
    await expect(page.getByRole("button", { name: /从该小说生成分镜|Generate storyboard from this novel/i })).toBeVisible();
  });

  test("漫画广场可加载", async ({ page }) => {
    await page.goto("/comic/discover");
    await expect(page.getByRole("heading", { name: /动漫作品|Comic Works/i })).toBeVisible();
  });
});
