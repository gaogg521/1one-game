const STORAGE_KEY = "gc_super_admin_key";

/** 与 .env 中 NEXT_PUBLIC_DEV_SUPER_ADMIN=1 对齐，仅用于 UI 提示（鉴权在服务端）。 */
export function isDevSuperAdminClientEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEV_SUPER_ADMIN === "1";
}

/** 浏览器端保存的超级管理员密钥（session + local 双写，便于跨页） */
export function getSuperAdminKey(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
}

export function setSuperAdminKey(key: string): void {
  const v = key.trim();
  if (!v) {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, v);
  localStorage.setItem(STORAGE_KEY, v);
}

export function clearSuperAdminKey(): void {
  setSuperAdminKey("");
}

export function superAdminFetchInit(init: RequestInit = {}): RequestInit {
  const key = getSuperAdminKey();
  if (!key) return init;
  const headers = new Headers(init.headers);
  headers.set("X-Super-Admin-Key", key);
  return { ...init, headers };
}
