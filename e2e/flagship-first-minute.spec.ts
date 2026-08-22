/**
 * 五个旗舰模板的真实首分钟验收：不以计时 mock 替代运行时。
 * 每个用例实际保留 Phaser 试玩 61 秒，并确认匿名遥测已回写质量报告。
 */
import { expect, test, type Page } from "./test";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { ensureOwnerSession } from "./helpers/owner";
import { gotoPlay } from "./helpers/play";

// 真实首分钟验收本身占用 61 秒，且还需容纳项目创建、Phaser 首次启动与
// 12 秒的遥测落库轮询。100 秒会在本地冷启动时把正确的回写截断。
test.describe.configure({ mode: "serial", timeout: 150_000 });

const FLAGSHIPS = [
  { templateId: "avoider", prompt: "躲开从天而降的陨石" },
  { templateId: "puzzle", prompt: "色彩消除益智 match3" },
  { templateId: "physics", prompt: "打击 dummy 假人解压" },
  { templateId: "platformer", prompt: "横版闯关跳跃收集钥匙过关" },
  { templateId: "farming", prompt: "治愈农场经营，种植、浇水并收获作物" },
] as const;

async function createProject(page: Page, prompt: string): Promise<{ id: string; templateId: string }> {
  const spec = mockSpecFromPrompt(prompt);
  const res = await page.request.post("/api/projects", { data: { prompt, spec } });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { project?: { id?: string } };
  expect(body.project?.id).toBeTruthy();
  return { id: body.project!.id!, templateId: spec.templateId };
}

for (const flagship of FLAGSHIPS) {
  test(`真实首分钟遥测 · ${flagship.templateId}`, async ({ page }) => {
    await ensureOwnerSession(page);
    const project = await createProject(page, flagship.prompt);
    expect(project.templateId).toBe(flagship.templateId);

    await gotoPlay(page, project.id);
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    await canvas.click({ position: { x: 0.5, y: 0.5 }, force: true });

    // Do not shorten this wait: the production client emits first_minute at 60 seconds.
    await page.waitForTimeout(61_000);

    await expect.poll(async () => {
      const detail = await page.request.get(`/api/projects/${project.id}`);
      if (!detail.ok()) return -1;
      const body = (await detail.json()) as {
        project?: { quality?: { engagement?: { starts?: number; firstActionRate?: number; firstMinuteRate?: number } } };
      };
      return body.project?.quality?.engagement?.firstMinuteRate ?? -1;
    }, { timeout: 12_000, intervals: [500, 1000, 2000] }).toBeGreaterThanOrEqual(100);

    const detail = await page.request.get(`/api/projects/${project.id}`);
    const body = (await detail.json()) as {
      project?: { quality?: { engagement?: { starts?: number; firstActionRate?: number } } };
    };
    expect(body.project?.quality?.engagement?.starts).toBeGreaterThanOrEqual(1);
    expect(body.project?.quality?.engagement?.firstActionRate).toBeGreaterThanOrEqual(100);
  });
}
