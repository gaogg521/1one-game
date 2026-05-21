/**
 * 生产模式启动：固定 8888，与 dev / Playwright / 手测脚本一致。
 */
import { spawn } from "node:child_process";

const port = process.env.PORT?.trim() || "8888";
process.env.PORT = port;

const child = spawn("npx", ["next", "start", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: process.env,
  cwd: process.cwd(),
});

child.on("exit", (code) => process.exit(code ?? 0));
