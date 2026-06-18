import { expect, test } from "./test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";

const COVER = "/samples/number-merge-2048.png";

/** 创作台 saveAndPlay 消费 background.coverPath 并展示缩略图 */
test("保存并试玩后展示 Brief 自动封面", async ({ page }) => {
  await page.goto("/");

  const prompt = "做一个解压打 dummy 假人的物理小游戏";
  const spec = prepareGameSpecForPersist(mockSpecFromPrompt(prompt, { templateId: "physics" }), prompt);

  const create = await page.request.post("/api/projects", { data: { prompt, spec } });
  expect(create.ok()).toBeTruthy();
  const { project } = (await create.json()) as { project?: { id?: string } };
  expect(project?.id).toBeTruthy();
  const id = project!.id!;

  await page.route(`**/api/projects/${id}/background`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        coverPath: COVER,
        backgroundUrl: `/game-bg/${id}.png`,
        spriteUrls: [],
        coverSource: "comfy",
      }),
    });
  });

  const spriteOk = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  let spritePoll = 0;
  for (const kind of ["player", "hazard", "gem"]) {
    await page.route(`**/game-sprites/${id}/${kind}.png`, async (route) => {
      spritePoll += 1;
      if (spritePoll < 4) {
        await route.fulfill({ status: 404, body: "" });
        return;
      }
      await route.fulfill({ status: 200, body: spriteOk });
    });
  }

  await page.goto(`/zh-Hans/create?from=${encodeURIComponent(id)}`);
  await expect(page.getByRole("button", { name: /保存并试玩|更新项目并试玩/ })).toBeEnabled({ timeout: 20_000 });

  const backgroundDone = page.waitForResponse(
    (r) => r.url().includes(`/api/projects/${id}/background`) && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /保存并试玩|更新项目并试玩/ }).click();
  await backgroundDone;
  await expect(page.locator(`img[src="${COVER}"]`)).toBeVisible({ timeout: 15_000 });
});
