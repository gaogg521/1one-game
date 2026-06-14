import { expect, test } from "./test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { shouldUseAgenticRuntime } from "@/lib/agentic/game-module";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import { gotoPlay } from "./helpers/play";

/** Astrocade 用户路径：POST 走 dedicated Scene（与样品馆一致）→ 试玩 canvas */
test.describe.configure({ mode: "serial" });

test("POST 项目 template-first 路由 PhysicsScene 且试玩加载 canvas", async ({ page }) => {
  await page.goto("/");

  const prompt = "解压打击 dummy 假人物理游戏";
  const base = mockSpecFromPrompt(prompt);
  expect(expectedPhaserSceneName(base)).toBe("PhysicsScene");

  const create = await page.request.post("/api/projects", {
    data: { prompt, spec: base },
  });
  if (!create.ok()) {
    const body = await create.text();
    throw new Error(`POST /api/projects ${create.status()}: ${body.slice(0, 400)}`);
  }
  const { project } = (await create.json()) as { project?: { id?: string } };
  expect(project?.id).toBeTruthy();
  const id = project!.id!;

  const get = await page.request.get(`/api/projects/${id}`);
  const saved = (await get.json()) as { spec?: { agenticModule?: { source?: string }; templateId?: string } };
  expect(saved.spec?.agenticModule?.source).toBeUndefined();
  expect(shouldUseAgenticRuntime(saved.spec!)).toBe(false);
  expect(expectedPhaserSceneName(saved.spec!)).toBe("PhysicsScene");

  await gotoPlay(page, id);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
});
