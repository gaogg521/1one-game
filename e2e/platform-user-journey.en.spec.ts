/**
 * 英文 UI 用户主路径：/start starter 与样品 parity（locale cookie）
 * npx playwright test e2e/platform-user-journey.en.spec.ts
 */
import { expect, test as base } from "@playwright/test";
import { SAMPLES } from "@/lib/samples";
import { getStarterPrompts } from "@/lib/product-ia";
import { addLocaleCookie } from "./helpers/locale";

const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    await addLocaleCookie(context, "en", baseURL);
    await use(context);
  },
});

test.describe.configure({ mode: "serial" });

test.describe("English /start", () => {
  test("sample prompt shows English parity hint", async ({ page }) => {
    const sample = SAMPLES[0]!;
    await page.goto("/en/start");
    await page.getByTestId("start-prompt-input").fill(sample.prompt);
    await expect(page.getByTestId("start-sample-parity-hint")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("start-sample-parity-hint")).toContainText(/Matches sample gallery/i);
    await expect(page.getByTestId("start-sample-parity-hint")).toContainText(sample.title);
    await expect(page.getByTestId("start-mode-recommendation")).toContainText(/Game/i);
  });

  test("English starter chips infer game / novel", async ({ page }) => {
    const starters = getStarterPrompts("en");
    await page.goto("/en/start");
    const input = page.getByTestId("start-prompt-input");

    await input.fill(starters[0] ?? "");
    await expect(page.getByTestId("start-mode-recommendation")).toContainText(/Game/i);

    await input.fill(starters[1] ?? "");
    await expect(page.getByTestId("start-mode-recommendation")).toContainText(/Novel/i);

    await input.fill(starters[2] ?? "");
    await expect(page.getByTestId("start-mode-recommendation")).toContainText(/Novel/i);
  });

  test("/en/start?prefill= deep link prefills prompt", async ({ page }) => {
    const sample = SAMPLES[0]!;
    const encoded = encodeURIComponent(sample.prompt.slice(0, 4000));
    await page.goto(`/en/start?prefill=${encoded}`);
    await expect(page.getByTestId("start-prompt-input")).toHaveValue(sample.prompt, { timeout: 10_000 });
    await expect(page.getByTestId("start-sample-parity-hint")).toBeVisible({ timeout: 10_000 });
  });
});
