import { isAdminRole } from "@/lib/auth/admin";
import { hasValidConsole2faSession, isConsole2faRequired } from "@/lib/auth/console-2fa";
import {
  CONSOLE_SSO_COOKIE,
  isConsoleSsoEnabled,
  shouldSkip2faWhenSso,
  validateConsoleSsoMarker,
} from "@/lib/auth/console-sso";
import { getAdminConsolePath } from "@/lib/admin-console-path";
import type { AuthUser } from "@/lib/auth/types";
import { getSessionAuthUser } from "@/lib/auth/user";
import { cookies } from "next/headers";

export type ConsoleAccess = {
  /** 任意已登录用户（会话 cookie）可进入账户中心 */
  canViewConsole: boolean;
  /** 侧边栏「管理员」模块：所有受授权运营角色，按能力展示最小入口集合。 */
  canViewAdminSection: boolean;
  requireLogin: boolean;
  require2fa: boolean;
  user: AuthUser | null;
  consolePath: string;
  ssoEnabled: boolean;
  canSsoLogout: boolean;
};

async function hasSso2faBypass(userId: string): Promise<boolean> {
  if (!shouldSkip2faWhenSso()) return false;
  const jar = await cookies();
  const raw = jar.get(CONSOLE_SSO_COOKIE)?.value;
  if (!raw) return false;
  return validateConsoleSsoMarker(raw, userId);
}

/**
 * 账户中心 / 运营控制台访问策略（参考 ONE AI 分层）：
 * - 已登录用户：可见「常规 / 个人」模块（概览、钱包、资料）
 * - 运营角色：额外可见其能力范围内的运营模块；服务端 API 继续执行同一能力校验
 * - super_admin：可见含密钥、网关与用户治理在内的全部管理模块
 * - 生产 + PIN：admin / super_admin 进入前需二次验证
 */
export async function getConsoleAccess(): Promise<ConsoleAccess> {
  const consolePath = getAdminConsolePath();
  const user = await getSessionAuthUser();
  const ssoEnabled = isConsoleSsoEnabled();
  const canViewAdminSection = Boolean(user && isAdminRole(user.role));
  const canSsoLogout = Boolean(user?.providers.includes("console_oidc"));

  const base = {
    consolePath,
    ssoEnabled,
    canSsoLogout,
    canViewAdminSection,
    user,
  };

  if (user) {
    if (isAdminRole(user.role) && isConsole2faRequired() && !(await hasValidConsole2faSession(user.id))) {
      if (await hasSso2faBypass(user.id)) {
        return { ...base, canViewConsole: true, requireLogin: false, require2fa: false };
      }
      return { ...base, canViewConsole: false, requireLogin: false, require2fa: true };
    }
    return { ...base, canViewConsole: true, requireLogin: false, require2fa: false };
  }

  if (process.env.NODE_ENV !== "production") {
    return { ...base, canViewConsole: true, requireLogin: false, require2fa: false, canViewAdminSection: true };
  }

  return { ...base, canViewConsole: false, requireLogin: true, require2fa: false };
}
