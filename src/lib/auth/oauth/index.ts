import type { OAuthProviderId } from "@/lib/auth/types";
import { createDevOAuthHandler } from "@/lib/auth/oauth/dev";
import { createDouyinOAuthHandler } from "@/lib/auth/oauth/douyin";
import { createFeishuOAuthHandler } from "@/lib/auth/oauth/feishu";
import { createLineOAuthHandler } from "@/lib/auth/oauth/line";
import { createQqOAuthHandler } from "@/lib/auth/oauth/qq";
import { createWeChatOAuthHandler } from "@/lib/auth/oauth/wechat";
import type { OAuthProviderHandler } from "@/lib/auth/oauth/providers";

export { getOAuthRedirectUri, listOAuthProviders } from "@/lib/auth/oauth/providers";

const STUB_MESSAGE = "该平台 OAuth 尚未配置密钥，请在 .env 填入开放平台参数后启用";

function stubHandler(id: OAuthProviderId, label: string): OAuthProviderHandler {
  return {
    config: { id, label, enabled: false, configured: false },
    getAuthorizeUrl() {
      throw new Error(STUB_MESSAGE);
    },
    async exchangeCode() {
      throw new Error(STUB_MESSAGE);
    },
  };
}

export function getOAuthHandler(provider: OAuthProviderId): OAuthProviderHandler {
  switch (provider) {
    case "wechat": {
      const h = createWeChatOAuthHandler();
      return h.config.enabled ? h : stubHandler("wechat", "微信");
    }
    case "dev":
      return createDevOAuthHandler();
    case "qq": {
      const h = createQqOAuthHandler();
      return h.config.enabled ? h : stubHandler("qq", "QQ");
    }
    case "feishu": {
      const h = createFeishuOAuthHandler();
      return h.config.enabled ? h : stubHandler("feishu", "飞书");
    }
    case "line": {
      const h = createLineOAuthHandler();
      return h.config.enabled ? h : stubHandler("line", "LINE");
    }
    case "douyin": {
      const h = createDouyinOAuthHandler();
      return h.config.enabled ? h : stubHandler("douyin", "抖音");
    }
    default:
      throw new Error(`未知 OAuth 提供商：${provider}`);
  }
}
