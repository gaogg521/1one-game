import { NextResponse } from "next/server";
import { getCurrentAuthUser, ensureUserForOwnerKey, getOwnerKeyFromCookies } from "@/lib/auth/user";
import { listOAuthProviders } from "@/lib/auth/oauth/providers";
import { getQuotaSummary } from "@/lib/commerce/quota";
import { isWechatJssdkConfigured } from "@/lib/wechat/jssdk";

export async function GET() {
  const ownerKey = await getOwnerKeyFromCookies();
  if (ownerKey) await ensureUserForOwnerKey(ownerKey);
  const user = await getCurrentAuthUser();
  const providers = listOAuthProviders();

  const quota = user ? await getQuotaSummary(user.id) : null;

  return NextResponse.json({
    user: user
      ? {
          id: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          email: user.email,
          role: user.role,
          referralCode: user.referralCode,
          providers: user.providers,
          quota,
        }
      : null,
    wechatJssdk: isWechatJssdkConfigured(),
    ownerKeyPresent: Boolean(ownerKey),
    oauthProviders: providers.map((p) => ({
      id: p.id,
      label: p.label,
      enabled: p.enabled,
      configured: p.configured,
    })),
  });
}
