import { expect, test } from "./test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { PRODUCT } from "@/lib/product-config";
import { createProjectViaApi, ensureOwnerSession } from "./helpers/owner";

const TEMPLATE_PROMPTS: Record<string, string> = {
  avoider: "躲避陨石生存小游戏",
  collector: "收集金币躲开尖刺",
  survivor: "生存模式躲避敌人弹幕",
  platformer: "横版平台跳跃收集宝石",
  towerDefense: "保卫萝卜萌系塔防",
  shooter: "俯视角太空射击",
  sniper: "blocky sniper hunter 低多边形狙击",
  stealth: "潜行摆荡偷取宝物",
  coaster: "空中轨道过山车竞速",
  racing: "赛道圈速计时竞速",
  puzzle: "色彩消除益智 match3",
  farming: "种植花园浇水收获",
  physics: "打击 dummy 假人解压",
  chess: "国际象棋对弈",
  customization: "汽车涂色调色盘定制",
  strategy: "地图征服派兵占领区域",
};

/** Godot 标签冒烟：串行避免并行构建打满 dev；单测 3min 覆盖构建 poll 90s */
test.describe.configure({ mode: "serial", timeout: 180_000 });

async function godotSurfaceVisible(page: import("@playwright/test").Page): Promise<boolean> {
  const loading =
    (await page.getByText("正在构建在线版").isVisible().catch(() => false)) ||
    (await page.getByText("正在构建 Godot").isVisible().catch(() => false)) ||
    (await page.getByText("Building online").isVisible().catch(() => false));
  const iframe = (await page.getByTestId("godot-web-iframe").count()) > 0;
  const cached = await page.getByText("在线版已缓存").isVisible().catch(() => false);
  const ready = await page.getByText("Godot 在线版已在后台就绪").isVisible().catch(() => false);
  const err =
    (await page.getByText("在线版构建失败").isVisible().catch(() => false)) ||
    (await page.getByText("导出失败").isVisible().catch(() => false)) ||
    (await page.getByText("build failed", { exact: false }).isVisible().catch(() => false));
  return loading || iframe > 0 || cached || ready || err;
}

for (const templateId of PRODUCT.godot.supportedTemplates) {
  test(`Godot 标签 · ${templateId}`, async ({ page }) => {
    const prompt = TEMPLATE_PROMPTS[templateId] ?? templateId;
    const spec = mockSpecFromPrompt(prompt);
    spec.templateId = templateId;

    const api = await ensureOwnerSession(page);
    const { id: projectId } = await createProjectViaApi(api, prompt, spec);

    await page.goto(`/play/${projectId}`);
    await expect(page.getByTestId("runtime-tab-godot")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("runtime-tab-godot").click();

    await expect.poll(async () => godotSurfaceVisible(page), { timeout: 90_000 }).toBe(true);
  });
}
