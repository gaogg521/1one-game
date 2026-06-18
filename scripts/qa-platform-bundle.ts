/**
 * 平台用户路径 QA 打包（离线回放 + 可选 LLM 生成）
 * npm run qa:platform-bundle
 *
 * RUN_LLM_QA=1 时追加 qa:platform-test-generate
 */
import { execSync } from "node:child_process";

const steps: { name: string; cmd: string; needsLlm?: boolean }[] = [
  { name: "创作台回放", cmd: "npm run qa:platform-create-replay" },
  { name: "staging 复杂 SSE", cmd: "npm run qa:staging-complex-smoke" },
  { name: "平台双用例生成", cmd: "npm run qa:platform-test-generate", needsLlm: true },
];

function run(cmd: string) {
  execSync(cmd, { stdio: "inherit", cwd: process.cwd(), env: process.env });
}

const failures: string[] = [];
const runLlm = process.env.RUN_LLM_QA === "1";

for (const step of steps) {
  if (step.needsLlm && !runLlm) {
    console.log(`[skip] ${step.name}（设 RUN_LLM_QA=1 启用）`);
    continue;
  }
  if (step.needsLlm && !process.env.OPENAI_API_KEY?.trim()) {
    console.log(`[skip] ${step.name}（无 OPENAI_API_KEY）`);
    continue;
  }
  process.stdout.write(`→ ${step.name} … `);
  try {
    run(step.cmd);
    console.log("OK");
  } catch {
    failures.push(step.name);
    console.log("FAIL");
  }
}

if (failures.length) {
  console.error(`[FAIL] qa:platform-bundle (${failures.join(", ")})`);
  process.exit(1);
}
console.log("[OK] qa:platform-bundle");
