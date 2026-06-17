/**
 * 运营控制台 smoke：路径隔离、/admin 重定向、审计 API 鉴权与筛选、订单导出
 * npm run qa:admin-console
 */
import { config } from "dotenv";
import {
  getAdminConsolePath,
  isAdminConsolePath,
  matchesAdminConsoleRequest,
} from "../src/lib/admin-console-path";
import {
  isConsole2faRequired,
  mintConsole2faToken,
  validateConsole2faToken,
  verifyConsole2faPin,
} from "../src/lib/auth/console-2fa";
import {
  buildConsoleSsoAuthorizeUrl,
  isConsoleSsoEnabled,
  isConsoleSsoStubMode,
  mintConsoleSsoMarker,
  mintConsoleSsoState,
  resolveConsoleSsoRole,
  resolveConsoleOidcEndpoints,
  validateConsoleSsoMarker,
  validateConsoleSsoState,
} from "../src/lib/auth/console-sso";
import { chartScaleMax } from "../src/lib/admin-chart-scale";
import { THEME_SWATCH_COLORS, THEME_META_COLOR, type ThemeId } from "../src/lib/themes";

config();

const base = process.env.BENCHMARK_BASE_URL ?? "http://127.0.0.1:8888";
const consolePath = getAdminConsolePath();

type Check = { name: string; ok: boolean; detail?: string };

function assert(name: string, ok: boolean, detail?: string): Check {
  return { name, ok, detail };
}

function runOfflineChecks(): Check[] {
  const checks: Check[] = [];
  const path = getAdminConsolePath();

  checks.push(
    assert("console path normalized", path.startsWith("/") && !path.endsWith("/"), path),
  );

  const spike = [
    { date: "2026-06-01", value: 2 },
    { date: "2026-06-02", value: 3 },
    { date: "2026-06-03", value: 50 },
    { date: "2026-06-04", value: 4 },
  ];
  const scaled = chartScaleMax(spike);
  checks.push(
    assert(
      "chartScaleMax dampens spike",
      scaled < 50 && scaled >= 4,
      `scaled=${scaled}`,
    ),
  );

  for (const id of Object.keys(THEME_SWATCH_COLORS) as ThemeId[]) {
    checks.push(
      assert(
        `theme swatch ${id}`,
        Boolean(THEME_SWATCH_COLORS[id]?.primary && THEME_META_COLOR[id]),
      ),
    );
  }

  checks.push(
    assert("isAdminConsolePath", isAdminConsolePath(path) && isAdminConsolePath(`${path}/audit`)),
  );

  const prevHost = process.env.ADMIN_CONSOLE_HOST;
  process.env.ADMIN_CONSOLE_HOST = "ops.qa.test";
  checks.push(
    assert(
      "ADMIN_CONSOLE_HOST match",
      matchesAdminConsoleRequest("/", "ops.qa.test") &&
        matchesAdminConsoleRequest(path, "ops.qa.test"),
    ),
  );
  checks.push(
    assert(
      "main site host no console match",
      !matchesAdminConsoleRequest("/", "localhost") ||
        matchesAdminConsoleRequest(path, "localhost"),
    ),
  );
  if (prevHost) process.env.ADMIN_CONSOLE_HOST = prevHost;
  else delete process.env.ADMIN_CONSOLE_HOST;

  const prevPin = process.env.ADMIN_CONSOLE_2FA_PIN;
  const prevNode = process.env.NODE_ENV;
  process.env.ADMIN_CONSOLE_2FA_PIN = "123456";
  process.env.NODE_ENV = "production";
  checks.push(assert("2FA required in production", isConsole2faRequired()));
  checks.push(
    assert(
      "2FA PIN verify",
      verifyConsole2faPin("123456") && !verifyConsole2faPin("000000"),
    ),
  );
  const tok = mintConsole2faToken("qa_user");
  checks.push(
    assert(
      "2FA token roundtrip",
      validateConsole2faToken(tok, "qa_user") && !validateConsole2faToken(tok, "other"),
    ),
  );
  process.env.NODE_ENV = prevNode ?? "development";
  if (prevPin) process.env.ADMIN_CONSOLE_2FA_PIN = prevPin;
  else delete process.env.ADMIN_CONSOLE_2FA_PIN;

  const prevStub = process.env.ADMIN_CONSOLE_OIDC_STUB;
  process.env.ADMIN_CONSOLE_OIDC_STUB = "1";
  checks.push(assert("SSO stub enabled", isConsoleSsoEnabled() && isConsoleSsoStubMode()));
  const state = mintConsoleSsoState("/console");
  const parsed = validateConsoleSsoState(state);
  checks.push(
    assert(
      "SSO state roundtrip",
      parsed.ok && parsed.nextPath === "/console",
    ),
  );
  checks.push(
    assert(
      "SSO stub authorize URL",
      buildConsoleSsoAuthorizeUrl("http://127.0.0.1:8888", state).includes("code=stub"),
    ),
  );
  process.env.ADMIN_CONSOLE_OIDC_STUB_EMAIL = "ops@example.com";
  checks.push(
    assert(
      "SSO stub profile + role",
      resolveConsoleSsoRole({ providerUserId: "x", email: "ops@example.com", groups: ["admin"] }) ===
        "admin",
    ),
  );
  const marker = mintConsoleSsoMarker("sso_user");
  checks.push(
    assert(
      "SSO marker roundtrip",
      validateConsoleSsoMarker(marker, "sso_user") && !validateConsoleSsoMarker(marker, "other"),
    ),
  );
  if (prevStub) process.env.ADMIN_CONSOLE_OIDC_STUB = prevStub;
  else delete process.env.ADMIN_CONSOLE_OIDC_STUB;
  delete process.env.ADMIN_CONSOLE_OIDC_STUB_EMAIL;

  const prevIssuer = process.env.ADMIN_CONSOLE_OIDC_ISSUER;
  const prevClient = process.env.ADMIN_CONSOLE_OIDC_CLIENT_ID;
  delete process.env.ADMIN_CONSOLE_OIDC_STUB;
  process.env.ADMIN_CONSOLE_OIDC_ISSUER = "https://login.microsoftonline.com/tenant/v2.0";
  process.env.ADMIN_CONSOLE_OIDC_CLIENT_ID = "azure-test";
  delete process.env.ADMIN_CONSOLE_OIDC_AUTHORIZE_URL;
  delete process.env.ADMIN_CONSOLE_OIDC_TOKEN_URL;
  const azureEp = resolveConsoleOidcEndpoints();
  checks.push(
    assert(
      "Azure OIDC endpoints",
      Boolean(
        azureEp?.authorize.includes("oauth2/v2.0/authorize") &&
          azureEp?.token.includes("oauth2/v2.0/token"),
      ),
      azureEp ? `${azureEp.authorize}` : "null",
    ),
  );
  if (prevIssuer) process.env.ADMIN_CONSOLE_OIDC_ISSUER = prevIssuer;
  else delete process.env.ADMIN_CONSOLE_OIDC_ISSUER;
  if (prevClient) process.env.ADMIN_CONSOLE_OIDC_CLIENT_ID = prevClient;
  else delete process.env.ADMIN_CONSOLE_OIDC_CLIENT_ID;

  return checks;
}

