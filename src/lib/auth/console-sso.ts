import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { UserRole } from "@/lib/auth/types";

export const CONSOLE_SSO_STATE_COOKIE = "gcreator_console_sso_state";
export const CONSOLE_SSO_COOKIE = "gcreator_console_sso";

export type ConsoleSsoProfile = {
  providerUserId: string;
  email: string;
  displayName?: string;
  groups?: string[];
};

function trimEnv(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

export function isConsoleSsoStubMode(): boolean {
  return trimEnv("ADMIN_CONSOLE_OIDC_STUB") === "1" || trimEnv("E2E_CONSOLE_SSO_STUB") === "1";
}

/** 配置了 stub 或完整 OIDC issuer + client 时启用控制台 SSO */
export function isConsoleSsoEnabled(): boolean {
  if (isConsoleSsoStubMode()) return true;
  return Boolean(trimEnv("ADMIN_CONSOLE_OIDC_ISSUER") && trimEnv("ADMIN_CONSOLE_OIDC_CLIENT_ID"));
}

export function shouldSkip2faWhenSso(): boolean {
  return trimEnv("ADMIN_CONSOLE_2FA_SKIP_WHEN_SSO") === "1";
}

export function mintConsoleSsoMarker(userId: string): string {
  const secret =
    trimEnv("SUPER_ADMIN_SECRET") ??
    trimEnv("ADMIN_CONSOLE_OIDC_CLIENT_SECRET") ??
    "console-sso-dev";
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const payload = `${userId}:${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function validateConsoleSsoMarker(token: string, userId: string): boolean {
  const secret =
    trimEnv("SUPER_ADMIN_SECRET") ??
    trimEnv("ADMIN_CONSOLE_OIDC_CLIENT_SECRET") ??
    "console-sso-dev";
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [uid, expRaw, sig] = decoded.split(":");
    if (!uid || !expRaw || !sig || uid !== userId) return false;
    const exp = Number.parseInt(expRaw, 10);
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    const payload = `${uid}:${expRaw}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    if (sig.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function consoleSsoCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/admin/console/sso/callback`;
}

/** Azure AD / 通用 OIDC 端点；可用 ADMIN_CONSOLE_OIDC_*_URL 覆盖 */
export function resolveConsoleOidcEndpoints(): {
  issuer: string;
  authorize: string;
  token: string;
} | null {
  if (isConsoleSsoStubMode()) return null;
  const issuer = trimEnv("ADMIN_CONSOLE_OIDC_ISSUER")?.replace(/\/$/, "");
  if (!issuer) return null;

  const overrideAuth = trimEnv("ADMIN_CONSOLE_OIDC_AUTHORIZE_URL");
  const overrideToken = trimEnv("ADMIN_CONSOLE_OIDC_TOKEN_URL");
  if (overrideAuth && overrideToken) {
    return { issuer, authorize: overrideAuth, token: overrideToken };
  }

  if (/login\.microsoftonline\.com/i.test(issuer)) {
    const tenantBase = issuer.replace(/\/v2\.0$/i, "");
    return {
      issuer,
      authorize: `${tenantBase}/oauth2/v2.0/authorize`,
      token: `${tenantBase}/oauth2/v2.0/token`,
    };
  }

  if (/passport\.(feishu|larkoffice)\.cn/i.test(issuer) || /open\.feishu\.cn/i.test(issuer)) {
    const base = issuer.replace(/\/$/, "");
    return {
      issuer: base,
      authorize: `${base}/authorize`,
      token: `${base}/token`,
    };
  }

  return { issuer, authorize: `${issuer}/authorize`, token: `${issuer}/token` };
}

export function mintConsoleSsoState(nextPath: string): string {
  const nonce = randomBytes(16).toString("hex");
  const exp = Date.now() + 10 * 60 * 1000;
  const secret =
    trimEnv("SUPER_ADMIN_SECRET") ??
    trimEnv("ADMIN_CONSOLE_OIDC_CLIENT_SECRET") ??
    "console-sso-dev";
  const payload = `${nextPath}:${exp}:${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function validateConsoleSsoState(state: string): { ok: true; nextPath: string } | { ok: false } {
  const secret =
    trimEnv("SUPER_ADMIN_SECRET") ??
    trimEnv("ADMIN_CONSOLE_OIDC_CLIENT_SECRET") ??
    "console-sso-dev";
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon <= 0) return { ok: false };
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    if (sig.length !== expected.length) return { ok: false };
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return { ok: false };
    const [nextPath, expRaw] = payload.split(":");
    const exp = Number.parseInt(expRaw ?? "", 10);
    if (!nextPath?.startsWith("/") || !Number.isFinite(exp) || exp < Date.now()) return { ok: false };
    return { ok: true, nextPath };
  } catch {
    return { ok: false };
  }
}

export function buildConsoleSsoAuthorizeUrl(origin: string, state: string): string {
  if (isConsoleSsoStubMode()) {
    const callback = consoleSsoCallbackUrl(origin);
    return `${callback}?code=stub&state=${encodeURIComponent(state)}`;
  }
  const endpoints = resolveConsoleOidcEndpoints();
  if (!endpoints) throw new Error("console_sso_not_configured");
  const clientId = trimEnv("ADMIN_CONSOLE_OIDC_CLIENT_ID")!;
  const redirectUri = consoleSsoCallbackUrl(origin);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "openid profile email",
    redirect_uri: redirectUri,
    state,
  });
  return `${endpoints.authorize}?${params.toString()}`;
}

