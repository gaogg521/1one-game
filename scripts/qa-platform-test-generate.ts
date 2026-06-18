/**
 * 平台用户路径：generateGameSpecWithMeta → 入库 → 试玩链接报告
 * npm run qa:platform-test-generate
 *
 * 可选：PLAYWRIGHT_BASE_URL + 运行中 dev → 额外走 /api/generate/stream HTTP 抽测
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { generateGameSpecWithMeta } from "@/lib/generate-spec";
import { createProjectRecord } from "@/lib/project-create";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";
import { shouldUseAgenticRuntime } from "@/lib/agentic/game-module";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import { createRunTraceRecorder } from "@/lib/orchestration/run-trace";
import {
  buildOpenGameRecapFromTrace,
  summarizeOpenGameGeneration,
} from "@/lib/opengame-skills/generation-trace";
import { consumeSSE } from "@/lib/read-sse";
import { getActiveProvider } from "@/lib/llm";
import type { GameSpec } from "@/lib/game-spec";

const OWNER = process.env.PLATFORM_TEST_OWNER ?? "platform-test-user";

async function resolveBaseUrl(): Promise<string> {
  const candidates = [
    process.env.PLAYWRIGHT_BASE_URL,
    "http://127.0.0.1:8888",
    "http://127.0.0.1:3000",
  ].filter(Boolean) as string[];
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return base.replace(/\/$/, "");
    } catch {
      /* try next */
    }
  }
  return "http://127.0.0.1:3000";
}
const OUT_DIR = path.join(process.cwd(), "qa-output", "platform-test-generate");

type TestCase = {
  id: string;
  label: string;
  prompt: string;
  templateHint?: string;
  expectRoute: "dedicated" | "agentic";
};

const CASES: TestCase[] = [
  {
    id: "simple-dedicated",
    label: "简单 prompt · 专用 Scene",
    prompt: "做一个解压打 dummy 假人的物理小游戏，点击得分",
    templateHint: "physics",
    expectRoute: "dedicated",
  },
  {
    id: "complex-agentic",
    label: "复杂 prompt · Agentic + OpenGame",
    prompt:
      "Build an epic side-scrolling platformer with 3 levels, character select, and final boss Thanos.",
    expectRoute: "agentic",
  },
];

type ResultRow = {
  id: string;
  label: string;
  projectId: string;
  shareCode: string;
  title: string;
  templateId: string;
  scene: string;
  playRoute: string;
  effectivePlayRoute: string;
  specSource: string;
  moduleSource?: string;
  opengameTier?: string;
  recap: string[];
  playUrl: string;
  shareUrl: string;
  createUrl: string;
  ms: number;
  routeOk: boolean;
};

