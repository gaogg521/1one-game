import { defineConfig, devices } from "@playwright/test";

const useProdServer = process.env.PW_START === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8888",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: useProdServer
    ? {
        command: "npm run start",
        url: "http://127.0.0.1:8888",
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          ...process.env,
          PORT: "8888",
          DATABASE_URL: process.env.DATABASE_URL ?? "file:./ci.sqlite",
        },
      }
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:8888",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
