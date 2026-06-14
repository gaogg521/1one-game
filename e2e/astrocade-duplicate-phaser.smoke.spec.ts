import { expect, test } from "./test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { shouldUseAgenticRuntime } from "@/lib/agentic/game-module";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import { gotoPlay } from "./helpers/play";

/** 复制体 + 旧 agenticModule → 规范化 → Phaser PlatformerScene */
test.describe.configure({ mode: "serial" });

test("duplicate 剥离 agenticModule 且 Phaser 平台专用 Scene 可玩", async ({ page }) => {
  await page.goto("/");

  const prompt = "伸缩潜行平台跳跃偷取目标 elastic thief";
  const base = mockSpecFromPrompt(prompt);
  expect(base.templateId === "platformer" || base.templateId === "stealth").toBeTruthy();

  const legacy = {
    ...base,
    agenticModule: {
      version: 1 as const,
      entry: "createGame",
      source: "function createGame(){return{create(){}}}",
    },
  };

  const create = await page.request.post("/api/projects", {
    data: { prompt, spec: legacy },
  });
  if (!create.ok()) {
    throw new Error(`POST create failed: ${await create.text()}`);
  }
  const { project } = (await create.json()) as { project?: { id?: string } };
  const sourceId = project?.id;
  expect(sourceId).toBeTruthy();

  const dup = await page.request.post(`/api/projects/${sourceId}/duplicate`);
  expect(dup.ok()).toBeTruthy();
  const { project: clone } = (await dup.json()) as { project?: { id?: string } };
  expect(clone?.id).toBeTruthy();

  const get = await page.request.get(`/api/projects/${clone!.id}`);
  const saved = (await get.json()) as { spec?: { agenticModule?: { source?: string }; templateId?: string } };
  expect(saved.spec?.agenticModule?.source).toBeUndefined();
  expect(shouldUseAgenticRuntime(saved.spec!)).toBe(false);
  expect(expectedPhaserSceneName(saved.spec!)).toBe("PlatformerScene");

  await gotoPlay(page, clone!.id!);
  await page.getByTestId("runtime-tab-phaser").click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 25_000 });
});
