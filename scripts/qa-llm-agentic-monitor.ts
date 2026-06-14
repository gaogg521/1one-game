/**
 * LLM Agentic repair 监控：AGENTIC_FORCE_LLM=1 全模板抽检
 * npm run qa:llm-agentic:monitor
 * 单模板：AGENTIC_QA_CASE=physics,towerDefense
 * 需 OPENAI_API_KEY；无密钥时 skip exit 0
 * 报告：qa-output/llm-agentic-monitor.json
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { AGENTIC_QA_CASES } from "./agentic-qa-cases";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { generateAgenticGameModule } from "../src/lib/agentic/generate-game-module";
import { getActiveProvider } from "../src/lib/llm";

process.env.AGENTIC_FORCE_LLM = "1";
if (process.env.AGENTIC_MONITOR_ALL === "1") {
  delete process.env.AGENTIC_QA_CASE;
}
if (process.env.AGENTIC_LLM_FAST === undefined) process.env.AGENTIC_LLM_FAST = "1";

const CASE_TIMEOUT_MS = Number(process.env.AGENTIC_MONITOR_TIMEOUT_MS ?? 120_000);

type Row = {
  templateId: string;
  source: string;
  ok: boolean;
  reason?: string;
  chars?: number;
  ms: number;
};

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`timeout ${ms}ms: ${label}`)), ms);
    }),
  ]);
}

async function main() {
  if (!getActiveProvider() || !process.env.OPENAI_API_KEY?.trim()) {
    console.warn("[skip] qa:llm-agentic:monitor — no LLM provider / OPENAI_API_KEY");
    return;
  }

  const only = process.env.AGENTIC_QA_CASE?.trim();
  const filterIds = only ? only.split(",").map((s) => s.trim()).filter(Boolean) : null;
  const cases = filterIds
    ? AGENTIC_QA_CASES.filter((c) => filterIds.includes(c.expectTemplate))
    : AGENTIC_QA_CASES;

  let llm = 0;
  let fallback = 0;
  let failed = 0;
  const rows: Row[] = [];

  for (const c of cases) {
    const spec = mockSpecFromPrompt(c.prompt);
    if (spec.templateId !== c.expectTemplate) {
      console.warn(`[warn] mock ${c.expectTemplate} got ${spec.templateId}`);
    }
    process.stdout.write(`▶ ${c.expectTemplate} … `);
    const t0 = Date.now();
    try {
      const r = await withTimeout(
        generateAgenticGameModule(c.prompt, spec),
        CASE_TIMEOUT_MS,
        c.expectTemplate,
      );
      const ms = Date.now() - t0;
      if (!r.ok) {
        failed += 1;
        rows.push({ templateId: c.expectTemplate, source: "fail", ok: false, reason: r.reason, ms });
        console.log(`FAIL (${r.reason})`);
        continue;
      }
      if (r.source === "llm") {
        llm += 1;
        rows.push({
          templateId: c.expectTemplate,
          source: "llm",
          ok: true,
          chars: r.module.source.length,
          ms,
        });
        console.log(`llm (${r.module.source.length} chars, ${ms}ms)`);
      } else {
        fallback += 1;
        rows.push({
          templateId: c.expectTemplate,
          source: r.source,
          ok: true,
          reason: r.lastReason,
          chars: r.module.source.length,
          ms,
        });
        console.log(`${r.source} (${r.lastReason ?? ""}, ${ms}ms)`);
      }
    } catch (e) {
      const ms = Date.now() - t0;
      failed += 1;
      const reason = e instanceof Error ? e.message : String(e);
      rows.push({ templateId: c.expectTemplate, source: "fail", ok: false, reason, ms });
      console.log(`FAIL (${reason})`);
    }
  }

  const total = cases.length;
  const repairRate = total > 0 ? fallback / total : 0;
  const report = {
    at: new Date().toISOString(),
    total,
    llm,
    fallback,
    failed,
    repairRate,
    timeoutMs: CASE_TIMEOUT_MS,
    rows,
  };

  const outDir = path.join(process.cwd(), "qa-output");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "llm-agentic-monitor.json"), JSON.stringify(report, null, 2));

  console.log(
    `\n[monitor] llm=${llm} fallback=${fallback} fail=${failed} / ${total} repair_rate=${(repairRate * 100).toFixed(1)}%`,
  );
  console.log(`[monitor] report → qa-output/llm-agentic-monitor.json`);

  if (failed > 0) process.exit(1);
  if (process.env.AGENTIC_QA_STRICT === "1" && llm < total * 0.5) {
    console.error("[FAIL] strict: llm hit rate below 50%");
    process.exit(1);
  }
  console.log("[OK] qa:llm-agentic:monitor");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
