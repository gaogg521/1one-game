export type UserRole =
  | "user"
  | "content_operator"
  | "growth_operator"
  | "finance_viewer"
  | "platform_operator"
  | "admin"
  | "super_admin";

export type OAuthProviderId = "wechat" | "qq" | "feishu" | "line" | "douyin" | "dev" | "console_oidc";

export type AuthUser = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  role: UserRole;
  referralCode: string;
  legacyOwnerKey: string | null;
  providers: OAuthProviderId[];
};

export type ShareChannel =
  | "wechat"
  | "qq"
  | "feishu"
  | "line"
  | "douyin"
  | "copy"
  | "link"
  | "unknown";
