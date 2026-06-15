/**
 * 用户名注册/登录 API 冒烟测试
 * 用法：服务已启动后 `tsx scripts/qa-username-auth.ts`
 * 环境：AUTH_TEST_BASE_URL（默认 http://127.0.0.1:8888）
 */
import { randomBytes } from "node:crypto";
import http from "node:http";
import https from "node:https";

const BASE = process.env.AUTH_TEST_BASE_URL ?? "http://127.0.0.1:8888";

function randUser() {
  return `qa_${randomBytes(4).toString("hex")}`;
}

function httpJson(
  path: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; cookie?: string },
): Promise<{ ok: boolean; status: number; body: Record<string, unknown>; cookies: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE}${path}`);
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: init?.method ?? "GET",
        headers: {
          ...(init?.headers ?? {}),
          ...(init?.cookie ? { Cookie: init.cookie } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body: Record<string, unknown> = {};
          try {
            body = JSON.parse(text) as Record<string, unknown>;
          } catch {
            body = { raw: text.slice(0, 200) };
          }
          const setCookie = res.headers["set-cookie"] ?? [];
          resolve({
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            status: res.statusCode ?? 0,
            body,
            cookies: setCookie.map(String).join("; "),
          });
        });
      },
    );
    req.on("error", reject);
    if (init?.body) req.write(init.body);
    req.end();
  });
}

function fail(msg: string): never {
  console.error(`[FAIL] ${msg}`);
  process.exit(1);
}

async function main() {
  console.log(`# username auth QA · ${BASE}`);

  const health = await httpJson("/api/health");
  if (!health.ok) fail(`health ${health.status}`);

  const anon = await httpJson("/api/auth/session");
  if (anon.body.user != null) fail("expected anonymous session user=null");

  const username = randUser();
  const password = "testpass123";

  const reg = await httpJson("/api/auth/register/username", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!reg.ok) fail(`register ${reg.status} ${JSON.stringify(reg.body)}`);
  const sessionCookie = reg.cookies.match(/gcreator_session=[^;]+/)?.[0];
  if (!sessionCookie) fail("register missing session cookie");

  const session = await httpJson("/api/auth/session", { cookie: sessionCookie });
  const user = session.body.user as { username?: string; displayName?: string } | null;
  if (!user?.username || user.username !== username.toLowerCase()) {
    fail(`session after register: ${JSON.stringify(session.body)}`);
  }
  console.log(`[OK] register + session username=${user.username}`);

  await httpJson("/api/auth/logout", {
    method: "POST",
    cookie: sessionCookie,
  });

  const badLogin = await httpJson("/api/auth/login/username", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "wrong" }),
  });
  if (badLogin.status !== 401) fail(`bad login expected 401 got ${badLogin.status}`);

  const login = await httpJson("/api/auth/login/username", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.toUpperCase(), password }),
  });
  if (!login.ok) fail(`login ${login.status} ${JSON.stringify(login.body)}`);
  console.log("[OK] login with uppercase username");

  const dup = await httpJson("/api/auth/register/username", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "anotherpass1" }),
  });
  if (dup.status !== 400 || dup.body.errorKey !== "registerUsernameTaken") {
    fail(`duplicate register expected 400 registerUsernameTaken got ${dup.status} ${JSON.stringify(dup.body)}`);
  }
  console.log("[OK] duplicate username rejected");

  const invalid = await httpJson("/api/auth/register/username", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "1bad", password: "validpass1" }),
  });
  if (invalid.status !== 400 || invalid.body.errorKey !== "registerInvalidUsername") {
    fail(`invalid username expected registerInvalidUsername got ${JSON.stringify(invalid.body)}`);
  }
  console.log("[OK] invalid username rejected");

  console.log("\n[SUMMARY] username auth QA passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
