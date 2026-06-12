import type { AppLocale } from "@/i18n/routing";
import { tMessage } from "@/lib/i18n/messages";

const PROVIDER_IDS = ["wechat", "qq", "feishu", "line", "douyin", "dev"] as const;

function isOAuthProviderId(id: string): id is (typeof PROVIDER_IDS)[number] {
  return (PROVIDER_IDS as readonly string[]).includes(id);
}

/** OAuth 按钮展示名：优先 messages.account.providers。 */
export function localizedOAuthProviderLabel(
  locale: AppLocale,
  providerId: string,
  fallbackLabel?: string,
): string {
  if (isOAuthProviderId(providerId)) {
    const fromMessages = tMessage(locale, `account.providers.${providerId}`);
    if (fromMessages !== `account.providers.${providerId}`) return fromMessages;
  }
  return fallbackLabel ?? providerId;
}
