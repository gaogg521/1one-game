/**
 * 平台邮件配置：DB 覆盖 .env，启动时 hydrate，保存后立即生效。
 */
import {
  deletePlatformEmailConfig,
  encryptEmailConfigPayload,
  findPlatformEmailConfigRow,
  parseEmailConfigEnc,
  upsertPlatformEmailConfig,
} from "@/lib/email-config-db";
import type {
  EffectiveEmailDelivery,
  EmailConfigPatch,
  EmailConfigPayload,
  EmailConfigPublicView,
  EmailConfigSource,
  EmailProvider,
} from "@/lib/email-config-types";

export type {
  EffectiveEmailDelivery,
  EmailConfigPatch,
  EmailConfigPublicView,
  EmailProvider,
} from "@/lib/email-config-types";

const CACHE_TTL_MS = 30_000;

type ResolvedEmailConfig = {
  dbPayload: EmailConfigPayload;
  updatedAt: Date | null;
  updatedByUserId: string | null;
};

let cache: ResolvedEmailConfig | null = null;
let cacheAt = 0;

function envTrim(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function coerceDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "bigint") return new Date(Number(value));
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") return new Date(value);
  return null;
}

function maskSecret(value: string | undefined, visibleTail = 4): string | null {
  if (!value) return null;
  if (value.length <= visibleTail) return "••••";
  return `••••${value.slice(-visibleTail)}`;
}

function envPayload(): EmailConfigPayload {
  const provider = envTrim("EMAIL_PROVIDER") as EmailProvider | undefined;
  const from = envTrim("EMAIL_FROM") || envTrim("SMTP_FROM") || envTrim("RESEND_FROM");
  const resendApiKey = envTrim("RESEND_API_KEY");
  const smtpHost = envTrim("SMTP_HOST");
  const smtpPortRaw = envTrim("SMTP_PORT");
  const smtpPort = smtpPortRaw ? Number(smtpPortRaw) : undefined;
  const smtpSecure =
    process.env.SMTP_SECURE === "1" || (smtpPort !== undefined && smtpPort === 465);
  const smtpUser = envTrim("SMTP_USER");
  const smtpPass = envTrim("SMTP_PASS");

  const payload: EmailConfigPayload = {};
  if (provider === "resend" || provider === "smtp") payload.provider = provider;
  else if (resendApiKey && from) payload.provider = "resend";
  else if (smtpHost && from) payload.provider = "smtp";
  if (from) payload.from = from;
  if (resendApiKey) payload.resendApiKey = resendApiKey;
  if (smtpHost) payload.smtpHost = smtpHost;
  if (smtpPort && Number.isFinite(smtpPort)) payload.smtpPort = smtpPort;
  if (smtpHost) payload.smtpSecure = smtpSecure;
  if (smtpUser) payload.smtpUser = smtpUser;
  if (smtpPass) payload.smtpPass = smtpPass;
  return payload;
}

function fieldSource(dbVal: unknown, envVal: unknown): EmailConfigSource {
  if (dbVal !== undefined && dbVal !== null && dbVal !== "") return "db";
  if (envVal !== undefined && envVal !== null && envVal !== "") return "env";
  return "none";
}

function mergeEffective(db: EmailConfigPayload, env: EmailConfigPayload): EmailConfigPayload {
  return {
    provider: db.provider ?? env.provider,
    from: db.from ?? env.from,
    resendApiKey: db.resendApiKey ?? env.resendApiKey,
    smtpHost: db.smtpHost ?? env.smtpHost,
    smtpPort: db.smtpPort ?? env.smtpPort,
    smtpSecure: db.smtpSecure ?? env.smtpSecure,
    smtpUser: db.smtpUser ?? env.smtpUser,
    smtpPass: db.smtpPass ?? env.smtpPass,
  };
}

function isDeliveryReady(payload: EmailConfigPayload): boolean {
  const from = payload.from?.trim();
  if (!from) return false;
  if (payload.provider === "resend") {
    return Boolean(payload.resendApiKey?.trim());
  }
  if (payload.provider === "smtp" || payload.smtpHost) {
    return Boolean(payload.smtpHost?.trim());
  }
  if (payload.resendApiKey) return true;
  if (payload.smtpHost) return true;
  return false;
}

function toEffective(payload: EmailConfigPayload): EffectiveEmailDelivery {
  const port = payload.smtpPort ?? 587;
  const secure = payload.smtpSecure ?? port === 465;
  let provider = payload.provider ?? null;
  if (!provider) {
    if (payload.resendApiKey) provider = "resend";
    else if (payload.smtpHost) provider = "smtp";
  }
  return {
    provider,
    from: payload.from?.trim() ?? null,
    resendApiKey: payload.resendApiKey?.trim() ?? null,
    smtpHost: payload.smtpHost?.trim() ?? null,
    smtpPort: port,
    smtpSecure: secure,
    smtpUser: payload.smtpUser?.trim() ?? null,
    smtpPass: payload.smtpPass ?? null,
    configured: isDeliveryReady(payload),
  };
}

