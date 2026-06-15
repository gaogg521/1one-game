import { cookies } from "next/headers";
import { OWNER_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import type { AuthUser, OAuthProviderId, UserRole } from "@/lib/auth/types";
import { randomBytes } from "crypto";

const SESSION_DAYS = 30;

function toAuthUser(row: {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  role: string;
  referralCode: string;
  legacyOwnerKey: string | null;
  oauthAccounts: { provider: string }[];
}): AuthUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    email: row.email,
    role: row.role as UserRole,
    referralCode: row.referralCode,
    legacyOwnerKey: row.legacyOwnerKey,
    providers: row.oauthAccounts.map((a) => a.provider as OAuthProviderId),
  };
}

export async function getOwnerKeyFromCookies(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(OWNER_COOKIE)?.value;
}

export async function getSessionTokenFromCookies(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}

/** 匿名访客：按 ownerKey 懒创建 User 记录，便于后续 OAuth 合并作品。 */
export async function ensureUserForOwnerKey(ownerKey: string) {
  const existing = await prisma.user.findUnique({ where: { legacyOwnerKey: ownerKey } });
  if (existing) return existing;
  try {
    return await prisma.user.create({
      data: { legacyOwnerKey: ownerKey },
    });
  } catch (e) {
    if (!isPrismaUniqueViolation(e)) throw e;
    const raced = await prisma.user.findUnique({ where: { legacyOwnerKey: ownerKey } });
    if (raced) return raced;
    throw e;
  }
}

export async function getUserBySessionToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token?.trim()) return null;
  const session = await prisma.userSession.findUnique({
    where: { token },
    include: { user: { include: { oauthAccounts: { select: { provider: true } } } } },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return toAuthUser(session.user);
}

/** 仅 OAuth 会话用户（不含 ownerKey 懒创建用户） */
export async function getSessionAuthUser(): Promise<AuthUser | null> {
  const sessionToken = await getSessionTokenFromCookies();
  return getUserBySessionToken(sessionToken);
}

/** 是否已通过 OAuth 登录（有有效会话且绑定了第三方账号） */
export function isOAuthAuthenticated(user: AuthUser): boolean {
  return user.providers.length > 0;
}

/** 是否应参与额度扣减：必须 OAuth 登录，lazy User 不算「已登录」 */
export function isQuotaEligibleUser(user: AuthUser | null): user is AuthUser {
  return Boolean(user && isOAuthAuthenticated(user));
}

/**
 * 当前用户：优先 OAuth 会话；否则返回 ownerKey 懒创建的 User（仅用于作品合并/归因，不触发额度）。
 */
export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  const fromSession = await getSessionAuthUser();
  if (fromSession) return fromSession;

  const ownerKey = await getOwnerKeyFromCookies();
  if (!ownerKey) return null;
  const user = await prisma.user.findUnique({
    where: { legacyOwnerKey: ownerKey },
    include: { oauthAccounts: { select: { provider: true } } },
  });
  return user ? toAuthUser(user) : null;
}

export async function createUserSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.userSession.create({
    data: { userId, token, expiresAt },
  });
  return token;
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    secure,
  };
}

/** OAuth 登录后：合并当前浏览器 ownerKey 下的作品归属到 user.legacyOwnerKey */
export async function linkOwnerKeyToUser(userId: string, ownerKey: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  if (!user.legacyOwnerKey) {
    await prisma.user.update({ where: { id: userId }, data: { legacyOwnerKey: ownerKey } });
    return;
  }
  if (user.legacyOwnerKey === ownerKey) return;
  // 已有不同 legacyOwnerKey：将当前 ownerKey 作品迁移到主 key
  await prisma.$transaction([
    prisma.project.updateMany({ where: { ownerKey }, data: { ownerKey: user.legacyOwnerKey } }),
    prisma.novel.updateMany({ where: { ownerKey }, data: { ownerKey: user.legacyOwnerKey } }),
    prisma.comic.updateMany({ where: { ownerKey }, data: { ownerKey: user.legacyOwnerKey } }),
  ]);
}

export async function resolveEffectiveOwnerKey(
  authUser: AuthUser | null,
  cookieOwnerKey: string | undefined,
): Promise<string | undefined> {
  if (authUser?.legacyOwnerKey) return authUser.legacyOwnerKey;
  return cookieOwnerKey;
}
