import { expect, test } from "./test";

test("创作台可加载且含创意输入", async ({ page }) => {
  await page.goto("/create");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main textarea").first()).toBeVisible();
});

test("一句话提交后直接创建生产任务并进入统一生成页", async ({ page }) => {
  const prompt = "创建一个开心消消乐的游戏";
  let submittedBody: unknown;
  await page.route("**/api/projects", async (route) => {
    submittedBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ project: { id: "e2e-build-project" } }) });
  });

  await page.goto("/create");
  await page.locator("textarea").fill(prompt);
  await page.getByRole("button", { name: "开始生成游戏" }).click();
  await expect(page).toHaveURL(/\/play\/e2e-build-project$/);
  expect(submittedBody).toEqual({ prompt });
});
