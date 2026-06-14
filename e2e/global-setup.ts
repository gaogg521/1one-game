import { execSync } from "node:child_process";

/**
 * E2E 启动前确保测试库 schema 最新（含 PlatformRuntimeConfig 等迁移）。
 */
export default async function globalSetup() {
  const dbUrl =
    process.env.CI && process.env.DATABASE_URL?.trim()
      ? process.env.DATABASE_URL.trim()
      : "file:./prisma/ci.sqlite";
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
}
