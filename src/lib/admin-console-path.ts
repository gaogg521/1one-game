/**
 * 运营控制台路径与主机配置。
 * 默认 `/console`（可经 ADMIN_CONSOLE_PATH 自定义，生产建议改为非 obvious 路径）。
 * 可选 ADMIN_CONSOLE_HOST 绑定独立子域（如 ops.example.com）。
 */

const DEFAULT_PATH = "/console";

function normalizePath(raw: string | undefined): string {
  const trimmed = raw?.trim() || DEFAULT_PATH;
  if (!trimmed.startsWith("/")) return `/${trimmed.replace(/\/+$/, "") || "console"}`;
  return trimmed.replace(/\/+$/, "") || DEFAULT_PATH;
}

/** 服务端与构建时读取 */
export function getAdminConsolePath(): string {
  return normalizePath(process.env.ADMIN_CONSOLE_PATH ?? process.env.NEXT_PUBLIC_ADMIN_CONSOLE_PATH);
}

/** 客户端链接（仅 NEXT_PUBLIC_* 在浏览器可用） */
export function getAdminConsolePathClient(): string {
  return normalizePath(process.env.NEXT_PUBLIC_ADMIN_CONSOLE_PATH ?? process.env.ADMIN_CONSOLE_PATH);
}

export function getAdminConsoleHost(): string | null {
  const host = process.env.ADMIN_CONSOLE_HOST?.trim().toLowerCase();
  return host || null;
}

export function isAdminConsolePath(pathname: string): boolean {
  const path = getAdminConsolePath();
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isLegacyAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** 是否应走独立控制台（路径或子域） */
export function matchesAdminConsoleRequest(pathname: string, host: string): boolean {
  const consoleHost = getAdminConsoleHost();
  if (consoleHost && host.toLowerCase() === consoleHost) return true;
  return isAdminConsolePath(pathname);
}
