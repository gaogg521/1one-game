/**
 * 全 16 模板 LLM Agentic 监控（忽略 .env 里 AGENTIC_QA_CASE 抽检限制）
 * npm run qa:llm-agentic:monitor:all
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["tsx", "scripts/qa-llm-agentic-monitor.ts"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    AGENTIC_MONITOR_ALL: "1",
    AGENTIC_QA_CASE: "",
  },
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
