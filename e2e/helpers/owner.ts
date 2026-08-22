import type { APIRequestContext, Page } from "@playwright/test";
import { addZhLocaleCookie } from "./locale";

/** 写入 gcreator_owner cookie，供 /api/projects 等主人 API 使用 */
export async function ensureOwnerSession(page: Page): Promise<APIRequestContext> {
  await addZhLocaleCookie(page.context());
  // 首页会加载可选字体与展示资源；认证只需要服务端已处理 cookie，不能把
  // 非关键的完整 load 事件纳入每个 E2E 用例的时限。
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  return page.request;
}

export async function createProjectViaApi(
  api: APIRequestContext,
  prompt: string,
  spec: unknown,
): Promise<{ id: string; prompt: string; spec: unknown }> {
  const res = await api.post("/api/projects", { data: { prompt, spec } });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`POST /api/projects ${res.status()}: ${body.slice(0, 400)}`);
  }
  const data = (await res.json()) as { project?: { id?: string } };
  if (!data.project?.id) throw new Error("POST /api/projects missing project.id");
  return { id: data.project.id, prompt, spec };
}
