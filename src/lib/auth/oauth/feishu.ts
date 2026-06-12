import type { OAuthProfile, OAuthProviderHandler } from "@/lib/auth/oauth/providers";

/** 飞书开放平台 OAuth（OAUTH_FEISHU_APP_ID / OAUTH_FEISHU_APP_SECRET） */
export function createFeishuOAuthHandler(): OAuthProviderHandler {
  const appId = process.env.OAUTH_FEISHU_APP_ID?.trim() ?? "";
  const secret = process.env.OAUTH_FEISHU_APP_SECRET?.trim() ?? "";
  return {
    config: {
      id: "feishu",
      label: "飞书",
      enabled: Boolean(appId && secret),
      configured: Boolean(appId),
    },
    getAuthorizeUrl(state, redirectUri) {
      const q = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: "code",
        state,
      });
      return `https://accounts.feishu.cn/open-apis/authen/v1/authorize?${q}`;
    },
    async exchangeCode(code, redirectUri) {
      const tokenRes = await fetch("https://open.feishu.cn/open-apis/authen/v2/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          client_id: appId,
          client_secret: secret,
          redirect_uri: redirectUri,
        }),
      });
      const tokenJson = (await tokenRes.json()) as {
        code?: number;
        msg?: string;
        data?: { access_token?: string; open_id?: string };
      };
      const accessToken = tokenJson.data?.access_token;
      const openId = tokenJson.data?.open_id;
      if (!accessToken) {
        throw new Error(tokenJson.msg ?? "飞书 token 交换失败");
      }

      const userRes = await fetch("https://open.feishu.cn/open-apis/authen/v1/user_info", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userJson = (await userRes.json()) as {
        code?: number;
        msg?: string;
        data?: {
          open_id?: string;
          name?: string;
          en_name?: string;
          avatar_url?: string;
          email?: string;
        };
      };
      if (userJson.code !== 0 && userJson.code !== undefined) {
        throw new Error(userJson.msg ?? "飞书用户信息获取失败");
      }
      const u = userJson.data;
      return {
        providerUserId: u?.open_id ?? openId ?? "",
        displayName: u?.name ?? u?.en_name,
        avatarUrl: u?.avatar_url,
        email: u?.email,
        raw: userJson,
      } satisfies OAuthProfile;
    },
  };
}
