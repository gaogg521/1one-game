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
import { getCurrentAuthUser } from "@/lib/auth/user";
import { cookies } from "next/headers";

export type ConsoleAccess = {
  canViewConsole: boolean;
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
 * 运营控制台页面访问策略：
 * - 生产：必须 admin / super_admin 登录会话（legacy 密钥仅用于 API，不暴露整页 UI）
 * - 生产 + ADMIN_CONSOLE_2FA_PIN：登录后还需 PIN 二次验证
 * - 生产 + SSO + ADMIN_CONSOLE_2FA_SKIP_WHEN_SSO=1：IdP 登录可跳过 PIN
 * - 开发：允许进入 Shell，由 API 403 + 密钥面板兜底（E2E / 本地运维）
 */
export async function getConsoleAccess(): Promise<ConsoleAccess> {
  const consolePath = getAdminConsolePath();
  const user = await getCurrentAuthUser();
  const ssoEnabled = isConsoleSsoEnabled();

  if (user && isAdminRole(user.role)) {
    const canSsoLogout = user.providers.includes("console_oidc");
    if (isConsole2faRequired() && !(await hasValidConsole2faSession(user.id))) {
      if (await hasSso2faBypass(user.id)) {
        return {
          canViewConsole: true,
          requireLogin: false,
          require2fa: false,
          user,
          consolePath,
          ssoEnabled,
          canSsoLogout,
        };
      }
      return {
        canViewConsole: false,
        requireLogin: false,
        require2fa: true,
        user,
        consolePath,
        ssoEnabled,
        canSsoLogout,
      };
    }
    return {
      canViewConsole: true,
      requireLogin: false,
      require2fa: false,
      user,
      consolePath,
      ssoEnabled,
      canSsoLogout,
    };
  }

  if (process.env.NODE_ENV !== "production") {
    return {
      canViewConsole: true,
      requireLogin: false,
      require2fa: false,
      user,
      consolePath,
      ssoEnabled,
      canSsoLogout: false,
    };
  }

  return {
    canViewConsole: false,
    requireLogin: true,
    require2fa: false,
    user,
    consolePath,
    ssoEnabled,
    canSsoLogout: false,
  };
}
