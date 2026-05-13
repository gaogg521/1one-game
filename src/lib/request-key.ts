import { headers } from "next/headers";

/** 用于限流：优先匿名访客 Cookie，辅以转发 IP。 */
export async function getThrottleKey(prefix: string, ownerFallback: string): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `${prefix}:${ownerFallback}:${ip}`;
}
