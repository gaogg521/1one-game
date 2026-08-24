import { getCurrentAuthUser, getOwnerKeyFromCookies } from "@/lib/auth/user";
import { isSuperAdmin } from "@/lib/super-admin";
import type { AuthUser, UserRole } from "@/lib/auth/types";
import { apiErrorMessage } from "@/lib/i18n/progress-message";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { prisma } from "@/lib/prisma";

export type AdminCapability = "content" | "growth" | "finance_read" | "platform_ops" | "user_admin" | "quota_write";

const ROLE_CAPABILITIES: Record<UserRole, readonly AdminCapability[]> = {
  user: [],
  content_operator: ["content"],
  growth_operator: ["growth"],
  finance_viewer: ["finance_read"],
  platform_operator: ["platform_ops"],
  admin: ["content", "growth", "finance_read", "platform_ops", "user_admin", "quota_write"],
  super_admin: ["content", "growth", "finance_read", "platform_ops", "user_admin", "quota_write"],
};

export function hasAdminCapability(user: AuthUser | null | undefined, viaLegacy: boolean, capability: AdminCapability): boolean {
  return viaLegacy || Boolean(user && ROLE_CAPABILITIES[user.role].includes(capability));
}

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

  if (user && user.role !== "user") {
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
  return role !== "user";
}

/** Scope check for operator roles. Super admins and legacy emergency access retain full control. */
export async function requireAdminCapability(req: Request, capability: AdminCapability) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate;
  if (hasAdminCapability(gate.user, gate.viaLegacy, capability)) return gate;
  return { ok: false as const, status: 403, error: apiErrorMessage(resolveRequestLocaleSync(req), "adminRequired") };
}

export function isSuperAdminRole(role: UserRole | string | null | undefined): boolean {
  return role === "super_admin";
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