export async function loadEmailConfig(): Promise<ResolvedEmailConfig> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache;

  let row: Awaited<ReturnType<typeof findPlatformEmailConfigRow>> = null;
  try {
    row = await findPlatformEmailConfigRow();
  } catch {
    row = null;
  }

  cache = {
    dbPayload: parseEmailConfigEnc(row?.configEnc),
    updatedAt: coerceDate(row?.updatedAt),
    updatedByUserId: row?.updatedByUserId ?? null,
  };
  cacheAt = now;
  return cache;
}

export function invalidateEmailConfigCache(): void {
  cache = null;
  cacheAt = 0;
}

export function getEffectiveEmailDelivery(): EffectiveEmailDelivery {
  const env = envPayload();
  const db = cache?.dbPayload ?? {};
  return toEffective(mergeEffective(db, env));
}

export function isEmailDeliveryConfigured(): boolean {
  return getEffectiveEmailDelivery().configured;
}

export async function getEmailConfigPublicView(): Promise<EmailConfigPublicView> {
  const resolved = await loadEmailConfig();
  const env = envPayload();
  const db = resolved.dbPayload;
  const effective = mergeEffective(db, env);

  return {
    updatedAt: resolved.updatedAt?.toISOString() ?? null,
    updatedByUserId: resolved.updatedByUserId,
    provider: effective.provider ?? null,
    from: effective.from ?? null,
    resendApiKey: maskSecret(db.resendApiKey ?? env.resendApiKey),
    smtpHost: effective.smtpHost ?? null,
    smtpPort: effective.smtpPort ?? null,
    smtpSecure: effective.smtpSecure ?? false,
    smtpUser: effective.smtpUser ?? null,
    smtpPass: maskSecret(db.smtpPass ?? env.smtpPass),
    sources: {
      provider: fieldSource(db.provider, env.provider),
      from: fieldSource(db.from, env.from),
      resendApiKey: fieldSource(db.resendApiKey, env.resendApiKey),
      smtpHost: fieldSource(db.smtpHost, env.smtpHost),
      smtpPort: fieldSource(db.smtpPort, env.smtpPort),
      smtpSecure: fieldSource(db.smtpSecure, env.smtpSecure),
      smtpUser: fieldSource(db.smtpUser, env.smtpUser),
      smtpPass: fieldSource(db.smtpPass, env.smtpPass),
    },
    configured: isDeliveryReady(effective),
  };
}

function applyPatch(current: EmailConfigPayload, patch: EmailConfigPatch): EmailConfigPayload {
  const next: EmailConfigPayload = { ...current };
  const entries: [keyof EmailConfigPatch, keyof EmailConfigPayload][] = [
    ["provider", "provider"],
    ["from", "from"],
    ["resendApiKey", "resendApiKey"],
    ["smtpHost", "smtpHost"],
    ["smtpPort", "smtpPort"],
    ["smtpSecure", "smtpSecure"],
    ["smtpUser", "smtpUser"],
    ["smtpPass", "smtpPass"],
  ];
  for (const [patchKey, payloadKey] of entries) {
    const v = patch[patchKey];
    if (v === undefined) continue;
    if (v === null || v === "") {
      delete next[payloadKey];
    } else if (patchKey === "smtpPort") {
      next.smtpPort = Number(v);
    } else if (patchKey === "smtpSecure") {
      next.smtpSecure = Boolean(v);
    } else {
      (next as Record<string, unknown>)[payloadKey] = typeof v === "string" ? v.trim() : v;
    }
  }
  return next;
}

export async function saveEmailConfig(
  patch: EmailConfigPatch,
  actorUserId?: string | null,
): Promise<EmailConfigPublicView> {
  const row = await findPlatformEmailConfigRow();
  const currentDb = parseEmailConfigEnc(row?.configEnc);
  const nextDb = applyPatch(currentDb, patch);
  const hasContent = Object.keys(nextDb).length > 0;

  if (hasContent) {
    await upsertPlatformEmailConfig({
      configEnc: encryptEmailConfigPayload(nextDb),
      updatedByUserId: actorUserId ?? null,
    });
  } else if (row) {
    await deletePlatformEmailConfig();
  }

  invalidateEmailConfigCache();
  await loadEmailConfig();
  return getEmailConfigPublicView();
}
