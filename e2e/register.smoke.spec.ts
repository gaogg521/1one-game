/**
 * 邮箱注册 smoke：dev 模式暴露验证码
 * npx playwright test e2e/register.smoke.spec.ts
 *
 * 需 .env: EMAIL_AUTH_DEV_EXPOSE=1
 */
import { expect, test } from "./test";

test.describe("邮箱注册", () => {
  test("注册页 → 发码 → 注册 → 进入工作室", async ({ page }) => {
    const suffix = Date.now();
    const email = `e2e-${suffix}@example.com`;
    const password = "testpass1234";
    const displayName = `e2e-${suffix}`;

    await page.goto("/register");
    await expect(page.getByTestId("register-form")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("register-username").fill(displayName);
    await page.getByTestId("register-email").fill(email);
    await page.getByTestId("register-password").fill(password);

    await page.getByTestId("register-send-code").click();
    await expect(page.getByTestId("register-dev-code")).toBeVisible({ timeout: 15_000 });
    const devCode = (await page.getByTestId("register-dev-code").textContent())?.replace(/\D/g, "") ?? "";
    expect(devCode.length).toBeGreaterThanOrEqual(4);

    await page.getByTestId("register-code").fill(devCode.slice(0, 6));
    await page.getByTestId("register-submit").click();

    await expect(page).toHaveURL(/\/studio(\?register=ok)?/, { timeout: 20_000 });
    await expect(page.getByTestId("studio-register-welcome")).toBeVisible({ timeout: 10_000 });
  });

  test("未登录时顶栏可见注册入口", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /注册|Register|Daftar|สมัคร|註冊/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
