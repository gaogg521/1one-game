import { getCurrentAuthUser, getOwnerKeyFromCookies } from "@/lib/auth/user";
import { isSuperAdmin } from "@/lib/super-admin";
import type { AuthUser, UserRole } from "@/lib/auth/types";
import { apiErrorMessage } from "@/lib/i18n/progress-message";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { prisma } from "@/lib/prisma";

async function safeGetCurrentAuthUser(): Promise<AuthUser | null> {
  try {
    return await getCurrentAuthUser();
  } catch {
    return null;
  }
}

export async function requireAdmin(req: Request): Promise<
  | { ok: true; user: AuthUser | null; ownerKey: string | undefined; viaLegacy: boolean }
  | { ok: false; status: number; error: string }
> {
  const ownerKey = await getOwnerKeyFromCookies();

  /** legacy 密钥优先：避免 ownerKey 查库失败时永远进不了 isSuperAdmin 分支 */
  if (isSuperAdmin(req, ownerKey)) {
    const user = await safeGetCurrentAuthUser();
    return { ok: true, user, ownerKey, viaLegacy: true };
  }

  let user: AuthUser | null;
  try {
    user = await getCurrentAuthUser();
  } catch {
    return {
      ok: false,
      status: 503,
      error: apiErrorMessage(resolveRequestLocaleSync(req), "adminRequired"),
    };
  }

  if (user && (user.role === "admin" || user.role === "super_admin")) {
    return { ok: true, user, ownerKey, viaLegacy: false };
  }

  return {
    ok: false,
    status: 403,
    error: apiErrorMessage(resolveRequestLocaleSync(req), "adminRequired"),
  };
}

export async function writeAdminAudit(opts: {
  req: Request;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
  actorUserId?: string | null;
  actorOwnerKey?: string | null;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        action: opts.action,
        targetType: opts.targetType,
        targetId: opts.targetId,
        detailJson: opts.detail ? JSON.stringify(opts.detail) : null,
        actorUserId: opts.actorUserId ?? undefined,
        actorOwnerKey: opts.actorOwnerKey ?? undefined,
      },
    });
  } catch {
    /* 审计失败不阻断主流程 */
  }
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "super_admin";
}

/** 仅 super_admin 账号或 SUPER_ADMIN_SECRET 可管理运行时密钥/模型。 */
export async function requireSuperAdmin(req: Request): Promise<
  | { ok: true; user: AuthUser | null; ownerKey: string | undefined; viaLegacy: boolean }
  | { ok: false; status: number; error: string }
> {
  const ownerKey = await getOwnerKeyFromCookies();

  if (isSuperAdmin(req, ownerKey)) {
    const user = await safeGetCurrentAuthUser();
    return { ok: true, user, ownerKey, viaLegacy: true };
  }

  const user = await safeGetCurrentAuthUser();
  if (user?.role === "super_admin") {
    return { ok: true, user, ownerKey, viaLegacy: false };
  }

  return {
    ok: false,
    status: 403,
    error: apiErrorMessage(resolveRequestLocaleSync(req), "superAdminRequired"),
  };
}

export function canManageRuntimeConfig(
  user: AuthUser | null | undefined,
  viaLegacy: boolean,
): boolean {
  return user?.role === "super_admin" || viaLegacy;
}

/** 仅已登录 super_admin 账号可 UI/API 升权；legacy 密钥不能代升（请用 CLI）。 */
export function canPromoteSuperAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === "super_admin";
}
