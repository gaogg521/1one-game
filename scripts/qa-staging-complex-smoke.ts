/**
 * Staging 复杂 prompt 抽测：STAGING=1 默认 Browser Bench + SSE Agentic 路由
 * npm run qa:staging-complex-smoke
 *
 * 需 dev + OPENAI_API_KEY（或 AGENTIC_LLM_FAST=1 加速）；离线 env 段始终运行。
 * 输出：qa-output/staging-complex-smoke/REPORT.md
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { consumeSSE } from "@/lib/read-sse";
import { shouldUseAgenticRuntime } from "@/lib/agentic/game-module";
import {
  isOpenGameBrowserBenchEnabled,
  isOpenGameBrowserBenchRepairEnabled,
} from "@/lib/opengame-skills/browser-bench-env";
import { isComfyGameSpriteEnabled } from "@/lib/comfy-game-sprite-gen";
import type { GameSpec } from "@/lib/game-spec";

const OUT = path.join(process.cwd(), "qa-output", "staging-complex-smoke");
const OWNER = process.env.PLATFORM_TEST_OWNER ?? "platform-test-user";
const COMPLEX_PROMPT =
  "Build an epic side-scrolling platformer with 3 levels, character select, and final boss Thanos.";

async function resolveBaseUrl(): Promise<string | null> {
  for (const base of [
    process.env.STAGING_BASE_URL,
    process.env.PLAYWRIGHT_BASE_URL,
    "http://127.0.0.1:80",
    "http://127.0.0.1:8888",
    "http://127.0.0.1:3000",
  ].filter(Boolean) as string[]) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return base.replace(/\/$/, "");
    } catch {
      /* next */
    }
  }
  return null;
}

function runOfflineStagingChecks(): { ok: boolean; rows: string[] } {
  const rows: string[] = [];
  const failures: string[] = [];

  process.env.STAGING = "1";
  process.env.OPERONE_STAGING = "1";
  delete process.env.OPENGAME_BROWSER_BENCH;
  delete process.env.OPENGAME_BROWSER_BENCH_REPAIR;

  if (!isOpenGameBrowserBenchEnabled()) failures.push("STAGING=1 should enable browser bench");
  else rows.push("Browser Bench：STAGING 默认开启 ✅");

  if (!isOpenGameBrowserBenchRepairEnabled()) failures.push("STAGING=1 should enable bench repair");
  else rows.push("Browser Bench Repair：STAGING 默认开启 ✅");

  process.env.GAME_SPRITE_COMFY = "1";
  process.env.COMFY_UI_BASE_URL = process.env.COMFY_UI_BASE_URL ?? "http://127.0.0.1:8188";
  if (!isComfyGameSpriteEnabled()) rows.push("Comfy 精灵：需 COMFY_UI_BASE_URL（staging 模板已设）⚠");
  else rows.push("Comfy 精灵：GAME_SPRITE_COMFY=1 ✅");

  return { ok: failures.length === 0, rows: failures.length ? [...rows, ...failures.map((f) => `❌ ${f}`)] : rows };
}

async function runHttpComplexStream(base: string): Promise<{ ok: boolean; detail: string; steps?: string[] }> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { ok: true, detail: "跳过 HTTP（无 OPENAI_API_KEY）" };
  }

  process.env.STAGING = "1";
  process.env.OPERONE_STAGING = "1";
  process.env.AGENTIC_LLM_FAST = process.env.AGENTIC_LLM_FAST ?? "1";

  const res = await fetch(`${base}/api/generate/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `gcreator_owner=${OWNER}`,
    },
    body: JSON.stringify({ prompt: COMPLEX_PROMPT, enhancePass: false }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    return { ok: false, detail: `POST /api/generate/stream ${res.status}: ${(await res.text()).slice(0, 200)}` };
  }

  let doneSpec: GameSpec | null = null;
  const steps: string[] = [];
  let recapLines: string[] = [];

  await consumeSSE(res, (ev) => {
    const step = ev.step as string | undefined;
    if (step) steps.push(step);
    if (step === "done" && ev.spec) doneSpec = ev.spec as GameSpec;
    if (step === "recap" && Array.isArray(ev.lines)) {
      recapLines = ev.lines.filter((x): x is string => typeof x === "string");
    }
    if (step === "error") {
      throw new Error(String(ev.message ?? "stream error"));
    }
  });

  if (!doneSpec) {
    return { ok: false, detail: `无 done 帧；steps=${steps.join("→")}`, steps };
  }
  if (!shouldUseAgenticRuntime(doneSpec)) {
    return {
      ok: false,
      detail: `复杂 prompt 应走 Agentic，实际 template=${doneSpec.templateId} route=${doneSpec.agenticPlayRoute}`,
      steps,
    };
  }

  const benchMention = recapLines.some((l) => /bench|browser|OpenGame/i.test(l));
  return {
    ok: true,
    detail: `Agentic 路由 OK · template=${doneSpec.templateId} · recap bench=${benchMention ? "yes" : "n/a"}`,
    steps,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const offline = runOfflineStagingChecks();
  const base = await resolveBaseUrl();

  let httpOk = true;
  let httpDetail = "dev 未启动，跳过 HTTP";
  let httpSteps: string[] | undefined;

  if (base) {
    console.log(`[info] dev @ ${base}`);
    const http = await runHttpComplexStream(base);
    httpOk = http.ok;
    httpDetail = http.detail;
    httpSteps = http.steps;
  }

  const pass = offline.ok && httpOk;
  const report = [
    "# Staging 复杂 prompt 抽测",
    "",
    `- 时间：${new Date().toISOString()}`,
    `- 结果：**${pass ? "✅ PASS" : "❌ FAIL"}**`,
    "",
    "## 离线 Staging 门禁",
    "",
    ...offline.rows.map((r) => `- ${r}`),
    "",
    "## HTTP 复杂 Agentic SSE",
    "",
    `- Base：${base ?? "（无）"}`,
    `- ${httpDetail}`,
    ...(httpSteps?.length ? [`- Steps：${httpSteps.join(" → ")}`] : []),
    "",
  ].join("\n");

  fs.writeFileSync(path.join(OUT, "REPORT.md"), report, "utf8");
  fs.writeFileSync(
    path.join(OUT, "summary.json"),
    JSON.stringify({ at: new Date().toISOString(), pass, offline, httpOk, httpDetail, base }, null, 2),
    "utf8",
  );

  if (!offline.ok) {
    console.error("[FAIL] offline staging checks");
    process.exit(1);
  }
  if (!httpOk) {
    console.error("[FAIL]", httpDetail);
    process.exit(1);
  }
  console.log("[OK] qa:staging-complex-smoke");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
