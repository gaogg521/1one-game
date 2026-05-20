import { expect, test } from "@playwright/test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { PRODUCT } from "@/lib/product-config";

const TEMPLATE_PROMPTS: Record<string, string> = {
  avoider: "躲避陨石生存小游戏",
  collector: "收集金币躲开尖刺",
  survivor: "生存模式躲避敌人弹幕",
  platformer: "横版平台跳跃收集宝石",
  towerDefense: "保卫萝卜萌系塔防",
  shooter: "俯视角太空射击",
};

/** 六模板 Godot 标签冒烟：创建 → 试玩 → 切 Godot，断言导出 UI 可达 */
for (const templateId of PRODUCT.godot.supportedTemplates) {
  test(`Godot 标签 · ${templateId}`, async ({ page }) => {
    const prompt = TEMPLATE_PROMPTS[templateId] ?? templateId;
    const spec = mockSpecFromPrompt(prompt);
    spec.templateId = templateId;

    const create = await page.request.post("/api/projects", {
      data: { prompt, spec },
    });
    expect(create.ok()).toBeTruthy();
    const { project } = (await create.json()) as { project?: { id?: string } };
    expect(project?.id).toBeTruthy();

    await page.goto(`/play/${project!.id}`);
    await expect(page.getByTestId("runtime-tab-godot")).toBeVisible({ timeout: 15_000 });
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
}
