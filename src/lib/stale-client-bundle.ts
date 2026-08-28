/** sessionStorage：同一会话内短时间只自动刷新一次，避免 ChunkLoadError 死循环。 */
export const STALE_BUNDLE_RELOAD_KEY = "gc:stale-bundle-reload-at";
const RELOAD_COOLDOWN_MS = 20_000;

function errorText(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error === "object" && "name" in error && "message" in error) {
    return `${String((error as { name?: unknown }).name)} ${String((error as { message?: unknown }).message)}`;
  }
  return String(error);
}

/** 发布后旧 HTML 仍引用已替换的 /_next/static 分块时，浏览器会抛这类错误。 */
export function isStaleClientBundleError(error: unknown): boolean {
  const text = errorText(error);
  if (!text.trim()) return false;
  return (
    /\bChunkLoadError\b/i.test(text) ||
    /Loading chunk /i.test(text) ||
    /Failed to load chunk/i.test(text) ||
    /Failed to fetch dynamically imported module/i.test(text) ||
    /error loading dynamically imported module/i.test(text) ||
    /Importing a module script failed/i.test(text) ||
    /Loading CSS chunk /i.test(text)
  );
}

export function reloadOnceForStaleClientBundle(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(sessionStorage.getItem(STALE_BUNDLE_RELOAD_KEY) || "");
    if (Number.isFinite(last) && last > 0 && Date.now() - last < RELOAD_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(STALE_BUNDLE_RELOAD_KEY, String(Date.now()));
  } catch {
    /* 隐私模式写不了 storage 时仍刷新一次 */
  }
  window.location.reload();
  return true;
}
