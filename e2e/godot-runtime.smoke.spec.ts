import { expect, test } from "@playwright/test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";

/**
 * Godot 试玩引擎切换冒烟：创建塔防项目 → 试玩页 → 切 Godot 标签。
 * 导出可能较慢；仅断言 UI 状态可达（loading / ready / error），不等待 wasm 完全加载。
 */
test("试玩页可切换到 Godot 引擎标签", async ({ page }) => {
  const prompt = "保卫萝卜塔防冒烟";
  const spec = mockSpecFromPrompt(prompt);
  spec.templateId = "towerDefense";

  const create = await page.request.post("/api/projects", {
    data: { prompt, spec },
  });
  expect(create.ok()).toBeTruthy();
  const { project } = (await create.json()) as { project?: { id?: string } };
  expect(project?.id).toBeTruthy();

  await page.goto(`/play/${project!.id}`);
  await expect(page.getByTestId("runtime-tab-phaser")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("runtime-tab-godot").click();

  await expect
    .poll(
      async () => {
        const loading = await page.getByText("正在构建在线版").isVisible().catch(() => false);
        const building = await page.getByText("Godot 正在根据 GameSpec 构建").isVisible().catch(() => false);
        const iframe = await page.getByTestId("godot-web-iframe").count();
        const err =
          (await page.getByText("在线版构建失败").isVisible().catch(() => false)) ||
          (await page.getByText("导出失败").isVisible().catch(() => false));
        return loading || building || iframe > 0 || err;
      },
      { timeout: 90_000 },
    )
    .toBe(true);
});
