import { expect, test } from "./test";
import { sampleProjectId } from "@/lib/sample-gallery";

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

test("首页手机端样品大卡无横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/zh-Hans", { waitUntil: "domcontentloaded" });

  const hero = page.getByTestId("home-featured-hero");
  await expect(hero).toBeVisible();
  const box = await hero.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(300);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBeTruthy();
});

test("样品馆手机端竖列全宽卡片", async ({ page, request }) => {
  const res = await request.post("/api/samples/ensure");
  expect(res.ok()).toBeTruthy();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/zh-Hans/samples", { waitUntil: "domcontentloaded" });

  const card = page.getByTestId("sample-card").first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  const box = await card.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(375 * 0.85);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBeTruthy();
});

test("斗兽棋试玩画布铺满手机宽度", async ({ page, request }) => {
  test.setTimeout(90_000);
  const res = await request.post("/api/samples/ensure");
  expect(res.ok()).toBeTruthy();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/zh-Hans/play/${sampleProjectId("jungle-animal-chess")}`, {
    waitUntil: "domcontentloaded",
  });

  const host = page.getByRole("application");
  await expect(host).toBeVisible({ timeout: 45_000 });
  const box = await host.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(350);
  expect(box?.height ?? 0).toBeGreaterThan(480);
});

test("小说详情页不显示手机底栏", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/zh-Hans/novel/mobile-ux-probe", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("navigation", { name: "手机浏览导航" })).toHaveCount(0);
});

test("小说听书栏完整露出", async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const list = await request.get("/api/novel");
  if (!list.ok()) {
    test.skip(true, "无法读取小说列表");
    return;
  }
  const data = (await list.json()) as { novels?: Array<{ id?: string }>; items?: Array<{ id?: string }> };
  const id = data.novels?.[0]?.id ?? data.items?.[0]?.id;
  if (!id) {
    test.skip(true, "测试库暂无小说");
    return;
  }

  await page.goto(`/zh-Hans/novel/${id}`, { waitUntil: "domcontentloaded" });
  const bar = page.getByTestId("novel-listen-bar");
  if ((await bar.count()) === 0) {
    test.skip(true, "该小说无听书栏");
    return;
  }
  await expect(bar).toBeVisible();
  const box = await bar.boundingBox();
  expect(box).toBeTruthy();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThan(812 - 8);
});

test("2048试玩画布铺满手机宽度", async ({ page, request }) => {
  test.setTimeout(90_000);
  const res = await request.post("/api/samples/ensure");
  expect(res.ok()).toBeTruthy();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/zh-Hans/play/${sampleProjectId("number-merge-2048")}`, {
    waitUntil: "domcontentloaded",
  });

  const host = page.getByRole("application");
  await expect(host).toBeVisible({ timeout: 45_000 });
  const box = await host.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(350);
  expect(box?.height ?? 0).toBeGreaterThan(480);
});

test("漫画详情页不显示手机底栏且分格接近全宽", async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const list = await request.get("/api/comic?limit=1");
  if (!list.ok()) {
    test.skip(true, "无法读取漫画列表");
    return;
  }
  const data = (await list.json()) as { comics?: Array<{ id?: string }> };
  const id = data.comics?.[0]?.id;
  if (!id) {
    test.skip(true, "测试库暂无漫画");
    return;
  }

  await page.goto(`/zh-Hans/comic/${id}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("navigation", { name: "手机浏览导航" })).toHaveCount(0);
  const panel = page.locator("article").first();
  if ((await panel.count()) === 0) {
    test.skip(true, "该漫画暂无分格");
    return;
  }
  await expect(panel).toBeVisible({ timeout: 20_000 });
  const box = await panel.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(300);
});

test("小说阅读标题靠近手机首屏顶部", async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const list = await request.get("/api/novel");
  if (!list.ok()) {
    test.skip(true, "无法读取小说列表");
    return;
  }
  const data = (await list.json()) as { novels?: Array<{ id?: string }>; items?: Array<{ id?: string }> };
  const id = data.novels?.[0]?.id ?? data.items?.[0]?.id;
  if (!id) {
    test.skip(true, "测试库暂无小说");
    return;
  }

  await page.goto(`/zh-Hans/novel/${id}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("navigation", { name: "手机浏览导航" })).toHaveCount(0);
  const heading = page.getByRole("heading", { level: 1 }).first();
  await expect(heading).toBeVisible({ timeout: 20_000 });
  const box = await heading.boundingBox();
  expect(box?.y ?? 999).toBeLessThan(96);
});
