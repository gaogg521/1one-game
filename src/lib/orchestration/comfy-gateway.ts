/**
 * Phase 3：ComfyUI 侧车占位（开源自托管）。
 * 未配置 COMFY_UI_BASE_URL 时不发起请求。
 */

import { PRODUCT } from "@/lib/product-config";

function probeTimeoutMs(): number {
  return PRODUCT.comfy.probeTimeoutMs;
}

export function getComfyBaseUrl(): string | null {
  const u = process.env.COMFY_UI_BASE_URL?.trim();
  return u && u.startsWith("http") ? u.replace(/\/$/, "") : null;
}

/** 探测耗时、是否超时；用于 API 与管理台观测。 */
export async function probeComfyHealthDetailed(overrideMs?: number): Promise<{
  reachable: boolean;
  probeMs: number;
  timedOut: boolean;
}> {
  const base = getComfyBaseUrl();
  const ms = typeof overrideMs === "number" ? overrideMs : probeTimeoutMs();

  if (!base) return { reachable: false, probeMs: 0, timedOut: false };

  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(`${base}/system_stats`, { method: "GET", signal: ctl.signal });
    clearTimeout(timer);
    const probeMs = Date.now() - t0;
    return { reachable: res.ok, probeMs, timedOut: false };
  } catch (e: unknown) {
    clearTimeout(timer);
    const probeMs = Date.now() - t0;
    const name = typeof e === "object" && e !== null && "name" in e ? String((e as { name: unknown }).name) : "";
    const msg = typeof e === "object" && e !== null && "message" in e ? String((e as { message: unknown }).message) : "";
    const timedOut = name === "AbortError" || /aborted/i.test(msg) || /AbortError/i.test(name);
    return { reachable: false, probeMs, timedOut };
  }
}

/** ComfyUI 常见 REST：/system_stats（若网关不同可换路径） */
export async function probeComfyHealth(overrideMs?: number): Promise<boolean> {
  const d = await probeComfyHealthDetailed(overrideMs);
  return d.reachable;
}
