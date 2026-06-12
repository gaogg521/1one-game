import type { OAuthProfile, OAuthProviderHandler } from "@/lib/auth/oauth/providers";

/** 本地 / 预发环境模拟 OAuth，便于联调后台与用户体系。 */
export function createDevOAuthHandler(): OAuthProviderHandler {
  return {
    config: { id: "dev", label: "开发登录", enabled: true, configured: true },
    getAuthorizeUrl(state, redirectUri) {
      const u = new URL(redirectUri);
      u.searchParams.set("code", "dev_ok");
      u.searchParams.set("state", state);
      return u.toString();
    },
    async exchangeCode(code) {
      if (code !== "dev_ok") throw new Error("开发登录 code 无效");
      return {
        providerUserId: `dev_${Date.now()}`,
        displayName: "开发用户",
        email: "dev@1one.local",
      } satisfies OAuthProfile;
    },
  };
}
