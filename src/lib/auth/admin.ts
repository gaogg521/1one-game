import { getCurrentAuthUser, getOwnerKeyFromCookies } from "@/lib/auth/user";
import { isSuperAdmin } from "@/lib/super-admin";
import type { AuthUser, UserRole } from "@/lib/auth/types";
import { apiErrorMessage } from "@/lib/i18n/progress-message";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { prisma } from "@/lib/prisma";

export async function requireAdmin(req: Request): Promise<
  | { ok: true; user: AuthUser | null; ownerKey: string | undefined; viaLegacy: boolean }
  | { ok: false; status: number; error: string }
> {
  const user = await getCurrentAuthUser();
  const ownerKey = await getOwnerKeyFromCookies();

  if (user && (user.role === "admin" || user.role === "super_admin")) {
    return { ok: true, user, ownerKey, viaLegacy: false };
  }

  if (isSuperAdmin(req, ownerKey)) {
    return { ok: true, user, ownerKey, viaLegacy: true };
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
