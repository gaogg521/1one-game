import { expect, test } from "./test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";
import { OWNER_COOKIE } from "@/lib/constants";

const OWNER = process.env.PLATFORM_TEST_OWNER ?? "platform-test-user";

/** platform-test-user：/create?from= 载入已保存作品 */
test("platform-test-user 创作台 from= 回放", async ({ page, baseURL }) => {
  const origin = baseURL ?? "http://127.0.0.1:8888";
  await page.context().addCookies([
    { name: OWNER_COOKIE, value: OWNER, url: origin },
  ]);

  const prompt = "platform-test-user 回放：解压物理打 dummy 假人";
  const spec = prepareGameSpecForPersist(
    mockSpecFromPrompt(prompt, { templateId: "physics" }),
    prompt,
  );

  const create = await page.request.post("/api/projects", { data: { prompt, spec } });
  expect(create.ok()).toBeTruthy();
  const { project } = (await create.json()) as { project?: { id?: string; title?: string } };
  expect(project?.id).toBeTruthy();
  const id = project!.id!;

  await page.goto(`/zh-Hans/create?from=${encodeURIComponent(id)}`);
  await expect(page.getByText(/已从.*载入描述/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 2, name: spec.title })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("button", { name: /保存并试玩|更新项目并试玩/ })).toBeEnabled();
});
