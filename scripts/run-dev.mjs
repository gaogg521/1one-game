/**
 * 本地开发：默认 DATABASE_URL=file:./dev.db（相对 prisma/schema），避免 QA 脚本残留 ci.sqlite。
 */
import { spawn } from "node:child_process";

if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const child = spawn("npx", ["next", "dev", "-p", "8888"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
  cwd: process.cwd(),
});

child.on("exit", (code) => process.exit(code ?? 0));
