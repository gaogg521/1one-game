import type { OAuthProfile, OAuthProviderHandler } from "@/lib/auth/oauth/providers";

/** 抖音开放平台 OAuth（OAUTH_DOUYIN_CLIENT_KEY / OAUTH_DOUYIN_CLIENT_SECRET） */
export function createDouyinOAuthHandler(): OAuthProviderHandler {
  const clientKey = process.env.OAUTH_DOUYIN_CLIENT_KEY?.trim() ?? "";
  const clientSecret = process.env.OAUTH_DOUYIN_CLIENT_SECRET?.trim() ?? "";
  return {
    config: {
      id: "douyin",
      label: "抖音",
      enabled: Boolean(clientKey && clientSecret),
      configured: Boolean(clientKey),
    },
    getAuthorizeUrl(state, redirectUri) {
      const q = new URLSearchParams({
        client_key: clientKey,
        response_type: "code",
        scope: "user_info",
        redirect_uri: redirectUri,
        state,
      });
      return `https://open.douyin.com/platform/oauth/connect/?${q}`;
    },
    async exchangeCode(code) {
      const tokenRes = await fetch("https://open.douyin.com/oauth/access_token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_key: clientKey,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
        }),
      });
      const tokenJson = (await tokenRes.json()) as {
        data?: { access_token?: string; open_id?: string; error_code?: number; description?: string };
        message?: string;
      };
      const data = tokenJson.data;
      if (!data?.access_token || !data.open_id) {
        throw new Error(data?.description ?? tokenJson.message ?? "抖音 token 交换失败");
      }

      const userRes = await fetch("https://open.douyin.com/oauth/userinfo/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: data.access_token,
          open_id: data.open_id,
        }),
      });
      const userJson = (await userRes.json()) as {
        data?: { open_id?: string; nickname?: string; avatar?: string };
        message?: string;
      };
      const u = userJson.data;
      if (!u?.open_id) throw new Error(userJson.message ?? "抖音用户信息获取失败");
      return {
        providerUserId: u.open_id,
        displayName: u.nickname,
        avatarUrl: u.avatar,
        raw: userJson,
      } satisfies OAuthProfile;
    },
  };
}
