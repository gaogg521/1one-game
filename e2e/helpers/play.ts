import type { Page } from "@playwright/test";

/** 试玩页资源多，避免等待 load 事件导致 30s 超时 */
export async function gotoPlay(page: Page, projectId: string): Promise<void> {
  await page.goto(`/play/${projectId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
}
