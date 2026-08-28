import type { AuthUser, UserRole } from "@/lib/auth/types";

/** Shared by server-side API gates and client-side console navigation. Keep this module data-only. */
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

export function roleHasAdminCapability(role: UserRole | null | undefined, capability: AdminCapability): boolean {
  return Boolean(role && ROLE_CAPABILITIES[role].includes(capability));
}

export function hasAdminCapability(user: AuthUser | null | undefined, viaLegacy: boolean, capability: AdminCapability): boolean {
  return viaLegacy || roleHasAdminCapability(user?.role, capability);
}

/** Logged-in content staff / admin, or the legacy super-admin key, may open any work URL. */
export function canInspectUnlistedWork(
  role: UserRole | null | undefined,
  viaLegacySuperAdmin: boolean,
): boolean {
  return viaLegacySuperAdmin || roleHasAdminCapability(role, "content");
}
