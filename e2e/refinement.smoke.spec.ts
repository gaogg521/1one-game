import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";

/** SQLite 并行写易锁；精炼链路串行跑更稳 */
test.describe.configure({ mode: "serial" });

async function ownerApi(page: Page): Promise<APIRequestContext> {
  await page.goto("/");
  return page.request;
}

async function createProject(
  api: APIRequestContext,
  prompt = "收集散落金币躲开尖刺",
) {
  const spec = mockSpecFromPrompt(prompt);
  const res = await api.post("/api/projects", {
    data: { prompt, spec },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`POST /api/projects ${res.status()}: ${body.slice(0, 400)}`);
  }
  const data = (await res.json()) as { project?: { id?: string } };
  expect(data.project?.id).toBeTruthy();
  return { id: data.project!.id!, spec, prompt };
}

test.describe("refinement API", () => {
  test("未登录 refine 返回 401", async ({ request }) => {
    const res = await request.post("/api/projects/cuid_fake/refine", {
      data: { instruction: "加快节奏", mode: "patch" },
    });
    expect(res.status()).toBe(401);
  });

  test("主人 patch 精炼写入日志并可保存 spec", async ({ page }) => {
    const api = await ownerApi(page);
    const { id, spec, prompt } = await createProject(api);
    const instruction = "e2e-patch";

    const refine = await api.post(`/api/projects/${id}/refine`, {
      data: { instruction, mode: "patch" },
    });
    if (!refine.ok()) {
      const body = await refine.text();
      throw new Error(`POST refine ${refine.status()}: ${body.slice(0, 400)}`);
    }
    const refined = (await refine.json()) as {
      spec?: { title?: string };
      prompt?: string;
      refinementHistory?: Array<{ mode: string; instruction: string }>;
    };
    expect(refined.spec?.title).toContain("·e2e-patch");
    expect(refined.refinementHistory?.length).toBe(1);
    expect(refined.refinementHistory?.[0]?.mode).toBe("patch");

    const save = await api.patch(`/api/projects/${id}`, {
      data: { spec: refined.spec, prompt: refined.prompt ?? prompt },
    });
    expect(save.ok()).toBeTruthy();

    const get = await api.get(`/api/projects/${id}`);
    const loaded = (await get.json()) as {
      spec?: { title?: string };
      refinementHistory?: unknown[];
    };
    expect(loaded.spec?.title).toBe(refined.spec?.title);
    expect(loaded.refinementHistory?.length).toBe(1);

    expect(spec.title).not.toBe(loaded.spec?.title);
  });

  test("主人 regenerate 精炼后 create?from= 可见摘要", async ({ page }) => {
    const api = await ownerApi(page);
    const { id } = await createProject(api);
    const instruction = "e2e-regen";

    const refine = await api.post(`/api/projects/${id}/refine`, {
      data: { instruction, mode: "regenerate" },
    });
    expect(refine.ok()).toBeTruthy();

    await page.goto(`/create?from=${encodeURIComponent(id)}`);
    await expect(page.getByText("试玩页精炼记录（摘要）")).toBeVisible();
    await expect(page.getByText(/regenerate.*e2e-regen/)).toBeVisible();
  });

  test("访客 GET 不返回 refinementHistory", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const ownerApiCtx = await ownerApi(ownerPage);
    const { id } = await createProject(ownerApiCtx);

    await ownerApiCtx.post(`/api/projects/${id}/refine`, {
      data: { instruction: "guest-hide", mode: "patch" },
    });

    const guestPage = await guestCtx.newPage();
    await guestPage.goto("/");
    const guestRes = await guestCtx.request.get(`/api/projects/${id}`);
    const guestData = (await guestRes.json()) as { refinementHistory?: unknown; project?: { isOwner?: boolean } };
    expect(guestData.project?.isOwner).toBe(false);
    expect(guestData.refinementHistory).toBeUndefined();

    await ownerCtx.close();
    await guestCtx.close();
  });

  test("访客 refine 返回 401", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const ownerApiCtx = await ownerApi(ownerPage);
    const { id } = await createProject(ownerApiCtx);
    await ownerCtx.close();

    const guestCtx = await browser.newContext();
    const res = await guestCtx.request.post(`/api/projects/${id}/refine`, {
      data: { instruction: "hack", mode: "patch" },
    });
    expect(res.status()).toBe(401);
    await guestCtx.close();
  });
});

test.describe("refinement UI", () => {
  test("主人试玩页可精炼并保存", async ({ page }) => {
    const api = await ownerApi(page);
    const { id } = await createProject(api);

    await page.goto(`/play/${id}`);
    await expect(page.getByText("继续共创")).toBeVisible();
    await expect(page.getByRole("button", { name: "局部 patch" })).toBeVisible();

    await page.locator("#patch-prompt").fill("ui-patch");
    await page.getByRole("button", { name: "AI 修改" }).click();
    await expect(page.getByText("最近精炼（最新在后）")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/patch.*ui-patch/)).toBeVisible();

    await page.getByRole("button", { name: "应用并保存" }).click();
    await expect(page.getByText("已保存到项目版本")).toBeVisible({ timeout: 10_000 });

    const reload = await api.get(`/api/projects/${id}`);
    const data = (await reload.json()) as { spec?: { title?: string } };
    expect(data.spec?.title).toContain("·ui-patch");
  });

  test("访客试玩页无 refine 模式按钮", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const ownerApiCtx = await ownerApi(ownerPage);
    const { id } = await createProject(ownerApiCtx);
    await ownerCtx.close();

    const guestCtx = await browser.newContext();
    const guestPage = await guestCtx.newPage();
    await guestPage.goto(`/play/${id}`);
    await expect(guestPage.getByText("继续共创")).toBeVisible();
    await expect(guestPage.getByRole("button", { name: "局部 patch" })).toHaveCount(0);
    await guestCtx.close();
  });
});
