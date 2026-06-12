import type { OAuthProfile, OAuthProviderHandler } from "@/lib/auth/oauth/providers";

function parseQqJsonp(text: string): Record<string, unknown> {
  const m = text.match(/callback\s*\(\s*(\{[\s\S]*\})\s*\)/);
  if (!m?.[1]) throw new Error("QQ openid 响应解析失败");
  return JSON.parse(m[1]) as Record<string, unknown>;
}

/** QQ 互联 OAuth（OAUTH_QQ_APP_ID / OAUTH_QQ_APP_SECRET） */
export function createQqOAuthHandler(): OAuthProviderHandler {
  const appId = process.env.OAUTH_QQ_APP_ID?.trim() ?? "";
  const secret = process.env.OAUTH_QQ_APP_SECRET?.trim() ?? "";
  return {
    config: {
      id: "qq",
      label: "QQ",
      enabled: Boolean(appId && secret),
      configured: Boolean(appId),
    },
    getAuthorizeUrl(state, redirectUri) {
      const q = new URLSearchParams({
        response_type: "code",
        client_id: appId,
        redirect_uri: redirectUri,
        scope: "get_user_info",
        state,
      });
      return `https://graph.qq.com/oauth2.0/authorize?${q}`;
    },
    async exchangeCode(code, redirectUri) {
      const tokenUrl = new URL("https://graph.qq.com/oauth2.0/token");
      tokenUrl.searchParams.set("grant_type", "authorization_code");
      tokenUrl.searchParams.set("client_id", appId);
      tokenUrl.searchParams.set("client_secret", secret);
      tokenUrl.searchParams.set("code", code);
      tokenUrl.searchParams.set("redirect_uri", redirectUri);
      tokenUrl.searchParams.set("fmt", "json");
      const tokenRes = await fetch(tokenUrl);
      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        error?: number;
        error_description?: string;
      };
      if (!tokenJson.access_token) {
        throw new Error(tokenJson.error_description ?? "QQ token 交换失败");
      }

      const meRes = await fetch(
        `https://graph.qq.com/oauth2.0/me?access_token=${encodeURIComponent(tokenJson.access_token)}&fmt=json`,
      );
      const meJson = parseQqJsonp(await meRes.text());
      const openid = String(meJson.openid ?? "");
      if (!openid) throw new Error("QQ openid 获取失败");

      const userUrl = new URL("https://graph.qq.com/user/get_user_info");
      userUrl.searchParams.set("access_token", tokenJson.access_token);
      userUrl.searchParams.set("oauth_consumer_key", appId);
      userUrl.searchParams.set("openid", openid);
      userUrl.searchParams.set("fmt", "json");
      const userRes = await fetch(userUrl);
      const userJson = (await userRes.json()) as {
        ret?: number;
        msg?: string;
        nickname?: string;
        figureurl_qq_2?: string;
      };
      if (userJson.ret !== 0 && userJson.ret !== undefined) {
        throw new Error(userJson.msg ?? "QQ 用户信息获取失败");
      }
      return {
        providerUserId: openid,
        displayName: userJson.nickname,
        avatarUrl: userJson.figureurl_qq_2,
        raw: userJson,
      } satisfies OAuthProfile;
    },
  };
}
