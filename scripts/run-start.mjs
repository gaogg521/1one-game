/**
 * 生产模式启动：默认 80（与一键部署一致）；本地 dev 仍为 8888。
 * 使用 programmatic server，绕过 `next start` CLI 对部分保留端口的拦截。
 */
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number.parseInt(process.env.PORT?.trim() || "80", 10);
const hostname = process.env.HOSTNAME?.trim() || "0.0.0.0";

if (!Number.isFinite(port) || port < 1 || port > 65535) {
  console.error(`[run-start] 无效 PORT: ${process.env.PORT}`);
  process.exit(1);
}

process.env.PORT = String(port);
process.chdir(root);

const app = next({ dev: false, dir: root, hostname, port });
const handle = app.getRequestHandler();

try {
  await app.prepare();
} catch (err) {
  console.error("[run-start] Next.js prepare 失败:", err);
  process.exit(1);
}

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error("[run-start] 请求处理失败:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });
});

server.on("error", (err) => {
  console.error("[run-start] HTTP 服务启动失败:", err.message);
  process.exit(1);
});

server.listen(port, hostname, () => {
  console.log(`> Operone ready on http://${hostname}:${port}`);
});

function shutdown(signal) {
  console.log(`[run-start] 收到 ${signal}，正在关闭…`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
