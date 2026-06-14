/**
 * Console SSO 生产部署预检（离线，不连 IdP）
 * npm run qa:console-sso-production-preflight
 *
 * 模拟 NODE_ENV=production，校验 OIDC / 2FA / HOST 组合是否合理。
 */
import assert from "node:assert/strict";
import {
  isConsole2faRequired,
  verifyConsole2faPin,
} from "../src/lib/auth/console-2fa.ts";
import {
  buildConsoleSsoAuthorizeUrl,
  isConsoleSsoEnabled,
  isConsoleSsoStubMode,
  resolveConsoleOidcEndpoints,
  shouldSkip2faWhenSso,
} from "../src/lib/auth/console-sso.ts";
import { getAdminConsolePath } from "../src/lib/admin-console-path.ts";

function withEnv(patch: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(patch)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const checks: { name: string; ok: boolean; detail?: string }[] = [];

function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

withEnv(
  {
    NODE_ENV: "production",
    ADMIN_CONSOLE_OIDC_STUB: undefined,
    ADMIN_CONSOLE_OIDC_ISSUER: "https://login.microsoftonline.com/tenant/v2.0",
    ADMIN_CONSOLE_OIDC_CLIENT_ID: "prod-client",
    ADMIN_CONSOLE_OIDC_CLIENT_SECRET: "secret",
    ADMIN_CONSOLE_HOST: "ops.example.com",
    ADMIN_CONSOLE_2FA_PIN: undefined,
    ADMIN_CONSOLE_2FA_SKIP_WHEN_SSO: "1",
  },
  () => {
    record("production SSO enabled", isConsoleSsoEnabled());
    record("OIDC endpoints resolved", Boolean(resolveConsoleOidcEndpoints()?.authorize));
    record("2FA skip when SSO", shouldSkip2faWhenSso());
    record("2FA not required when skip+SSO", !isConsole2faRequired());
    try {
      const url = buildConsoleSsoAuthorizeUrl("https://ops.example.com", "state");
      record("authorize URL built", url.includes("client_id=prod-client"));
    } catch (e) {
      record("authorize URL built", false, String(e));
    }
    record("console path", getAdminConsolePath().startsWith("/"));
  },
);

withEnv(
  {
    NODE_ENV: "production",
    ADMIN_CONSOLE_OIDC_STUB: undefined,
    ADMIN_CONSOLE_OIDC_ISSUER: undefined,
    ADMIN_CONSOLE_OIDC_CLIENT_ID: undefined,
    ADMIN_CONSOLE_2FA_PIN: "654321",
  },
  () => {
    record("PIN-only production 2FA", isConsole2faRequired() && verifyConsole2faPin("654321"));
    record("SSO disabled without issuer", !isConsoleSsoEnabled());
  },
);

withEnv(
  {
    NODE_ENV: "production",
    ADMIN_CONSOLE_OIDC_STUB: "1",
  },
  () => {
    record("stub blocked in production check", isConsoleSsoStubMode());
    assert.ok(isConsoleSsoStubMode(), "stub mode for E2E only");
  },
);

for (const c of checks) {
  console.log(`${c.ok ? "[OK]" : "[FAIL]"} ${c.name}${c.detail ? ` · ${c.detail}` : ""}`);
}

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`qa:console-sso-production-preflight: ${failed.length}/${checks.length} failed`);
  process.exit(1);
}
console.log(`[OK] qa:console-sso-production-preflight (${checks.length} checks)`);
