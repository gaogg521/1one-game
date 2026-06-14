/**
 * ms / th UI：/start starter 分流与样品 parity（locale cookie）
 * npx playwright test e2e/platform-user-journey.ms-th.spec.ts
 */
import { expect, test as base } from "@playwright/test";
import type { AppLocale } from "@/i18n/routing";
import { SAMPLES } from "@/lib/samples";
import { getStarterPrompts } from "@/lib/product-ia";
import { addLocaleCookie } from "./helpers/locale";

type LocaleCase = {
  locale: AppLocale;
  pathPrefix: string;
  gameLabel: RegExp;
  novelLabel: RegExp;
  parityHint: RegExp;
};

const CASES: LocaleCase[] = [
  {
    locale: "ms",
    pathPrefix: "/ms",
    gameLabel: /Permainan/i,
    novelLabel: /Novel/i,
    parityHint: /Padan dengan galeri sampel/i,
  },
  {
    locale: "th",
    pathPrefix: "/th",
    gameLabel: /เกม/i,
    novelLabel: /นิยาย/i,
    parityHint: /ตรงกับตัวอย่างในแกลเลอรี/i,
  },
];

function localeTest(locale: AppLocale) {
  return base.extend({
    context: async ({ context, baseURL }, use) => {
      await addLocaleCookie(context, locale, baseURL);
      await use(context);
    },
  });
}

for (const c of CASES) {
  const test = localeTest(c.locale);

  test.describe(`${c.locale} /start`, () => {
    test("sample prompt → parity hint + game recommendation", async ({ page }) => {
      const sample = SAMPLES[0]!;
      await page.goto(`${c.pathPrefix}/start`);
      await page.getByTestId("start-prompt-input").fill(sample.prompt);
      await expect(page.getByTestId("start-sample-parity-hint")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("start-sample-parity-hint")).toContainText(c.parityHint);
      await expect(page.getByTestId("start-mode-recommendation")).toContainText(c.gameLabel);
    });

    test("starter prompts infer game / novel / novel", async ({ page }) => {
      const starters = getStarterPrompts(c.locale);
      await page.goto(`${c.pathPrefix}/start`);
      const input = page.getByTestId("start-prompt-input");

      await input.fill(starters[0] ?? "");
      await expect(page.getByTestId("start-mode-recommendation")).toContainText(c.gameLabel);

      await input.fill(starters[1] ?? "");
      await expect(page.getByTestId("start-mode-recommendation")).toContainText(c.novelLabel);

      await input.fill(starters[2] ?? "");
      await expect(page.getByTestId("start-mode-recommendation")).toContainText(c.novelLabel);
    });
  });
}
