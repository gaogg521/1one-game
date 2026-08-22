import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * E2E 启动前确保测试库 schema 最新（含 PlatformRuntimeConfig 等迁移）。
 */
export default async function globalSetup() {
  const dbUrl =
    process.env.CI && process.env.DATABASE_URL?.trim()
      ? process.env.DATABASE_URL.trim()
      : "file:./prisma/ci.sqlite";
  // Do not depend on the Windows npm .bin shim: a concurrent dependency
  // repair can briefly remove that shim while Prisma itself remains present.
  const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
}
