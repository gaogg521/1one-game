/** 超级管理员：可删除任意用户作品（密钥勿提交仓库）。 */

const HEADER = "x-super-admin-key";

/** 开发期临时开关：非 production 且 DEV_SUPER_ADMIN=1 时免密钥删任意作品。上线前务必关掉。 */
export function isDevSuperAdminEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_SUPER_ADMIN === "1";
}

function parseOwnerKeyAllowlist(): Set<string> {
  const raw = process.env.SUPER_ADMIN_OWNER_KEYS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function getSuperAdminKeyFromRequest(req: Request): string | null {
  return req.headers.get(HEADER)?.trim() || null;
}

/** 当前请求是否携带有效超级管理员凭证 */
export function isSuperAdmin(req: Request, ownerKey?: string | null): boolean {
  if (isDevSuperAdminEnabled()) return true;
  const secret = process.env.SUPER_ADMIN_SECRET?.trim();
  const headerKey = getSuperAdminKeyFromRequest(req);
  if (secret && headerKey && headerKey === secret) return true;
  if (ownerKey && parseOwnerKeyAllowlist().has(ownerKey)) return true;
  return false;
}

export function canDeleteOwnedResource(
  resourceOwnerKey: string,
  requestOwnerKey: string | undefined | null,
  req: Request,
): boolean {
  if (requestOwnerKey && resourceOwnerKey === requestOwnerKey) return true;
  return isSuperAdmin(req, requestOwnerKey);
}