async function serverReachable(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function generateAndPersist(c: TestCase, base: string): Promise<ResultRow> {
  const orch = createRunTraceRecorder();
  const t0 = Date.now();
  const { spec, source, debug } = await generateGameSpecWithMeta(c.prompt, {
    enhancePass: false,
    templateHint: c.templateHint,
    orchestration: orch,
    uiLocale: "zh-Hans",
  });
  const persisted = prepareGameSpecForPersist(spec, c.prompt);
  const project = await createProjectRecord({
    ownerKey: OWNER,
    title: persisted.title,
    prompt: c.prompt,
    specJson: JSON.stringify(persisted),
    status: "ready",
  });
  const ms = Date.now() - t0;
  const playRoute =
    persisted.agenticPlayRoute ??
    (shouldUseAgenticRuntime(persisted) ? "agentic" : "dedicated");
  const effectivePlayRoute = shouldUseAgenticRuntime(persisted) ? "agentic" : playRoute;
  const summary = summarizeOpenGameGeneration(debug.orchestrationTrace);
  const recap = buildOpenGameRecapFromTrace("zh-Hans", debug.orchestrationTrace, {
    agenticPlayRoute: persisted.agenticPlayRoute,
  });
  const routeOk = effectivePlayRoute === c.expectRoute;

  return {
    id: c.id,
    label: c.label,
    projectId: project.id,
    shareCode: project.shareCode,
    title: persisted.title,
    templateId: persisted.templateId,
    scene: expectedPhaserSceneName(persisted),
    playRoute,
    effectivePlayRoute,
    specSource: source,
    moduleSource: summary?.moduleSource,
    opengameTier: summary?.tier,
    recap,
    playUrl: `${base}/zh-Hans/play/${project.id}`,
    shareUrl: `${base}/zh-Hans/s/${project.shareCode}`,
    createUrl: `${base}/zh-Hans/create?from=${project.id}`,
    ms,
    routeOk,
  };
}

async function httpStreamSmoke(base: string): Promise<string | null> {
  if (!(await serverReachable(base))) return null;
  const res = await fetch(`${base}/api/generate/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `gcreator_owner=${OWNER}`,
    },
    body: JSON.stringify({
      prompt: "躲开陨石收集金币",
      templateHint: "collector",
      enhancePass: false,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) return `stream HTTP ${res.status}`;
  let done = false;
  await consumeSSE(res, (ev) => {
    if (ev.step === "done" && ev.spec) done = true;
    if (ev.step === "error") throw new Error(String(ev.message ?? "stream error"));
  });
  return done ? "ok" : "no done frame";
}

async function main() {
  if (!getActiveProvider() || !process.env.OPENAI_API_KEY?.trim()) {
    console.error("[FAIL] 需要 OPENAI_API_KEY / LLM provider 才能生成测试游戏");
    process.exit(1);
  }

  process.env.AGENTIC_LLM_FAST = process.env.AGENTIC_LLM_FAST ?? "1";

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const BASE = await resolveBaseUrl();
  const rows: ResultRow[] = [];
  const failures: string[] = [];

  console.log(`\n# 平台测试生成 · owner=${OWNER}\n`);

  for (const c of CASES) {
    console.log(`▶ ${c.label} …`);
    try {
      const row = await generateAndPersist(c, BASE);
      rows.push(row);
      const flag = row.routeOk ? "OK" : "WARN";
      console.log(
        `  [${flag}] ${row.title} · ${row.effectivePlayRoute} · ${row.scene} · ${row.ms}ms\n      ${row.playUrl}`,
      );
      if (!row.routeOk) {
        failures.push(`${c.id}: expected ${c.expectRoute}, got ${row.effectivePlayRoute}`);
      }
    } catch (e) {
      failures.push(`${c.id}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`  [FAIL]`, e);
    }
  }

  let streamNote = "dev server 未启动，跳过 HTTP SSE";
  if (await serverReachable(BASE)) {
    console.log("\n▶ HTTP /api/generate/stream 抽测 …");
    try {
      const r = await httpStreamSmoke(BASE);
      streamNote = r === "ok" ? "SSE dedicated 抽测 OK" : `SSE: ${r}`;
      console.log(`  [OK] ${streamNote}`);
    } catch (e) {
      streamNote = e instanceof Error ? e.message : String(e);
      failures.push(`sse: ${streamNote}`);
      console.error(`  [FAIL] ${streamNote}`);
    }
  } else {
    console.log(`\n[skip] ${BASE} 不可达 · 仅完成 DB 入库生成`);
  }

  const at = new Date().toISOString();
  const report = {
    at,
    ownerKey: OWNER,
    baseUrl: BASE,
    streamNote,
    pass: failures.length === 0,
    results: rows,
    failures,
  };

  fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(report, null, 2));
  const md = [
    `# 平台测试生成报告`,
    ``,
    `- 时间：${at}`,
    `- 用户标识（ownerKey）：\`${OWNER}\``,
    `- 基址：${BASE}`,
    `- HTTP SSE：${streamNote}`,
    ``,
    `## 生成结果`,
    ``,
    ...rows.map(
      (r) =>
        `### ${r.label}\n\n- 标题：**${r.title}**\n- 试玩：[${r.playUrl}](${r.playUrl})\n- 分享：[${r.shareUrl}](${r.shareUrl})\n- 创作台：[${r.createUrl}](${r.createUrl})\n- 路由：\`${r.playRoute}\` · 试玩 \`${r.effectivePlayRoute}\` · Scene：\`${r.scene}\` · tier：${r.opengameTier ?? "—"}\n- recap：${r.recap.length ? r.recap.join(" · ") : "—"}\n- 耗时：${r.ms}ms\n`,
    ),
    failures.length ? `## 失败\n\n${failures.map((f) => `- ${f}`).join("\n")}\n` : "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "REPORT.md"), md);

  console.log(`\n报告：qa-output/platform-test-generate/REPORT.md`);

  if (failures.length) {
    console.error(`\n[FAIL] ${failures.length} 项`);
    process.exit(1);
  }
  console.log("\n[OK] qa:platform-test-generate");
}

void main();
