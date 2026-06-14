import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminConsolePath } from "@/lib/admin-console-path";
import {
  CONSOLE_SSO_COOKIE,
  CONSOLE_SSO_STATE_COOKIE,
  assertConsoleSsoEmailAllowed,
  exchangeConsoleSsoCode,
  mintConsoleSsoMarker,
  resolveConsoleSsoRole,
  shouldSkip2faWhenSso,
  validateConsoleSsoState,
} from "@/lib/auth/console-sso";
import { createUserSession, getOwnerKeyFromCookies, linkOwnerKeyToUser, sessionCookieOptions } from "@/lib/auth/user";
import { SESSION_COOKIE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";

const SSO_PROVIDER = "console_oidc";

/** GET — OIDC callback：code → session → redirect console */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const origin = url.origin;
  const consolePath = getAdminConsolePath();
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}${consolePath}?sso_error=${encodeURIComponent(reason)}`);

  if (!code || !state) return fail("missing_code");

  const jar = await cookies();
  const stateCookie = jar.get(CONSOLE_SSO_STATE_COOKIE)?.value;
  jar.delete(CONSOLE_SSO_STATE_COOKIE);
  if (!stateCookie || stateCookie !== state) return fail("invalid_state");

  const parsed = validateConsoleSsoState(state);
  if (!parsed.ok) return fail("expired_state");

  try {
    const profile = await exchangeConsoleSsoCode(code, origin);
    if (!assertConsoleSsoEmailAllowed(profile.email)) return fail("email_domain");
    const role = resolveConsoleSsoRole(profile);
    if (!role) return fail("role_denied");

    let account = await prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider: SSO_PROVIDER, providerUserId: profile.providerUserId } },
      include: { user: true },
    });

    let userId: string;
    if (account) {
      userId = account.userId;
      await prisma.user.update({
        where: { id: userId },
        data: {
          role,
          ...(profile.displayName ? { displayName: profile.displayName } : {}),
          ...(profile.email ? { email: profile.email } : {}),
        },
      });
    } else {
      const ownerKey = await getOwnerKeyFromCookies();
      const emailUser = await prisma.user.findUnique({ where: { email: profile.email } });
      const linked = ownerKey
        ? await prisma.user.findUnique({ where: { legacyOwnerKey: ownerKey } })
        : null;
      const existing = linked ?? emailUser;
      const user = existing
        ? await prisma.user.update({
            where: { id: existing.id },
            data: {
              role,
              displayName: profile.displayName ?? existing.displayName,
              ...(profile.email && !existing.email ? { email: profile.email } : {}),
            },
          })
        : await prisma.user.create({
            data: {
              legacyOwnerKey: ownerKey,
              email: profile.email,
              displayName: profile.displayName ?? profile.email,
              role,
            },
          });
      userId = user.id;
      try {
        await prisma.oAuthAccount.create({
          data: {
            userId,
            provider: SSO_PROVIDER,
            providerUserId: profile.providerUserId,
          },
        });
      } catch (e) {
        if (!isPrismaUniqueViolation(e)) throw e;
      }
    }

    const ownerKey = await getOwnerKeyFromCookies();
    if (ownerKey) await linkOwnerKeyToUser(userId, ownerKey);

    const token = await createUserSession(userId);
    const res = NextResponse.redirect(`${origin}${parsed.nextPath}?sso=ok`);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(origin.startsWith("https")));
    if (shouldSkip2faWhenSso()) {
      res.cookies.set(CONSOLE_SSO_COOKIE, mintConsoleSsoMarker(userId), {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 12 * 60 * 60,
        secure: origin.startsWith("https"),
      });
    }
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sso_failed";
    return fail(msg.slice(0, 120));
  }
}
