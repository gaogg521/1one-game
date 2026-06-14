import { expect, test } from "./test";

test("小说广场应加载列表而非超时提示", async ({ page }) => {
  await page.goto("/novel/discover", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /小说作品|Novel Works/i })).toBeVisible({ timeout: 45_000 });
});

test("整页导航往返不应出现 Turbopack 失败页", async ({ page }) => {
  test.setTimeout(120_000);
  const ROUTES = ["/", "/studio", "/discover", "/novel/discover", "/create", "/start", "/"];

  for (const path of ROUTES) {
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByText("This page couldn't load")).toHaveCount(0);
    await expect(page.getByText("Reload to try again")).toHaveCount(0);
    await expect(page.getByText("页面加载失败")).toHaveCount(0);
  }
});

test("客户端 Link 导航不应出现 Turbopack 失败页", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });

  const nav = [
    { name: "创作者工作台", url: /\/studio/ },
    { name: "游戏发现", url: /\/discover/ },
  ];

  for (let round = 0; round < 3; round++) {
    for (const { name, url } of nav) {
      await page.getByRole("link", { name, exact: true }).first().click();
      await page.waitForURL(url, { timeout: 30_000 });
      await expect(page.getByText("This page couldn't load")).toHaveCount(0);
      await expect(page.getByText("Reload to try again")).toHaveCount(0);
    }
    await page.goto("/");
  }
});
