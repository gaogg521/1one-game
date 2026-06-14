/** 实机 LLM Agentic 抽检（绕过 template-first，默认 physics + puzzle） */
process.env.AGENTIC_FORCE_LLM = "1";
process.env.AGENTIC_LLM_FAST = process.env.AGENTIC_LLM_FAST ?? "1";
if (!process.env.AGENTIC_QA_CASE?.trim()) {
  process.env.AGENTIC_QA_CASE = "physics,puzzle";
}

import("./qa-llm-agentic.ts").catch((e) => {
  console.error(e);
  process.exit(1);
});
