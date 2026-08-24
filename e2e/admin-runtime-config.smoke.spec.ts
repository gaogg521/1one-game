import fs from "node:fs";
import path from "node:path";
import { expect, test } from "./test";

const OUT = path.join(process.cwd(), "qa-output", "admin-runtime-config");
const E2E_SECRET = process.env.SUPER_ADMIN_SECRET?.trim() || "e2e-super-admin-secret";

test.describe("Admin 网关/模型页", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test("super_admin 密钥可打开运行时配置 Tab 并截图", async ({ page, context }) => {
    await context.addInitScript((secret: string) => {
      localStorage.setItem("gc_super_admin_key", secret);
      sessionStorage.setItem("gc_super_admin_key", secret);
    }, E2E_SECRET);

    await page.goto("/console?tab=runtime", { waitUntil: "domcontentloaded" });

    const runtimeTab = page.locator("aside").getByTestId("admin-tab-runtime");
    await expect(runtimeTab).toBeVisible({ timeout: 45_000 });

    const panel = page.getByTestId("admin-runtime-config");
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("admin-nav-section-admin-content")).toBeVisible();
    await expect(page.getByTestId("admin-nav-section-admin-growth")).toBeVisible();
    await expect(page.getByTestId("admin-nav-section-admin-system")).toBeVisible();
    await expect(page.getByTestId("admin-runtime-hero")).toBeVisible();
    await expect(page.getByTestId("admin-runtime-live-summary")).toBeVisible();
    await expect(page.getByTestId("admin-runtime-section-providers")).toBeVisible();
    await expect(page.getByTestId("admin-runtime-template-select")).toBeVisible();
    await expect(page.getByTestId("admin-runtime-template-hint")).toBeVisible();
    await expect(page.getByTestId("admin-runtime-section-routing")).toBeVisible();
    await expect(page.getByTestId("admin-runtime-add-provider")).toBeVisible();
    await expect(page.getByTestId("admin-runtime-save")).toBeVisible();
    await expect(page.getByTestId("admin-runtime-seed-defaults")).toBeVisible();
    await expect(page.getByTestId("admin-console-preferences")).toBeVisible();

    const provider = page.locator('[data-testid^="admin-runtime-provider-"][data-edit-state="live"]').first();
    const providerTestId = await provider.getAttribute("data-testid");
    expect(providerTestId).toBeTruthy();
    const providerId = providerTestId!.replace("admin-runtime-provider-", "");
    let savedProviderTestPayload: unknown;
    await page.route("**/api/admin/runtime-config/test-provider", async (route) => {
      savedProviderTestPayload = route.request().postDataJSON();
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, message: "models_ok" }) });
    });
    await provider.locator("button").first().click();
    await page.getByTestId(`admin-runtime-provider-${providerId}-test`).click();
    await expect.poll(() => savedProviderTestPayload).toEqual({ providerId });

    await page.screenshot({
      path: path.join(OUT, "runtime-config-gateway.png"),
      fullPage: true,
    });

    await page.getByTestId("admin-runtime-section-routing").click();
    await expect(panel).toBeVisible();

    const primaryCatalog = page.getByTestId("admin-runtime-route-game_text-primary-catalog");
    const primaryModel = page.getByTestId("admin-runtime-route-game_text-primary-model");
    const fallbackCatalog = page.getByTestId("admin-runtime-route-game_text-fallback-catalog");
    const fallbackModel = page.getByTestId("admin-runtime-route-game_text-fallback-model");
    await expect(primaryCatalog).toBeVisible();
    await expect(primaryModel).toBeVisible();
    await expect(fallbackCatalog).toBeVisible();
    await expect(fallbackModel).toBeVisible();

    const firstCatalogModel = await primaryCatalog.locator("option").nth(1).getAttribute("value");
    expect(firstCatalogModel).toBeTruthy();
    await primaryCatalog.selectOption(firstCatalogModel!);
    await expect(primaryModel).toHaveValue(firstCatalogModel!);

    await page.screenshot({
      path: path.join(OUT, "runtime-config-models.png"),
      fullPage: true,
    });

    fs.writeFileSync(
      path.join(OUT, "REPORT.md"),
      `# Admin Runtime Config E2E\n\n- 时间：${new Date().toISOString()}\n- 结果：**PASS**\n\n## 截图\n\n- \`runtime-config-gateway.png\` — 服务商 Tab 全页\n- \`runtime-config-models.png\` — 路由 Tab 全页\n`,
    );
  });
});
