import { defineConfig, devices } from "@playwright/test";

const useProdServer = process.env.PW_START === "1";
/** CI bundle-e2e：排除 platform-user-journey（独立步骤跑）与 godot 矩阵 */
const bundleE2e = process.env.PW_BUNDLE_E2E === "1";
/** 由脚本先起好 `npm run start` 时设为 1，避免 webServer 在 Windows 上长时间无输出被误杀 */
const useExternalServer = process.env.PW_EXTERNAL === "1";

/** E2E 专用库（本地固定 prisma/ci.sqlite；CI 与 job env DATABASE_URL 对齐） */
const e2eDatabaseUrl =
  process.env.CI && process.env.DATABASE_URL?.trim()
    ? process.env.DATABASE_URL.trim()
    : "file:./prisma/ci.sqlite";

const serverEnv = {
  ...process.env,
  PORT: "8888",
  DATABASE_URL: e2eDatabaseUrl,
  E2E_REFINE_STUB: process.env.E2E_REFINE_STUB ?? "1",
  E2E_AGENTIC_FALLBACK_ONLY: process.env.E2E_AGENTIC_FALLBACK_ONLY ?? "1",
  /** admin-runtime-config E2E：与 e2e/admin-runtime-config.smoke.spec.ts 默认密钥一致 */
  SUPER_ADMIN_SECRET: process.env.SUPER_ADMIN_SECRET ?? "e2e-super-admin-secret",
  RUNTIME_CONFIG_SECRET: process.env.RUNTIME_CONFIG_SECRET ?? "e2e-runtime-config-secret",
  /** Console SSO stub E2E（e2e/admin-console-sso.smoke.spec.ts） */
  ADMIN_CONSOLE_OIDC_STUB: process.env.ADMIN_CONSOLE_OIDC_STUB ?? "1",
  ADMIN_CONSOLE_OIDC_STUB_EMAIL: process.env.ADMIN_CONSOLE_OIDC_STUB_EMAIL ?? "console-sso-e2e@example.com",
  E2E_CONSOLE_SSO_STUB: process.env.E2E_CONSOLE_SSO_STUB ?? "1",
};

const webServer = useExternalServer
  ? undefined
  : useProdServer
    ? {
        command: "npm run start",
        url: "http://127.0.0.1:8888",
        reuseExistingServer: true,
        timeout: 300_000,
        env: serverEnv,
      }
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:8888",
        reuseExistingServer: process.env.PW_REUSE_SERVER === "1" && !process.env.CI,
        timeout: 300_000,
        env: serverEnv,
      };

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  testIgnore: bundleE2e ? [/platform-user-journey.*\.spec\.ts/, /godot-.*\.spec\.ts/i] : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 90_000,
  workers: process.env.PW_EXTERNAL === "1" ? 4 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8888",
    trace: "on-first-retry",
    navigationTimeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(webServer ? { webServer } : {}),
});
