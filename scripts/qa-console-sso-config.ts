/**
 * 控制台 SSO 生产配置校验（离线）
 * npm run qa:console-sso-config
 */
import assert from "node:assert/strict";
import {
  buildConsoleSsoAuthorizeUrl,
  isConsoleSsoEnabled,
  isConsoleSsoStubMode,
  resolveConsoleOidcEndpoints,
  resolveConsoleSsoRole,
} from "../src/lib/auth/console-sso.ts";

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

withEnv(
  {
    ADMIN_CONSOLE_OIDC_STUB: undefined,
    ADMIN_CONSOLE_OIDC_ISSUER: "https://login.microsoftonline.com/tenant-id/v2.0",
    ADMIN_CONSOLE_OIDC_CLIENT_ID: "azure-client",
    ADMIN_CONSOLE_OIDC_AUTHORIZE_URL: undefined,
    ADMIN_CONSOLE_OIDC_TOKEN_URL: undefined,
  },
  () => {
    assert.equal(isConsoleSsoStubMode(), false);
    assert.equal(isConsoleSsoEnabled(), true);
    const ep = resolveConsoleOidcEndpoints();
    assert.ok(ep);
    assert.equal(
      ep!.authorize,
      "https://login.microsoftonline.com/tenant-id/oauth2/v2.0/authorize",
    );
    assert.equal(ep!.token, "https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token");
    const url = buildConsoleSsoAuthorizeUrl("https://ops.example.com", "state123");
    assert.match(url, /oauth2\/v2\.0\/authorize/);
    assert.match(url, /client_id=azure-client/);
    assert.match(url, /redirect_uri=/);
  },
);

withEnv(
  {
    ADMIN_CONSOLE_OIDC_STUB: undefined,
    ADMIN_CONSOLE_OIDC_ISSUER: "https://passport.feishu.cn/suite/passport/oauth",
    ADMIN_CONSOLE_OIDC_CLIENT_ID: "feishu-client",
    ADMIN_CONSOLE_OIDC_AUTHORIZE_URL: undefined,
    ADMIN_CONSOLE_OIDC_TOKEN_URL: undefined,
  },
  () => {
    const ep = resolveConsoleOidcEndpoints();
    assert.ok(ep);
    assert.equal(ep!.authorize, "https://passport.feishu.cn/suite/passport/oauth/authorize");
    assert.equal(ep!.token, "https://passport.feishu.cn/suite/passport/oauth/token");
  },
);

withEnv(
  {
    ADMIN_CONSOLE_OIDC_STUB: undefined,
    ADMIN_CONSOLE_OIDC_ISSUER: "https://passport.feishu.cn/suite/passport/oauth",
    ADMIN_CONSOLE_OIDC_CLIENT_ID: "feishu-client",
    ADMIN_CONSOLE_OIDC_AUTHORIZE_URL: "https://passport.feishu.cn/suite/passport/oauth/authorize",
    ADMIN_CONSOLE_OIDC_TOKEN_URL: "https://passport.feishu.cn/suite/passport/oauth/token",
  },
  () => {
    const ep = resolveConsoleOidcEndpoints();
    assert.ok(ep);
    assert.equal(ep!.authorize, "https://passport.feishu.cn/suite/passport/oauth/authorize");
    assert.equal(ep!.token, "https://passport.feishu.cn/suite/passport/oauth/token");
  },
);

withEnv(
  {
    ADMIN_CONSOLE_OIDC_STUB: "1",
    ADMIN_CONSOLE_OIDC_STUB_EMAIL: "ops@corp.com",
    ADMIN_CONSOLE_OIDC_SUPER_ADMIN_EMAILS: "ops@corp.com",
  },
  () => {
    assert.equal(isConsoleSsoStubMode(), true);
    assert.equal(
      resolveConsoleSsoRole({
        providerUserId: "x",
        email: "ops@corp.com",
        groups: [],
      }),
      "super_admin",
    );
  },
);

console.log("[OK] qa-console-sso-config");
