/**
 * 生产重启：无 .next 构建时先 build，再 next start @ 8888
 */
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: true, env: process.env, cwd: process.cwd() });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

const buildId = join(process.cwd(), ".next", "BUILD_ID");
if (!existsSync(buildId)) {
  console.log("[restart:prod] 未找到生产构建，正在执行 npm run build …");
  await run("npm", ["run", "build"]);
}

console.log("[restart:prod] 启动生产服务 http://localhost:8888");
await run("node", ["scripts/run-start.mjs"]);
