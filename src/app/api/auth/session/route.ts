import { NextResponse } from "next/server";
import { ensureUserForOwnerKey, getOwnerKeyFromCookies, getSessionAuthUser } from "@/lib/auth/user";
import { listOAuthProviders } from "@/lib/auth/oauth/providers";
import { getQuotaSummary } from "@/lib/commerce/quota";
import { isWechatJssdkConfigured } from "@/lib/wechat/jssdk";

export async function GET() {
  const ownerKey = await getOwnerKeyFromCookies();
  if (ownerKey) await ensureUserForOwnerKey(ownerKey);
  // 仅 OAuth / 邮箱登录会话对外展示为「已登录」；匿名 ownerKey 懒创建 User 不暴露给前端
  const user = await getSessionAuthUser();
  const providers = listOAuthProviders();

  const quota = user ? await getQuotaSummary(user.id) : null;

  return NextResponse.json({
    user: user
      ? {
          id: user.id,
          username: user.username,
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
