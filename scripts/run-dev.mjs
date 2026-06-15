/**
 * 本地开发：默认 DATABASE_URL=file:./dev.db（相对 prisma/schema），避免 QA 脚本残留 ci.sqlite。
 * 安全改进：移除 shell:true，直接调用 Node.js 执行 next CLI；确保 Ctrl+C / 关闭终端时正确终止子进程。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const rawDbUrl = process.env.DATABASE_URL?.trim();
if (rawDbUrl && /ci\.sqlite/i.test(rawDbUrl) && process.env.DEV_ALLOW_CI_DB !== "1") {
  console.warn(
    "[dev] DATABASE_URL 指向 ci.sqlite，已改为 file:./dev.db（E2E 请单独起进程；或 DEV_ALLOW_CI_DB=1）",
  );
  process.env.DATABASE_URL = "file:./dev.db";
  } else if (!rawDbUrl) {
  process.env.DATABASE_URL = "file:./dev.db";
} else if (/prisma\/dev\.db/i.test(rawDbUrl) || /prisma\/prisma\//i.test(rawDbUrl)) {
  console.warn(
    `[dev] DATABASE_URL="${rawDbUrl}" 可能指向错误路径，已改为 file:./dev.db`,
  );
  process.env.DATABASE_URL = "file:./dev.db";
}

const clientSchema = path.join(repoRoot, "node_modules", ".prisma", "client", "schema.prisma");
if (!fs.existsSync(clientSchema)) {
  console.warn(
    "[dev] Prisma Client 未生成或已损坏，请先运行: npm run ensure:dev-playable",
  );
}

const nextCli = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextCli, "dev", "-p", "8888"], {
  stdio: "inherit",
  shell: false,
  env: process.env,
  cwd: repoRoot,
});

function shutdown(signal) {
  child.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("exit", () => {
  if (!child.killed) child.kill();
});

child.on("exit", (code) => process.exit(code ?? 0));
