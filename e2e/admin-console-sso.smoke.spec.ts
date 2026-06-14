import fs from "node:fs";
import path from "node:path";
import { expect, test } from "./test";

const OUT = path.join(process.cwd(), "qa-output", "admin-console-sso");

async function skipIfSsoDisabled(page: import("@playwright/test").Page) {
  const probe = await page.request.get("/api/admin/console/sso/login?next=/console", {
    maxRedirects: 0,
  });
  if (probe.status() === 404) {
    test.skip(true, "SSO disabled — set ADMIN_CONSOLE_OIDC_STUB=1 on server");
  }
}

test.describe("Console SSO stub", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test("login → stub callback → session 含 admin", async ({ page }) => {
    await skipIfSsoDisabled(page);

    await page.goto("/api/admin/console/sso/login?next=/console");
    await page.waitForURL(/\/console(\?sso=ok)?/, { timeout: 45_000 });

    const session = await page.request.get("/api/auth/session");
    expect(session.ok()).toBeTruthy();
    const body = (await session.json()) as {
      user?: { role?: string; providers?: string[]; email?: string | null };
    };
    expect(body.user?.role === "admin" || body.user?.role === "super_admin").toBeTruthy();
    expect(body.user?.providers).toContain("console_oidc");

    await page.screenshot({ path: path.join(OUT, "console-after-sso.png"), fullPage: true });

    fs.writeFileSync(
      path.join(OUT, "REPORT.md"),
      `# Console SSO stub E2E

- 时间：${new Date().toISOString()}
- 结果：**PASS**
- 用户：${body.user?.email ?? "—"} · role=${body.user?.role}
- 截图：\`console-after-sso.png\`
`,
    );
  });

  test("logout 302 至登录页", async ({ page }) => {
    await skipIfSsoDisabled(page);

    await page.goto("/api/admin/console/sso/login?next=/console");
    await page.waitForURL(/\/console/, { timeout: 45_000 });

    const logout = await page.request.post("/api/admin/console/sso/logout?next=/console", {
      maxRedirects: 0,
    });
    expect(logout.status()).toBeGreaterThanOrEqual(300);
    expect(logout.status()).toBeLessThan(400);
    const loc = logout.headers().location ?? "";
    expect(loc).toMatch(/\/login/);
  });
});
