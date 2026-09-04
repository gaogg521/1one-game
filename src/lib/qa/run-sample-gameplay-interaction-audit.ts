import type { Page } from "@playwright/test";

/** Helpers for independent-runtime QA. No canvas or template runtime is used. */
export async function healthOk(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(new URL("/api/health", baseUrl), { signal: AbortSignal.timeout(10_000) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function waitPlayReady(page: Page, timeout = 30_000): Promise<boolean> {
  try {
    const frame = page.locator("iframe[title]").first();
    await frame.waitFor({ state: "visible", timeout });
    await frame.contentFrame().locator("#game").waitFor({ state: "attached", timeout });
    return true;
  } catch {
    return false;
  }
}

/** Samples use the text game route unless an explicit reference is supplied. */
export async function readSceneKey(_page: Page): Promise<string> {
  return "game_text";
}

export async function performInteraction(
  page: Page,
  interaction: "click-center" | "click-upper" | "click-lower" | "arrow-right" | "arrow-left" | "space",
  clickRel: { x: number; y: number },
  burst: number,
): Promise<void> {
  const frame = page.locator("iframe[title]").first();
  if (interaction === "arrow-right" || interaction === "arrow-left" || interaction === "space") {
    const key = interaction === "arrow-right" ? "ArrowRight" : interaction === "arrow-left" ? "ArrowLeft" : "Space";
    for (let i = 0; i < burst; i += 1) await frame.press(key);
    return;
  }
  const box = await frame.boundingBox();
  if (!box) throw new Error("independent runtime iframe has no bounding box");
  for (let i = 0; i < burst; i += 1) {
    await page.mouse.click(box.x + box.width * clickRel.x, box.y + box.height * clickRel.y);
  }
}

export function chromiumLaunchOptions(_baseUrl: string): Record<string, never> {
  return {};
}
