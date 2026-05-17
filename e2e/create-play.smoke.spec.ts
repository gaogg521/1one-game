import { expect, test } from "@playwright/test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";

/** 共创闭环：创建项目 → 试玩页加载 → PATCH 保存 */
test.describe.configure({ mode: "serial" });

test("创作台可加载", async ({ page }) => {
  await page.goto("/create");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByPlaceholder(/场景 \+ 目标 \+ 障碍/)).toBeVisible();
});

test("创建项目并在试玩页保存 spec", async ({ page }) => {
  await page.goto("/");
  const prompt = "收集散落金币躲开尖刺";
  const spec = mockSpecFromPrompt(prompt);

  const create = await page.request.post("/api/projects", {
    data: { prompt, spec },
  });
  expect(create.ok()).toBeTruthy();
  const { project } = (await create.json()) as { project?: { id?: string } };
  expect(project?.id).toBeTruthy();
  const id = project!.id!;

  await page.goto(`/play/${id}`);
  await expect(page.getByText("继续共创")).toBeVisible({ timeout: 15_000 });

  const patched = { ...spec, title: `${spec.title}·手测保存` };
  const save = await page.request.patch(`/api/projects/${id}`, {
    data: { spec: patched, prompt },
  });
  expect(save.ok()).toBeTruthy();

  const get = await page.request.get(`/api/projects/${id}`);
  const data = (await get.json()) as { spec?: { title?: string } };
  expect(data.spec?.title).toContain("·手测保存");
});
