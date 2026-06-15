/**
 * 生产模式启动：默认 6666（与一键部署一致）；本地 dev 仍为 8888。
 * 端口由环境变量 PORT 或 .env 中的 PORT 覆盖。
 */
import { spawn } from "node:child_process";

const port = process.env.PORT?.trim() || "6666";
process.env.PORT = port;

const child = spawn("npx", ["next", "start", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: process.env,
  cwd: process.cwd(),
});

child.on("exit", (code) => process.exit(code ?? 0));
