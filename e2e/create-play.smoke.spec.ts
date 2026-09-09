import { expect, test } from "./test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { createProjectViaApi, ensureOwnerSession } from "./helpers/owner";
import { gotoPlay } from "./helpers/play";

/** 共创闭环：创建项目 → 试玩页加载 → PATCH 保存 */
test.describe.configure({ mode: "serial" });

test("创作台可加载", async ({ page }) => {
  await page.goto("/create");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main textarea").first()).toBeVisible();
});

test("创建项目后先进入生产页并可保存 spec", async ({ page }) => {
  await ensureOwnerSession(page);
  const prompt = "收集散落金币躲开尖刺";
  const spec = mockSpecFromPrompt(prompt);

  const create = await page.request.post("/api/projects", {
    data: { prompt },
  });
  expect(create.ok()).toBeTruthy();
  const { project } = (await create.json()) as { project?: { id?: string } };
  expect(project?.id).toBeTruthy();
  const id = project!.id!;

  await gotoPlay(page, id);
  await expect(page.getByTestId("game-production-screen")).toBeVisible({ timeout: 25_000 });
  await expect(page.locator("canvas")).toHaveCount(0);

  const patched = { ...spec, title: `${spec.title}·手测保存` };
  const save = await page.request.patch(`/api/projects/${id}`, {
    data: { spec: patched, prompt },
  });
  expect(save.ok()).toBeTruthy();

  const get = await page.request.get(`/api/projects/${id}`);
  const data = (await get.json()) as { spec?: { title?: string } };
  expect(data.spec?.title).toContain("·手测保存");
});

test("手机生成失败页保留重试入口并显示重试错误", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route("**/api/projects/e2e-failed-build", async route => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({ status: 500, json: { error: "重试暂时不可用" } });
      return;
    }
    await route.fulfill({ json: {
      spec: mockSpecFromPrompt("开心消消乐"),
      project: { title: "开心消消乐", prompt: "创建一个开心消消乐", isOwner: true },
      runtimeDelivery: { status: "unverified", blockers: [] },
      core: { revision: { id: "failed-revision", status: "failed" } },
      assetJob: null,
    } });
  });
  await gotoPlay(page, "e2e-failed-build");
  await expect(page.getByRole("heading", { name: "这次生成未能完成" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "重新构建" }).click();
  await expect(page.getByTestId("game-production-screen").getByRole("alert")).toContainText("重试暂时不可用");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
