/**
 * 开发与手机同机调试：把局域网可访问的根地址写进 .env.local，
 * `NEXT_PUBLIC_DEV_CANONICAL_ORIGIN`，使电脑书签与手机使用同一 Origin。
 */
export function parseDevCanonicalOriginRaw(raw: string | undefined): URL | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    return new URL(t);
  } catch {
    return null;
  }
}
