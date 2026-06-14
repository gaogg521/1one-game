/**
 * 真实 LLM Agentic 模块抽检（非 E2E fallback）
 * npm run qa:llm-agentic
 * 默认快速模式：template-first 全模板短路（无 LLM 调用）
 * 全量 LLM：AGENTIC_FORCE_LLM=1 AGENTIC_LLM_FAST=0 npm run qa:llm-agentic
 * 单模板：AGENTIC_QA_CASE=physics
 */
import "dotenv/config";

// QA 默认快速，避免 2×3×120s 卡死
if (process.env.AGENTIC_LLM_FAST === undefined) process.env.AGENTIC_LLM_FAST = "1";
if (process.env.AGENTIC_GEN_VERBOSE === undefined) process.env.AGENTIC_GEN_VERBOSE = "1";
import { AGENTIC_QA_CASES } from "./agentic-qa-cases";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { generateAgenticGameModule } from "../src/lib/agentic/generate-game-module";
import { validateAgenticRunnable } from "../src/lib/agentic/agentic-runnable";
import { getActiveProvider } from "../src/lib/llm";

async function main() {
  if (process.env.E2E_AGENTIC_FALLBACK_ONLY === "1") {
    console.warn("[skip] E2E_AGENTIC_FALLBACK_ONLY=1 — unset for real LLM check");
    return;
  }

  const forceLlm = process.env.AGENTIC_FORCE_LLM === "1";
  if (forceLlm && !getActiveProvider()) {
    console.warn("[skip] AGENTIC_FORCE_LLM=1 but no LLM provider configured");
    return;
  }
  if (forceLlm && !process.env.OPENAI_API_KEY?.trim()) {
    console.warn("[skip] AGENTIC_FORCE_LLM=1 but OPENAI_API_KEY missing");
    return;
  }

  let llmHits = 0;
  let templateFirstHits = 0;
  let fallbackHits = 0;
  const only = process.env.AGENTIC_QA_CASE?.trim();
  const filterIds = only ? only.split(",").map((s) => s.trim()).filter(Boolean) : null;
  const cases = filterIds
    ? AGENTIC_QA_CASES.filter((c) => filterIds.includes(c.expectTemplate))
    : AGENTIC_QA_CASES;
  if (filterIds && cases.length === 0) {
    console.error(`[FAIL] unknown AGENTIC_QA_CASE=${only}`);
    process.exit(1);
  }
  if (filterIds && cases.length < filterIds.length) {
    const found = new Set(cases.map((c) => c.expectTemplate));
    const missing = filterIds.filter((id) => !found.has(id as (typeof AGENTIC_QA_CASES)[number]["expectTemplate"]));
    if (missing.length) console.warn(`[warn] AGENTIC_QA_CASE missing: ${missing.join(", ")}`);
  }

  for (const c of cases) {
    console.log(`\n▶ ${c.expectTemplate} …`);
    const spec = mockSpecFromPrompt(c.prompt);
    if (spec.templateId !== c.expectTemplate) {
      console.error(`[FAIL] mock spec template ${spec.templateId} != ${c.expectTemplate}`);
      process.exit(1);
    }

    const t0 = Date.now();
    const r = await generateAgenticGameModule(c.prompt, spec);
    const ms = Date.now() - t0;

    if (!r.ok) {
      console.error(`[FAIL] ${c.expectTemplate}: ${r.reason}`);
      process.exit(1);
    }

    const run = validateAgenticRunnable(r.module);
    if (!run.ok) {
      console.error(`[FAIL] ${c.expectTemplate} not runnable: ${run.reason}`);
      process.exit(1);
    }

    if (r.source === "llm") {
      llmHits += 1;
      console.log(`[OK] ${c.expectTemplate} source=llm (${ms}ms, ${r.module.source.length} chars)`);
    } else if (r.source === "template_first") {
      templateFirstHits += 1;
      console.log(
        `[OK] ${c.expectTemplate} source=template_first (${ms}ms, ${r.module.source.length} chars)`,
      );
    } else {
      fallbackHits += 1;
      const detail = r.lastReason ? ` lastReason=${r.lastReason}` : "";
      console.warn(
        `[warn] ${c.expectTemplate} source=fallback (${ms}ms)${detail} — template-first off or runnable fail`,
      );
    }
  }

  const okHits = llmHits + templateFirstHits;
  console.log(
    `\n[OK] qa-llm-agentic: ${llmHits} llm + ${templateFirstHits} template_first + ${fallbackHits} fallback / ${cases.length} cases`,
  );

  if (!forceLlm && templateFirstHits < cases.length) {
    console.error(`[FAIL] expected template_first for all ${cases.length} cases`);
    process.exit(1);
  }
  if (forceLlm && okHits === 0 && fallbackHits > 0) {
    console.warn("[warn] AGENTIC_FORCE_LLM=1 but all fell back to template module");
    if (process.env.AGENTIC_QA_STRICT === "1") process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
