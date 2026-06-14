/**
 * 平台用户感知 E2E：游戏 parity 入口 + 文学改编信任条（UI 可见性）
 * npx playwright test e2e/platform-user-journey.smoke.spec.ts
 */
import { expect, test } from "./test";
import { SAMPLES } from "@/lib/samples";
import { buildCanonicalAstrocadeSpec } from "@/lib/astrocade-canonical-spec";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";
import { createProjectViaApi, ensureOwnerSession } from "./helpers/owner";
import { gotoPlay } from "./helpers/play";

async function openSamplesWhenReady(
  page: import("@playwright/test").Page,
  linkTestId: "sample-start-with-prompt" | "sample-create-with-prompt",
) {
  await page.goto("/samples", { waitUntil: "domcontentloaded" });
  const link = page.getByTestId(linkTestId).first();
  await expect(link).toBeVisible({ timeout: 60_000 });
  await expect(link).not.toHaveClass(/pointer-events-none/, { timeout: 60_000 });
  return link;
}

test.describe.configure({ mode: "serial" });

test.describe("统一入口 /start", () => {
  test("样品 prompt → 推荐游戏 + parity 提示 + 预填创作", async ({ page }) => {
    const sample = SAMPLES[0]!;
    await page.goto("/start");
    await page.locator("#start-prompt").fill(sample.prompt);
    await expect(page.getByTestId("start-sample-parity-hint")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("start-mode-recommendation")).toContainText(/游戏|Game/i);
    await page.getByTestId("start-create-cta").click();
    await expect(page).toHaveURL(/\/create\?prefill=/, { timeout: 15_000 });
    await expect(page.getByTestId("sample-intent-hint")).toBeVisible({ timeout: 10_000 });
  });

  test("小说 prompt → 推荐小说并预填", async ({ page }) => {
    const prompt = "写一个三章武侠小说，要有完整结局和章节";
    await page.goto("/start");
    await page.locator("#start-prompt").fill(prompt);
    await expect(page.getByTestId("start-mode-recommendation")).toContainText(/小说|Novel/i);
    await page.getByTestId("start-create-cta").click();
    await expect(page).toHaveURL(/\/novel\/create\?prefill=/, { timeout: 15_000 });
  });

  test("/start?prefill= 深链预填 prompt", async ({ page }) => {
    const sample = SAMPLES[0]!;
    const encoded = encodeURIComponent(sample.prompt.slice(0, 4000));
    await page.goto(`/start?prefill=${encoded}`);
    await expect(page.getByTestId("start-prompt-input")).toHaveValue(sample.prompt, { timeout: 10_000 });
    await expect(page.getByTestId("start-sample-parity-hint")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("游戏 · 用户可见 parity", () => {
  test("样品馆「智能推荐」→ /start 预填 + parity 提示", async ({ page }) => {
    const sample = SAMPLES[0]!;
    const startLink = await openSamplesWhenReady(page, "sample-start-with-prompt");
    const href = await startLink.getAttribute("href");
    expect(href).toMatch(/\/start\?prefill=/);
    await page.goto(href!);
    await expect(page).toHaveURL(/\/start\?prefill=/, { timeout: 15_000 });
    await expect(page.getByTestId("start-prompt-input")).toHaveValue(sample.prompt, { timeout: 10_000 });
    await expect(page.getByTestId("start-sample-parity-hint")).toBeVisible({ timeout: 10_000 });
  });

  test("样品馆「用此 prompt 创作」→ 创作台同款预期", async ({ page }) => {
    const sample = SAMPLES[0]!;
    const createLink = await openSamplesWhenReady(page, "sample-create-with-prompt");
    const href = await createLink.getAttribute("href");
    expect(href).toMatch(/prefill=/);
    await page.goto(href!);
    await expect(page).toHaveURL(/prefill=/, { timeout: 15_000 });
    await expect(page.getByTestId("sample-intent-hint")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#prompt")).toHaveValue(new RegExp(sample.prompt.slice(0, 12)));
  });

  test("同 prompt 试玩页展示 parity 信任条", async ({ page }) => {
    const sample = SAMPLES[0]!;
    await ensureOwnerSession(page);
    const spec = prepareGameSpecForPersist(
      buildCanonicalAstrocadeSpec(sample.prompt, "zh-Hans", { sampleId: sample.id }),
      sample.prompt,
      "zh-Hans",
    );
    const { id } = await createProjectViaApi(page.request, sample.prompt, spec);
    await gotoPlay(page, id);
    await expect(page.getByTestId("sample-parity-trust-badge")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("文学 · 用户可见改编", () => {
  const novelId = "e2e-literary-ui-mock";
  const comicId = "e2e-comic-ui-mock";
  const createFlowNovelId = "e2e-novel-create-adapt";

  const stubNovelBrief = {
    version: 1,
    userPrompt: "煤山崇祯改写结局",
    title: "煤山崇祯改写结局",
    genreId: "historical",
    genreLabel: "历史",
    logline: "穿越成崇祯后改写煤山结局",
    setting: "明末",
    world: "大明",
    protagonist: "崇祯",
    characters: ["崇祯"],
    antagonists: ["李自成"],
    coreConflict: "亡国与自救",
    protagonistGoal: "改写结局",
    plotBeats: ["煤山", "破局", "太平"],
    keyScenes: ["煤山夜话"],
    tone: "厚重",
    writingStyle: ["第三人称"],
    narrativeHints: ["历史细节"],
    negatives: [],
    expandSource: "pack",
  };

  const stubNovelDetail = {
    id: createFlowNovelId,
    title: "穿越到煤山的崇祯帝",
    prompt: "穿越 历史 崇祯 明末",
    content:
      "=== 第1章 煤山 ===\n崇祯低声道：「朕不能亡于此。」\n\n=== 第2章 破局 ===\n他终于改写了亡国结局，天下重归太平。",
    summary: "穿越成崇祯后改写煤山结局",
    lengthTier: "medium",
    createdAt: new Date().toISOString(),
    comics: [],
    shareCode: null,
    isOwner: true,
    coverPath: null,
    visibility: "private",
    chapterAdaptation: {
      totalChapters: 2,
      adaptedCount: 0,
      adaptedChapterNums: [],
      nextChapter: { fromChapter: 1, toChapter: 1, label: "第1章 煤山" },
    },
    draftStoryboardComics: [],
  };

  test("小说完成页 → 改编为漫画 → ?adaptComic=1", async ({ page }) => {
    test.setTimeout(120_000);

    await page.route("**/api/creative-brief/expand", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          briefKind: "novel",
          oneLineSummary: stubNovelBrief.logline,
          brief: stubNovelBrief,
        }),
      });
    });

    await page.route("**/api/novel/generate/stream", async (route) => {
      const body = [
        `data: ${JSON.stringify({ step: "start", message: "开始写作" })}\n\n`,
        `data: ${JSON.stringify({ step: "delta", text: "崇祯低声道" })}\n\n`,
        `data: ${JSON.stringify({ step: "done", novel: { id: createFlowNovelId } })}\n\n`,
      ].join("");
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body,
      });
    });

    await page.route(`**/api/novel/${createFlowNovelId}`, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ novel: stubNovelDetail }),
      });
    });

    await page.route(`**/api/novel/${createFlowNovelId}/cover**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ coverPath: null }),
      });
    });

    await page.route(`**/api/novel/${createFlowNovelId}/play`, async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await page.goto("/novel/create", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /创作小说|Create Novel/i })).toBeVisible();

    const titleInput = page.getByTestId("novel-title-input");
    await titleInput.fill("煤山崇祯改写结局");
    const historicalButton = page.locator('button[data-genre-id="historical"]');
    await expect(async () => {
      await historicalButton.scrollIntoViewIfNeeded();
      await historicalButton.click();
      await expect(historicalButton).toHaveAttribute("aria-pressed", "true");
    }).toPass({ timeout: 15_000 });

    await page.getByRole("button", { name: /下一步|Next/i }).click();
    await page.getByRole("button", { name: /确认构思，进入写作|Confirm Brief and Start Writing/i }).click({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /开始生成正文|Generate Story/i }).click();

    await expect(page.getByTestId("novel-adapt-comic-cta")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("novel-adapt-comic-cta").click();
    await expect(page).toHaveURL(new RegExp(`/novel/${createFlowNovelId}\\?adaptComic=1`), {
      timeout: 15_000,
    });
    await expect(page.getByTestId("literary-adaptation-trust-badge")).toBeVisible({ timeout: 15_000 });
  });

  test("小说 ?adaptComic=1 展开改编区与信任条", async ({ page }) => {
    await page.route(`**/api/novel/${novelId}`, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          novel: {
            id: novelId,
            title: "穿越到煤山的崇祯帝",
            prompt: "穿越 历史 崇祯 明末",
            content:
              "=== 第1章 煤山 ===\n崇祯低声道：「朕不能亡于此。」\n\n=== 第2章 破局 ===\n他终于改写了亡国结局，天下重归太平。",
            summary: "穿越成崇祯后改写煤山结局",
            lengthTier: "medium",
            createdAt: new Date().toISOString(),
            comics: [],
            shareCode: null,
            isOwner: true,
            chapterAdaptation: {
              totalChapters: 2,
              adaptedCount: 0,
              adaptedChapterNums: [],
              nextChapter: { fromChapter: 1, toChapter: 1, label: "第1章 煤山" },
            },
            draftStoryboardComics: [],
          },
        }),
      });
    });
    await page.route(`**/api/novel/${novelId}/play`, async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await page.goto(`/novel/${novelId}?adaptComic=1`);
    await expect(page.getByTestId("literary-adaptation-trust-badge")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /开始生成分镜|生成新一版分镜|Generate/i })).toBeVisible();
  });

  test("漫画详情页展示文学改编信任条", async ({ page }) => {
    const doc = {
      formatVersion: 2,
      pageCount: 1,
      pages: [{ page: 1, panels: [{ caption: "朕不能亡于此", prompt: "historical palace scene" }] }],
      chapterScope: { fromChapter: 1, toChapter: 1, label: "第1章 煤山" },
      chapterScopeLabel: "第1章 煤山",
      readMode: "segment",
      layoutId: "grid_8",
    };
    await page.route(`**/api/comic/${comicId}`, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          comic: {
            id: comicId,
            title: "穿越到煤山的崇祯帝 · 漫画版",
            displayTitle: "穿越到煤山的崇祯帝 · 漫画版",
            imageUrls: JSON.stringify(doc),
            createdAt: new Date().toISOString(),
            shareCode: null,
            isOwner: true,
            status: "ready",
            panelsWithImage: 1,
            panelsTotal: 1,
            novel: { id: novelId, title: "穿越到煤山的崇祯帝", displayTitle: "穿越到煤山的崇祯帝" },
          },
        }),
      });
    });

    await page.goto(`/comic/${comicId}`);
    await expect(page.getByTestId("literary-adaptation-trust-badge")).toBeVisible({ timeout: 15_000 });
  });
});
