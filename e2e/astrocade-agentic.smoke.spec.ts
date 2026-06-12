import { expect, test } from "@playwright/test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { shouldUseAgenticRuntime } from "@/lib/agentic/game-module";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";

/** Astrocade 用户路径：POST 自动 attach agentic → 试玩 canvas（E2E 走 template fallback，不测 LLM） */
test.describe.configure({ mode: "serial" });

test("POST 项目自动 attach agenticModule 且试玩加载 canvas", async ({ page }) => {
  await page.goto("/");

  const prompt = "解压打击 dummy 假人物理游戏";
  const base = mockSpecFromPrompt(prompt);
  expect(expectedPhaserSceneName(base)).not.toBe("AgenticScene");

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
  expect(saved.spec?.agenticModule?.source?.length).toBeGreaterThan(8);
  expect(shouldUseAgenticRuntime(saved.spec!)).toBe(true);
  expect(expectedPhaserSceneName(saved.spec!)).toBe("AgenticScene");

  await page.goto(`/play/${id}`);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
});
