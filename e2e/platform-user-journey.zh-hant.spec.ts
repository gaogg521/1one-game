/**
 * 英文 UI 用户主路径：/start starter 与样品 parity（locale cookie）
 * npx playwright test e2e/platform-user-journey.zh-hant.spec.ts
 */
import { expect, test as base } from "@playwright/test";
import { SAMPLES } from "@/lib/samples";
import { getStarterPrompts } from "@/lib/product-ia";
import { addLocaleCookie } from "./helpers/locale";

const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    await addLocaleCookie(context, "zh-Hant", baseURL);
    await use(context);
  },
});

test.describe("zh-Hant /start", () => {
  test("sample prompt → parity hint + game recommendation", async ({ page }) => {
    const sample = SAMPLES[0]!;
    await page.goto("/zh-Hant/start");
    await page.getByTestId("start-prompt-input").fill(sample.prompt);
    await expect(page.getByTestId("start-sample-parity-hint")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("start-sample-parity-hint")).toContainText(/匹配樣品館/);
    await expect(page.getByTestId("start-mode-recommendation")).toContainText(/遊戲/);
  });

  test("starter prompts infer game / novel / novel", async ({ page }) => {
    const starters = getStarterPrompts("zh-Hant");
    await page.goto("/zh-Hant/start");
    const input = page.getByTestId("start-prompt-input");

    await input.fill(starters[0] ?? "");
    await expect(page.getByTestId("start-mode-recommendation")).toContainText(/遊戲/);

    await input.fill(starters[1] ?? "");
    await expect(page.getByTestId("start-mode-recommendation")).toContainText(/小說/);

    await input.fill(starters[2] ?? "");
    await expect(page.getByTestId("start-mode-recommendation")).toContainText(/小說/);
  });

  test("/zh-Hant/start?prefill= deep link prefills prompt", async ({ page }) => {
    const sample = SAMPLES[0]!;
    const encoded = encodeURIComponent(sample.prompt.slice(0, 4000));
    await page.goto(`/zh-Hant/start?prefill=${encoded}`);
    await expect(page.getByTestId("start-prompt-input")).toHaveValue(sample.prompt, { timeout: 10_000 });
    await expect(page.getByTestId("start-sample-parity-hint")).toBeVisible({ timeout: 10_000 });
  });
});
