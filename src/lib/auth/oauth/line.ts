import type { OAuthProfile, OAuthProviderHandler } from "@/lib/auth/oauth/providers";

/** LINE Login OAuth（OAUTH_LINE_CHANNEL_ID / OAUTH_LINE_CHANNEL_SECRET） */
export function createLineOAuthHandler(): OAuthProviderHandler {
  const channelId = process.env.OAUTH_LINE_CHANNEL_ID?.trim() ?? "";
  const channelSecret = process.env.OAUTH_LINE_CHANNEL_SECRET?.trim() ?? "";
  return {
    config: {
      id: "line",
      label: "LINE",
      enabled: Boolean(channelId && channelSecret),
      configured: Boolean(channelId),
    },
    getAuthorizeUrl(state, redirectUri) {
      const q = new URLSearchParams({
        response_type: "code",
        client_id: channelId,
        redirect_uri: redirectUri,
        state,
        scope: "profile openid",
      });
      return `https://access.line.me/oauth2/v2.1/authorize?${q}`;
    },
    async exchangeCode(code, redirectUri) {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: channelId,
        client_secret: channelSecret,
      });
      const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };
      if (!tokenJson.access_token) {
        throw new Error(tokenJson.error_description ?? tokenJson.error ?? "LINE token 交换失败");
      }

      const userRes = await fetch("https://api.line.me/v2/profile", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      const userJson = (await userRes.json()) as {
        userId?: string;
        displayName?: string;
        pictureUrl?: string;
      };
      if (!userJson.userId) throw new Error("LINE 用户信息获取失败");
      return {
        providerUserId: userJson.userId,
        displayName: userJson.displayName,
        avatarUrl: userJson.pictureUrl,
        raw: userJson,
      } satisfies OAuthProfile;
    },
  };
}
