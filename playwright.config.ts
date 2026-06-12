import { defineConfig, devices } from "@playwright/test";

const useProdServer = process.env.PW_START === "1";
/** 由脚本先起好 `npm run start` 时设为 1，避免 webServer 在 Windows 上长时间无输出被误杀 */
const useExternalServer = process.env.PW_EXTERNAL === "1";

const serverEnv = {
  ...process.env,
  PORT: "8888",
  DATABASE_URL: process.env.DATABASE_URL ?? "file:./ci.sqlite",
  E2E_REFINE_STUB: process.env.E2E_REFINE_STUB ?? "1",
  E2E_AGENTIC_FALLBACK_ONLY: process.env.E2E_AGENTIC_FALLBACK_ONLY ?? "1",
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
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
        env: serverEnv,
      };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8888",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(webServer ? { webServer } : {}),
});
