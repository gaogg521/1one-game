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

test("创建项目并在试玩页保存 spec", async ({ page }) => {
  await ensureOwnerSession(page);
  const prompt = "收集散落金币躲开尖刺";
  const spec = mockSpecFromPrompt(prompt);

  const create = await page.request.post("/api/projects", {
    data: { prompt, spec },
  });
  expect(create.ok()).toBeTruthy();
  const { project } = (await create.json()) as { project?: { id?: string } };
  expect(project?.id).toBeTruthy();
  const id = project!.id!;

  await gotoPlay(page, id);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 25_000 });

  const patched = { ...spec, title: `${spec.title}·手测保存` };
  const save = await page.request.patch(`/api/projects/${id}`, {
    data: { spec: patched, prompt },
  });
  expect(save.ok()).toBeTruthy();

  const get = await page.request.get(`/api/projects/${id}`);
  const data = (await get.json()) as { spec?: { title?: string } };
  expect(data.spec?.title).toContain("·手测保存");
});
