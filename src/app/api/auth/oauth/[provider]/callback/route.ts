import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { OAuthProviderId } from "@/lib/auth/types";
import { getOAuthHandler, getOAuthRedirectUri } from "@/lib/auth/oauth";
import {
  createUserSession,
  getOwnerKeyFromCookies,
  linkOwnerKeyToUser,
  sessionCookieOptions,
} from "@/lib/auth/user";
import { bindReferralOnSignup } from "@/lib/auth/referral";
import { grantSignupBonus } from "@/lib/commerce/quota";
import { REF_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";

const STATE_COOKIE = "gcreator_oauth_state";

type RouteContext = { params: Promise<{ provider: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const { provider: raw } = await ctx.params;
  const provider = raw as OAuthProviderId;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const origin = url.origin;

  const jar = await cookies();
  const stateRaw = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (!code || !state || !stateRaw || stateRaw !== `${provider}:${state}`) {
    return NextResponse.redirect(`${origin}/login?error=oauth_state`);
  }

  try {
    const handler = getOAuthHandler(provider);
    const profile = await handler.exchangeCode(code, getOAuthRedirectUri(origin, provider));

    let account = await prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId: profile.providerUserId } },
      include: { user: true },
    });

    let userId: string;
    if (account) {
      userId = account.userId;
      await prisma.oAuthAccount.update({
        where: { id: account.id },
        data: { profileJson: profile.raw ? JSON.stringify(profile.raw) : undefined },
      });
      if (profile.displayName || profile.avatarUrl) {
        await prisma.user.update({
          where: { id: account.userId },
          data: {
            ...(profile.displayName ? { displayName: profile.displayName } : {}),
            ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
          },
        });
      }
    } else {
      const ownerKey = await getOwnerKeyFromCookies();
      const refCode = jar.get(REF_COOKIE)?.value;
      const linked = ownerKey
        ? await prisma.user.findUnique({ where: { legacyOwnerKey: ownerKey } })
        : null;
      const emailUser = !linked && profile.email
        ? await prisma.user.findUnique({ where: { email: profile.email } })
        : null;
      const existingUser = linked ?? emailUser;
      const user = existingUser
        ? await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              displayName: profile.displayName ?? existingUser.displayName,
              avatarUrl: profile.avatarUrl ?? existingUser.avatarUrl,
              ...(profile.email && !existingUser.email ? { email: profile.email } : {}),
              ...(provider === "dev" && process.env.OAUTH_DEV_ADMIN === "1" ? { role: "admin" } : {}),
            },
          })
        : await prisma.user.create({
            data: {
              legacyOwnerKey: ownerKey,
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              email: profile.email,
              role:
                provider === "dev" && process.env.OAUTH_DEV_ADMIN === "1" ? "admin" : "user",
            },
          });
      userId = user.id;
      try {
        await prisma.oAuthAccount.create({
          data: {
            userId,
            provider,
            providerUserId: profile.providerUserId,
            profileJson: profile.raw ? JSON.stringify(profile.raw) : undefined,
          },
        });
      } catch (e) {
        if (!isPrismaUniqueViolation(e)) throw e;
        account = await prisma.oAuthAccount.findUnique({
          where: { provider_providerUserId: { provider, providerUserId: profile.providerUserId } },
          include: { user: true },
        });
        if (!account) throw e;
        userId = account.userId;
      }
      const fresh = await prisma.user.findUnique({
        where: { id: userId },
        select: { referredById: true },
      });
      if (!fresh?.referredById) await bindReferralOnSignup(userId, refCode);
    }

    await grantSignupBonus(userId);

    const ownerKey = await getOwnerKeyFromCookies();
    if (ownerKey) await linkOwnerKeyToUser(userId, ownerKey);

    const token = await createUserSession(userId);
    const res = NextResponse.redirect(`${origin}/studio?login=ok`);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(origin.startsWith("https")));
    return res;
  } catch (e) {
    const msg = encodeURIComponent(e instanceof Error ? e.message : "oauth_failed");
    return NextResponse.redirect(`${origin}/login?error=${msg}`);
  }
}
