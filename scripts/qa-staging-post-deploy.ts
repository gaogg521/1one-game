/**
 * Staging / 预发部署后抽测（health · QA 路由 · Browser Bench · 复杂 Agentic SSE）
 * npm run qa:staging-post-deploy
 *
 * 用法：
 *   STAGING_BASE_URL=http://your-staging-host npm run qa:staging-post-deploy
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:8888 npm run qa:staging-post-deploy
 *
 * 输出：qa-output/staging-post-deploy/REPORT.md
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "qa-output", "staging-post-deploy");

function resolveBaseCandidates(): string[] {
  const raw = [
    process.env.STAGING_BASE_URL,
    process.env.PLAYWRIGHT_BASE_URL,
    "http://127.0.0.1:80",
    "http://127.0.0.1:8888",
    "http://127.0.0.1:3000",
  ].filter(Boolean) as string[];
  const seen = new Set<string>();
  return raw
    .map((b) => b.replace(/\/$/, ""))
    .filter((b) => {
      if (seen.has(b)) return false;
      seen.add(b);
      return true;
    });
}

async function pickReachableBase(): Promise<string | null> {
  for (const base of resolveBaseCandidates()) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) return base;
    } catch {
      /* next */
    }
  }
  return null;
}

async function probeQaRoute(base: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${base}/qa/agentic-bench`, { signal: AbortSignal.timeout(10_000) });
    if (res.status === 404) {
      return { ok: false, detail: "404 — 请设 QA_ROUTES_ENABLED=1 并重启" };
    }
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const html = await res.text();
    const ok = html.includes("agentic-bench") || html.includes("AgenticBench");
    return ok ? { ok: true, detail: "QA 路由可访问" } : { ok: false, detail: "页面无 agentic-bench 标记" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

function runStep(name: string, cmd: string, env: Record<string, string>): { ok: boolean; detail?: string } {
  try {
    execSync(cmd, { stdio: "pipe", encoding: "utf8", env: { ...process.env, ...env } });
    return { ok: true };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      detail: (err.stderr || err.stdout || err.message || "").slice(0, 500),
    };
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const base = await pickReachableBase();
  const rows: { name: string; ok: boolean; detail?: string }[] = [];

  if (!base) {
    rows.push({ name: "/api/health", ok: false, detail: "无可达基址（设 STAGING_BASE_URL）" });
  } else {
    rows.push({ name: "/api/health", ok: true, detail: base });
    const qa = await probeQaRoute(base);
    rows.push({ name: "/qa/agentic-bench", ...qa });

    process.stdout.write("→ qa:staging-complex-smoke … ");
    const complex = runStep("复杂 Agentic SSE", "npm run qa:staging-complex-smoke", {
      PLAYWRIGHT_BASE_URL: base,
      STAGING: "1",
      OPERONE_STAGING: "1",
    });
    console.log(complex.ok ? "OK" : "FAIL");
    rows.push({ name: "qa:staging-complex-smoke", ...complex });

    process.stdout.write("→ qa:opengame-browser-bench … ");
    const bench = runStep("Browser Bench", "npm run qa:opengame-browser-bench", {
      PLAYWRIGHT_BASE_URL: base,
    });
    console.log(bench.ok ? "OK" : "FAIL");
    rows.push({ name: "qa:opengame-browser-bench", ...bench });
  }

  process.stdout.write("→ qa:opengame-staging-env … ");
  const envCheck = runStep("离线 staging 门禁", "npm run qa:opengame-staging-env", {});
  console.log(envCheck.ok ? "OK" : "FAIL");
  rows.push({ name: "qa:opengame-staging-env", ...envCheck });

  const passCount = rows.filter((r) => r.ok).length;
  const pass = passCount === rows.length;

  const report = [
    "# Staging 部署后抽测",
    "",
    `- 时间：${new Date().toISOString()}`,
    `- 基址：${base ?? "—"}`,
    `- 结果：**${passCount}/${rows.length}** ${pass ? "✅" : "❌"}`,
    "",
    "| 检查项 | 结果 | 说明 |",
    "|--------|------|------|",
    ...rows.map((r) => `| ${r.name} | ${r.ok ? "✅" : "❌"} | ${(r.detail ?? "—").replace(/\|/g, "\\|").slice(0, 120)} |`),
    "",
    "## 部署提示",
    "",
    "```bash",
    "OPERONE_STAGING=1 ./scripts/deploy/...   # 或 cp .env.staging.example .env",
    "STAGING_BASE_URL=http://your-host npm run qa:staging-post-deploy",
    "```",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(OUT, "REPORT.md"), report, "utf8");
  fs.writeFileSync(
    path.join(OUT, "summary.json"),
    JSON.stringify({ at: new Date().toISOString(), base, pass, passCount, total: rows.length, rows }, null, 2),
    "utf8",
  );

  console.log(`\nqa:staging-post-deploy: ${passCount}/${rows.length} → qa-output/staging-post-deploy/REPORT.md`);
  if (!pass) process.exit(1);
  console.log("[OK] qa:staging-post-deploy");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
