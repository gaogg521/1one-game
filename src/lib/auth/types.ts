export type UserRole = "user" | "admin" | "super_admin";

export type OAuthProviderId = "wechat" | "qq" | "feishu" | "line" | "douyin" | "dev";

export type AuthUser = {
  id: string;
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
