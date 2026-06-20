import { expect, test } from "./test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { buildFallbackAgenticModule } from "@/lib/agentic/game-module";
import { shouldUseAgenticRuntime } from "@/lib/agentic/game-module";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";
import { gotoPlay } from "./helpers/play";
import type { GameSpec } from "@/lib/game-spec";

/** Phase A 缺口：复杂 Agentic 路由入库 → AgenticScene 试玩 canvas */
test.describe.configure({ mode: "serial" });

test("Agentic 复杂路由 persist 后试玩 AgenticScene", async ({ page }) => {
  await page.goto("/");

  const prompt =
    "Build an epic side-scrolling platformer with 3 levels, character select, and final boss Thanos.";
  const base = mockSpecFromPrompt(prompt);
  const withAgentic = prepareGameSpecForPersist(
    {
      ...base,
      templateId: "platformer",
      agenticPlayRoute: "agentic" as const,
      agenticModule: buildFallbackAgenticModule(base.title, { ...base, templateId: "platformer" }),
    },
    prompt,
  );

  expect(shouldUseAgenticRuntime(withAgentic)).toBe(true);
  expect(expectedPhaserSceneName(withAgentic)).toBe("AgenticScene");

  const create = await page.request.post("/api/projects", {
    data: { prompt, spec: withAgentic },
  });
  expect(create.ok()).toBeTruthy();
  const { project } = (await create.json()) as { project?: { id?: string } };
  expect(project?.id).toBeTruthy();
  const id = project!.id!;

  const get = await page.request.get(`/api/projects/${id}`);
  const saved = (await get.json()) as { spec?: GameSpec };
  expect(shouldUseAgenticRuntime(saved.spec!)).toBe(true);
  expect(saved.spec?.agenticPlayRoute).toBe("agentic");

  await gotoPlay(page, id);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 25_000 });
});
