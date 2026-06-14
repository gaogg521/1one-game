import type { BrowserContext } from "@playwright/test";
import { LOCALE_COOKIE } from "@/lib/constants";

export function e2eBaseUrl(baseURL?: string | null): string {
  return (baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8888").replace(/\/$/, "");
}

/** 默认 E2E 使用简体中文 UI，避免 Accept-Language 导致断言失败 */
export async function addLocaleCookie(
  context: BrowserContext,
  locale: string,
  baseURL?: string | null,
): Promise<void> {
  await context.addCookies([
    {
      name: LOCALE_COOKIE,
      value: locale,
      url: e2eBaseUrl(baseURL),
    },
  ]);
}

export async function addZhLocaleCookie(
  context: BrowserContext,
  baseURL?: string | null,
): Promise<void> {
  await addLocaleCookie(context, "zh-Hans", baseURL);
}
