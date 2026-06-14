/** 全量 LLM Agentic QA（2 模型 × 3 repair，约 5–10 分钟） */
process.env.AGENTIC_LLM_FAST = "0";
process.env.AGENTIC_GEN_VERBOSE = "1";
import "./qa-llm-agentic.ts";
