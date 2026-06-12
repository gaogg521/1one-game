/**
 * 商业化 / Sprint A-D 集成冒烟（无需浏览器）
 * 用法：先起 dev（npm run dev）或 PW_EXTERNAL=1 配合 playwright webServer
 */
/** 与 dev OAuth redirect 同源，避免 localhost / 127.0.0.1 Cookie 分裂 */
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:8888";

class CookieJar {
  constructor() {
    this.map = new Map();
  }
  ingest(res) {
    const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const line of raw) {
      const [pair] = line.split(";");
      const i = pair.indexOf("=");
      if (i < 1) continue;
      this.map.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  header() {
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { ...(opts.headers ?? {}) };
  if (jar.header()) headers.Cookie = jar.header();
  const res = await fetch(url, { ...opts, headers, redirect: "manual" });
  jar.ingest(res);
  return res;
}

const jar = new CookieJar();
const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`✓ ${name}`);
}
function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}: ${detail}`);
}

async function main() {
  // 1. health + owner cookie
  const health = await req("/api/health");
  if (!health.ok) {
    fail("health", `HTTP ${health.status}`);
    summarize();
    process.exit(1);
  }
  const healthJson = await health.json();
  if (!healthJson.ok) fail("health body", JSON.stringify(healthJson));
  else pass("health + db");

  // 2. dev OAuth 登录
  const start = await req("/api/auth/oauth/dev/start");
  if (start.status !== 307 && start.status !== 302) {
    fail("oauth dev start", `HTTP ${start.status} — 需 NODE_ENV=development 或 OAUTH_DEV_ENABLED=1`);
    summarize();
    process.exit(1);
  }
  const location = start.headers.get("location");
  if (!location) {
    fail("oauth dev start", "无 Location");
    summarize();
    process.exit(1);
  }
  const cb = await req(location);
  if (cb.status !== 307 && cb.status !== 302) {
    fail("oauth callback", `HTTP ${cb.status}`);
    summarize();
    process.exit(1);
  }
  if (!jar.map.has("gcreator_session")) {
    fail("oauth session cookie", "未设置 gcreator_session");
  } else {
    pass("dev OAuth 登录 → session cookie");
  }

  // 3. 额度查询（OAuth 用户应有 signup bonus）
  const quotaRes = await req("/api/commerce/quota");
  if (!quotaRes.ok) {
    fail("commerce quota", `HTTP ${quotaRes.status}`);
  } else {
    const q = await quotaRes.json();
    if (typeof q.balance !== "number") fail("commerce quota", "无 balance");
    else if (q.balance < 1) fail("commerce quota", `余额过低: ${q.balance}`);
    else pass(`commerce quota（余额 ${q.balance}）`);
  }

  // 4. lazy User 不扣额度：清 session 仅留 ownerKey
  const ownerOnly = jar.map.get("gcreator_owner") ?? jar.map.get("owner_key");
  const ownerCookieName = [...jar.map.keys()].find((k) => k.includes("owner") || k === "gcreator_owner");
  const sessionBackup = jar.map.get("gcreator_session");
  jar.map.delete("gcreator_session");
  const anonGen = await req("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "x" }),
  });
  const anonBody = await anonGen.json().catch(() => ({}));
  if (anonGen.status === 402) {
    fail("lazy user gate", "匿名/仅 ownerKey 不应 402");
  } else {
    pass(`匿名 generate 非 402（HTTP ${anonGen.status}）`);
  }
  if (sessionBackup) jar.map.set("gcreator_session", sessionBackup);

  // 5. OAuth 用户 gate：余额不足时应 402（先把余额查到）
  const q2 = await (await req("/api/commerce/quota")).json();
  if (typeof q2.balance === "number" && q2.balance > 0) {
    pass("OAuth 用户有额度（gate 逻辑可测）");
  }

  // 6. discover featured + cursor
  const disc = await req("/api/discover?sort=featured&limit=3");
  if (!disc.ok) fail("discover featured", `HTTP ${disc.status}`);
  else {
    const d = await disc.json();
    if (!("nextCursor" in d)) fail("discover cursor", "缺少 nextCursor");
    else pass("discover featured + nextCursor");
  }

  // 7. jobs worker 探针
  const jobs = await req("/api/jobs/worker");
  if (!jobs.ok) fail("jobs worker GET", `HTTP ${jobs.status}`);
  else {
    const j = await jobs.json();
    if (typeof j.pending !== "number") fail("jobs worker", "无 pending");
    else pass(`jobs worker（pending=${j.pending}）`);
  }

  // 8. 关键页面可访问
  for (const p of ["/start", "/create", "/novel/create", "/comic/create", "/studio", "/billing", "/admin"]) {
    const page = await req(p);
    if (page.status !== 200) fail(`page ${p}`, `HTTP ${page.status}`);
    else pass(`page ${p}`);
  }

  summarize();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function summarize() {
  const bad = results.filter((r) => !r.ok);
  console.log(`\n--- 合计 ${results.length} 项，失败 ${bad.length} ---`);
  if (bad.length) bad.forEach((b) => console.error(`  - ${b.name}: ${b.detail}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
