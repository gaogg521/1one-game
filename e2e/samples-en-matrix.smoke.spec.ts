/**
 * 英文样品馆 E2E 矩阵：全 17 款 /en/play/sample-* + Phaser canvas
 * npx playwright test e2e/samples-en-matrix.smoke.spec.ts
 */
import { expect, test } from "@playwright/test";
import { SAMPLES } from "@/lib/samples";
import { sampleProjectId } from "@/lib/sample-gallery";

/** 英文页 H1 匹配用：取标题前 2 词（忽略大小写） */
function enTitleNeedle(title: string): string {
  const cleaned = title.replace(/:/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words[0]!.length <= 5) return `${words[0]} ${words[1]}`;
  return words[0] ?? title;
}

test.describe.configure({ mode: "serial", timeout: 120_000 });

test.beforeAll(async ({ request }) => {
  const res = await request.post("/api/samples/ensure", { headers: { "Accept-Language": "en" } });
  expect(res.ok()).toBeTruthy();
});

for (const sample of SAMPLES) {
  test(`英文试玩 ${sample.id} canvas 就绪`, async ({ page }) => {
    const id = sampleProjectId(sample.id);
    await page.goto(`/en/play/${id}`, { waitUntil: "domcontentloaded" });

    const needle = enTitleNeedle(sample.title);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(needle, {
      timeout: 20_000,
      ignoreCase: true,
    });

    const phaserTab = page.getByTestId("runtime-tab-phaser");
    if (await phaserTab.isVisible().catch(() => false)) {
      await phaserTab.click();
    }

    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 25_000 });

    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/继续共创/);
  });
}
