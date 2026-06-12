import type { OAuthProfile, OAuthProviderHandler } from "@/lib/auth/oauth/providers";

/** 微信开放平台网站应用 OAuth（需配置 OAUTH_WECHAT_APP_ID / SECRET） */
export function createWeChatOAuthHandler(): OAuthProviderHandler {
  const appId = process.env.OAUTH_WECHAT_APP_ID?.trim() ?? "";
  const secret = process.env.OAUTH_WECHAT_APP_SECRET?.trim() ?? "";
  return {
    config: {
      id: "wechat",
      label: "微信",
      enabled: Boolean(appId && secret),
      configured: Boolean(appId),
    },
    getAuthorizeUrl(state, redirectUri) {
      const q = new URLSearchParams({
        appid: appId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "snsapi_login",
        state,
      });
      return `https://open.weixin.qq.com/connect/qrconnect?${q}#wechat_redirect`;
    },
    async exchangeCode(code, redirectUri) {
      const tokenUrl = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
      tokenUrl.searchParams.set("appid", appId);
      tokenUrl.searchParams.set("secret", secret);
      tokenUrl.searchParams.set("code", code);
      tokenUrl.searchParams.set("grant_type", "authorization_code");
      const tokenRes = await fetch(tokenUrl);
      const tokenJson = (await tokenRes.json()) as {
        errcode?: number;
        errmsg?: string;
        access_token?: string;
        openid?: string;
      };
      if (!tokenJson.access_token || !tokenJson.openid) {
        throw new Error(tokenJson.errmsg ?? "微信 token 交换失败");
      }
      const userUrl = new URL("https://api.weixin.qq.com/sns/userinfo");
      userUrl.searchParams.set("access_token", tokenJson.access_token);
      userUrl.searchParams.set("openid", tokenJson.openid);
      const userRes = await fetch(userUrl);
      const userJson = (await userRes.json()) as {
        openid?: string;
        nickname?: string;
        headimgurl?: string;
      };
      return {
        providerUserId: userJson.openid ?? tokenJson.openid,
        displayName: userJson.nickname,
        avatarUrl: userJson.headimgurl,
        raw: userJson,
      } satisfies OAuthProfile;
    },
  };
}