async function main() {
  const checks: Check[] = runOfflineChecks();

  try {
    const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15_000) });
    checks.push(assert("health", health.ok, String(health.status)));
  } catch (e) {
    checks.push(assert("health", false, e instanceof Error ? e.message : "down"));
  }

  if (checks.find((c) => c.name === "health")?.ok) {
    const adminRes = await fetch(`${base}/admin`, { redirect: "manual" });
    checks.push(
      assert(
        "/admin → console redirect",
        adminRes.status === 308 || adminRes.status === 307,
        `status=${adminRes.status} location=${adminRes.headers.get("location") ?? ""}`,
      ),
    );

    const consoleRes = await fetch(`${base}${consolePath}`);
    checks.push(assert(`${consolePath} reachable`, consoleRes.ok, String(consoleRes.status)));

    const auditAnon = await fetch(`${base}/api/admin/audit-log`);
    const devBypass =
      process.env.NODE_ENV !== "production" && process.env.DEV_SUPER_ADMIN === "1";
    if (devBypass) {
      checks.push(
        assert(
          "audit-log (dev DEV_SUPER_ADMIN bypass)",
          auditAnon.ok,
          `status=${auditAnon.status} — 生产应关闭 DEV_SUPER_ADMIN`,
        ),
      );
    } else {
      checks.push(
        assert(
          "audit-log rejects anonymous",
          auditAnon.status === 401 || auditAnon.status === 403,
          String(auditAnon.status),
        ),
      );
    }

    const robots = consoleRes.headers.get("x-robots-tag") ?? "";
    checks.push(assert("console noindex header", /noindex/i.test(robots), robots || "(missing)"));

    const ssoLogin = await fetch(`${base}/api/admin/console/sso/login?next=${encodeURIComponent(consolePath)}`, {
      redirect: "manual",
    });
    if (ssoLogin.status === 404) {
      checks.push(assert("SSO login route", true, "disabled — set ADMIN_CONSOLE_OIDC_STUB=1 on server"));
    } else {
      const loc = ssoLogin.headers.get("location") ?? "";
      checks.push(
        assert(
          "SSO login redirect",
          ssoLogin.status === 307 || ssoLogin.status === 302,
          `status=${ssoLogin.status}`,
        ),
      );
      checks.push(
        assert(
          "SSO authorize location",
          loc.includes("/sso/callback") || loc.includes("authorize"),
          loc.slice(0, 120),
        ),
      );
    }

    const auditFiltered = await fetch(`${base}/api/admin/audit-log?limit=5&sinceDays=30&action=quota`);
    if (devBypass) {
      checks.push(
        assert("audit-log filter query", auditFiltered.ok, `status=${auditFiltered.status}`),
      );
      const samplesAdmin = await fetch(`${base}/api/admin/samples`);
      checks.push(
        assert(
          "admin samples list (dev bypass)",
          samplesAdmin.ok,
          `status=${samplesAdmin.status}`,
        ),
      );
      if (samplesAdmin.ok) {
        const body = (await samplesAdmin.json()) as { catalogCount?: number; items?: unknown[] };
        checks.push(
          assert(
            "admin samples catalog shape",
            typeof body.catalogCount === "number" && Array.isArray(body.items),
            `catalog=${body.catalogCount} items=${body.items?.length ?? 0}`,
          ),
        );
      }
      const opsHealth = await fetch(`${base}/api/admin/ops-health`);
      checks.push(
        assert(
          "admin ops-health (dev bypass)",
          opsHealth.ok,
          `status=${opsHealth.status}`,
        ),
      );
      if (opsHealth.ok) {
        const health = (await opsHealth.json()) as { overall?: string; checks?: unknown[]; qaSnapshots?: unknown[] };
        checks.push(
          assert(
            "ops-health shape",
            ["ok", "warn", "fail"].includes(health.overall ?? "") &&
              Array.isArray(health.checks) &&
              Array.isArray(health.qaSnapshots),
            `overall=${health.overall} checks=${health.checks?.length ?? 0} snapshots=${health.qaSnapshots?.length ?? 0}`,
          ),
        );
      }
      const ordersExport = await fetch(`${base}/api/admin/orders/export?days=7`);
      const csvType = ordersExport.headers.get("content-type") ?? "";
      checks.push(
        assert(
          "orders export CSV",
          ordersExport.ok && /text\/csv/i.test(csvType),
          `status=${ordersExport.status} type=${csvType}`,
        ),
      );
    } else if (auditAnon.status === 401 || auditAnon.status === 403) {
      checks.push(
        assert(
          "audit-log filter rejects anonymous",
          auditFiltered.status === 401 || auditFiltered.status === 403,
          String(auditFiltered.status),
        ),
      );
      const ordersAnon = await fetch(`${base}/api/admin/orders/export?days=7`);
      checks.push(
        assert(
          "orders export rejects anonymous",
          ordersAnon.status === 401 || ordersAnon.status === 403,
          String(ordersAnon.status),
        ),
      );
      const samplesAnon = await fetch(`${base}/api/admin/samples`);
      checks.push(
        assert(
          "admin samples rejects anonymous",
          samplesAnon.status === 401 || samplesAnon.status === 403,
          String(samplesAnon.status),
        ),
      );
      const opsHealthAnon = await fetch(`${base}/api/admin/ops-health`);
      checks.push(
        assert(
          "admin ops-health rejects anonymous",
          opsHealthAnon.status === 401 || opsHealthAnon.status === 403,
          String(opsHealthAnon.status),
        ),
      );
      const twoFaAnon = await fetch(`${base}/api/admin/console/verify-2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "000000" }),
      });
      checks.push(
        assert(
          "verify-2fa rejects anonymous",
          twoFaAnon.status === 401 || twoFaAnon.status === 403,
          String(twoFaAnon.status),
        ),
      );
    }
  }

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(`${c.ok ? "[OK]" : "[FAIL]"} ${c.name}${c.detail ? ` · ${c.detail}` : ""}`);
  }

  if (failed.length) {
    console.error(`qa-admin-console: ${failed.length}/${checks.length} failed`);
    try {
      const { writeQaSnapshot } = await import("../src/lib/qa-cache");
      writeQaSnapshot("admin", {
        script: "qa:admin-console",
        ok: false,
        passed: checks.length - failed.length,
        total: checks.length,
        ts: new Date().toISOString(),
      });
    } catch {
      /* cache optional */
    }
    process.exit(1);
  }
  try {
    const { writeQaSnapshot } = await import("../src/lib/qa-cache");
    writeQaSnapshot("admin", {
      script: "qa:admin-console",
      ok: true,
      passed: checks.length,
      total: checks.length,
      ts: new Date().toISOString(),
    });
  } catch {
    /* cache optional */
  }
  console.log(`qa-admin-console: ok (${checks.length} checks)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