function parseJwtPayload(idToken: string): Record<string, unknown> {
  const part = idToken.split(".")[1];
  if (!part) throw new Error("invalid id_token");
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

export function resolveConsoleSsoRole(profile: ConsoleSsoProfile): UserRole | null {
  const superEmails = (trimEnv("ADMIN_CONSOLE_OIDC_SUPER_ADMIN_EMAILS") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const adminEmails = (trimEnv("ADMIN_CONSOLE_OIDC_ADMIN_EMAILS") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const email = profile.email.toLowerCase();
  if (superEmails.includes(email)) return "super_admin";
  if (adminEmails.includes(email)) return "admin";

  const roleClaim = trimEnv("ADMIN_CONSOLE_OIDC_ROLE_CLAIM") ?? "groups";
  const superGroups = (trimEnv("ADMIN_CONSOLE_OIDC_SUPER_ADMIN_GROUPS") ?? "super_admin")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const adminGroups = (trimEnv("ADMIN_CONSOLE_OIDC_ADMIN_GROUPS") ?? "admin,console_admin")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const groups = profile.groups ?? [];
  if (groups.some((g) => superGroups.includes(g))) return "super_admin";
  if (groups.some((g) => adminGroups.includes(g))) return "admin";

  const domain = trimEnv("ADMIN_CONSOLE_OIDC_ALLOWED_EMAIL_DOMAIN");
  if (domain && email.endsWith(`@${domain.toLowerCase()}`)) {
    return trimEnv("ADMIN_CONSOLE_OIDC_DOMAIN_DEFAULT_ROLE") === "super_admin" ? "super_admin" : "admin";
  }
  return null;
}

export function assertConsoleSsoEmailAllowed(email: string): boolean {
  const domain = trimEnv("ADMIN_CONSOLE_OIDC_ALLOWED_EMAIL_DOMAIN");
  if (!domain) return true;
  return email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

export async function exchangeConsoleSsoCode(
  code: string,
  origin: string,
): Promise<ConsoleSsoProfile> {
  if (isConsoleSsoStubMode()) {
    if (code !== "stub") throw new Error("invalid_stub_code");
    const email = trimEnv("ADMIN_CONSOLE_OIDC_STUB_EMAIL") ?? "console-sso-stub@example.com";
    const role = trimEnv("ADMIN_CONSOLE_OIDC_STUB_ROLE") ?? "admin";
    return {
      providerUserId: `stub:${email}`,
      email,
      displayName: "Console SSO Stub",
      groups: role === "super_admin" ? ["super_admin"] : ["admin"],
    };
  }

  const endpoints = resolveConsoleOidcEndpoints();
  if (!endpoints) throw new Error("console_sso_not_configured");
  const clientId = trimEnv("ADMIN_CONSOLE_OIDC_CLIENT_ID")!;
  const clientSecret = trimEnv("ADMIN_CONSOLE_OIDC_CLIENT_SECRET") ?? "";
  const redirectUri = consoleSsoCallbackUrl(origin);
  const tokenRes = await fetch(endpoints.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => "");
    throw new Error(`oidc_token_${tokenRes.status}:${detail.slice(0, 200)}`);
  }
  const tokens = (await tokenRes.json()) as { id_token?: string; access_token?: string };
  if (!tokens.id_token) throw new Error("oidc_missing_id_token");
  const payload = parseJwtPayload(tokens.id_token);
  const email = String(payload.email ?? payload.preferred_username ?? "").trim();
  if (!email) throw new Error("oidc_missing_email");
  const roleClaim = trimEnv("ADMIN_CONSOLE_OIDC_ROLE_CLAIM") ?? "groups";
  const rawGroups = payload[roleClaim];
  const groups = Array.isArray(rawGroups)
    ? rawGroups.map(String)
    : typeof rawGroups === "string"
      ? rawGroups.split(",").map((s) => s.trim())
      : [];
  return {
    providerUserId: String(payload.sub ?? email),
    email,
    displayName: typeof payload.name === "string" ? payload.name : undefined,
    groups,
  };
}
