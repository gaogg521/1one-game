import type { APIRequestContext, Page } from "@playwright/test";
import { addZhLocaleCookie } from "./locale";

/** 写入 gcreator_owner cookie，供 /api/projects 等主人 API 使用 */
export async function ensureOwnerSession(page: Page): Promise<APIRequestContext> {
  await addZhLocaleCookie(page.context());
  await page.goto("/");
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
