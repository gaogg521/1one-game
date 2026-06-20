import { expect, test, type Page } from "./test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import type { GameSpec } from "@/lib/game-spec";
import { addZhLocaleCookie } from "./helpers/locale";
import { ensureOwnerSession } from "./helpers/owner";
import { gotoPlay } from "./helpers/play";

/** 模拟人工：六模板试玩页加载 + 模板特征 HUD + refine 写回 */
test.describe.configure({ mode: "serial" });

const TEMPLATES: Array<{
  id: GameSpec["templateId"];
  prompt: string;
}> = [
  { id: "avoider", prompt: "躲开从天而降的陨石" },
  { id: "collector", prompt: "收集散落金币躲开尖刺" },
  { id: "survivor", prompt: "多条命生存模式躲开尖刺" },
  { id: "platformer", prompt: "横版闯关跳跃收集钥匙过关" },
  { id: "towerDefense", prompt: "塔防卫萝卜波次守住基地" },
  { id: "shooter", prompt: "飞船射击消灭敌机" },
  { id: "coaster", prompt: "空中轨道过山车竞速" },
  { id: "puzzle", prompt: "色彩消除益智 match3" },
  { id: "farming", prompt: "种植花园浇水收获" },
  { id: "physics", prompt: "打击 dummy 假人解压" },
];

async function createAndOpenPlay(page: Page, prompt: string) {
  const spec = mockSpecFromPrompt(prompt);
  const res = await page.request.post("/api/projects", { data: { prompt, spec } });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`create failed ${res.status()}: ${body.slice(0, 300)}`);
  }
  const { project } = (await res.json()) as { project?: { id?: string } };
  expect(project?.id).toBeTruthy();
  await gotoPlay(page, project!.id!);
  await expect(page.getByText(/继续共创|Keep co-creating/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 25_000 });
  return { id: project!.id!, spec, prompt };
}

for (const row of TEMPLATES) {
  test(`试玩页加载 · ${row.id}`, async ({ page }) => {
    await ensureOwnerSession(page);
    const { spec } = await createAndOpenPlay(page, row.prompt);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(spec.title.slice(0, 8));
    await expect(page.getByRole("button", { name: /全屏|Fullscreen/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /重开|Restart/i })).toBeVisible();
    expect(spec.templateId).toBe(row.id);
  });
}

test("共创闭环 · refine 后 create?from= 摘要", async ({ page }) => {
  await ensureOwnerSession(page);
  const prompt = "收集散落金币躲开尖刺";
  const { id } = await createAndOpenPlay(page, prompt);

  const refine = await page.request.post(`/api/projects/${id}/refine`, {
    data: { instruction: "sim-handtest", mode: "patch" },
  });
  expect(refine.ok()).toBeTruthy();

  await page.goto(`/create?from=${encodeURIComponent(id)}`);
  await expect(page.getByText(/试玩页精炼记录|Play page refinements/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/patch.*sim-handtest/)).toBeVisible();
});

test("访客 · 无 refine 按钮", async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  await addZhLocaleCookie(ownerCtx);
  const ownerPage = await ownerCtx.newPage();
  await ensureOwnerSession(ownerPage);
  const { id } = await createAndOpenPlay(ownerPage, "塔防卫萝卜波次守住基地");
  await ownerCtx.close();

  const guestCtx = await browser.newContext();
  await addZhLocaleCookie(guestCtx);
  const guestPage = await guestCtx.newPage();
  await guestPage.goto(`/play/${id}`);
  await expect(guestPage.getByText(/继续共创|Keep co-creating/i)).toBeVisible({ timeout: 20_000 });
  await expect(guestPage.getByRole("button", { name: /局部 patch|Partial patch/i })).toHaveCount(0);
  await guestCtx.close();
});
