import type { OAuthProviderId } from "@/lib/auth/types";

export type OAuthProfile = {
  providerUserId: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  raw?: unknown;
};

export type OAuthProviderConfig = {
  id: OAuthProviderId;
  label: string;
  enabled: boolean;
  /** 未配置密钥时展示为「即将开放」 */
  configured: boolean;
};

export type OAuthProviderHandler = {
  config: OAuthProviderConfig;
  getAuthorizeUrl: (state: string, redirectUri: string) => string;
  exchangeCode: (code: string, redirectUri: string) => Promise<OAuthProfile>;
};

function env(id: string): string | undefined {
  return process.env[id]?.trim() || undefined;
}

/** 各平台 OAuth 配置探测（真实对接需补全开放平台应用参数）。 */
export function listOAuthProviders(): OAuthProviderConfig[] {
  const items: OAuthProviderConfig[] = [
    {
      id: "wechat",
      label: "微信",
      enabled: Boolean(env("OAUTH_WECHAT_APP_ID") && env("OAUTH_WECHAT_APP_SECRET")),
      configured: Boolean(env("OAUTH_WECHAT_APP_ID")),
    },
    {
      id: "qq",
      label: "QQ",
      enabled: Boolean(env("OAUTH_QQ_APP_ID") && env("OAUTH_QQ_APP_SECRET")),
      configured: Boolean(env("OAUTH_QQ_APP_ID")),
    },
    {
      id: "feishu",
      label: "飞书",
      enabled: Boolean(env("OAUTH_FEISHU_APP_ID") && env("OAUTH_FEISHU_APP_SECRET")),
      configured: Boolean(env("OAUTH_FEISHU_APP_ID")),
    },
    {
      id: "line",
      label: "LINE",
      enabled: Boolean(env("OAUTH_LINE_CHANNEL_ID") && env("OAUTH_LINE_CHANNEL_SECRET")),
      configured: Boolean(env("OAUTH_LINE_CHANNEL_ID")),
    },
    {
      id: "douyin",
      label: "抖音",
      enabled: Boolean(env("OAUTH_DOUYIN_CLIENT_KEY") && env("OAUTH_DOUYIN_CLIENT_SECRET")),
      configured: Boolean(env("OAUTH_DOUYIN_CLIENT_KEY")),
    },
  ];
  if (process.env.NODE_ENV !== "production" || env("OAUTH_DEV_ENABLED") === "1") {
    items.push({
      id: "dev",
      label: "开发登录",
      enabled: true,
      configured: true,
    });
  }
  return items;
}

export function getOAuthRedirectUri(origin: string, provider: OAuthProviderId): string {
  return `${origin.replace(/\/$/, "")}/api/auth/oauth/${provider}/callback`;
}
