export type EmailProvider = "resend" | "smtp";

export type EmailConfigPayload = {
  provider?: EmailProvider;
  from?: string;
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
};

export type EmailConfigSource = "env" | "db" | "none";

export type EmailConfigPublicView = {
  updatedAt: string | null;
  updatedByUserId: string | null;
  provider: EmailProvider | null;
  from: string | null;
  resendApiKey: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
  sources: {
    provider: EmailConfigSource;
    from: EmailConfigSource;
    resendApiKey: EmailConfigSource;
    smtpHost: EmailConfigSource;
    smtpPort: EmailConfigSource;
    smtpSecure: EmailConfigSource;
    smtpUser: EmailConfigSource;
    smtpPass: EmailConfigSource;
  };
  configured: boolean;
};

export type EffectiveEmailDelivery = {
  provider: EmailProvider | null;
  from: string | null;
  resendApiKey: string | null;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
  configured: boolean;
};

export type EmailConfigPatch = {
  provider?: EmailProvider | null;
  from?: string | null;
  resendApiKey?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
};
