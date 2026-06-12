import { expect, test } from "@playwright/test";

test.describe("工作室批量删除", () => {
  test("批量删除请求命中可用 API 路由", async ({ page }) => {
    let statusCode = -1;

    await page.route("**/api/studio/batch-delete", async (route) => {
      const response = await route.fetch();
      statusCode = response.status();
      await route.fulfill({ response });
    });

    await page.goto("http://127.0.0.1:8888/studio");

    const req = page.waitForRequest("**/api/studio/batch-delete");
    await page.evaluate(() =>
      fetch("/api/studio/batch-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      }).catch(() => null),
    );
    await req;

    expect(statusCode).not.toBe(404);
  });
});
