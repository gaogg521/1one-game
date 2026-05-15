/**
 * CI / 本地：mock 规格离线路径 + lint 语义校验（不触碰 LLM / DB）。
 */
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { lintGameSpecForOrchestration } from "../src/lib/orchestration/lint-spec";

const PROMPTS = [
  "躲开从天而降的障碍物",
  "收集散落金币躲开尖刺",
  "生存模式下尽量躲开弹幕",
  "横版闯关跳跃收集钥匙过关",
  "塔防卫萝卜波次守住基地",
  "塔防三路出兵多波敌军",
];

function main() {
  let failed = false;
  for (const prompt of PROMPTS) {
    const spec = mockSpecFromPrompt(prompt);
    const lint = lintGameSpecForOrchestration(spec);
    if (!lint.ok) {
      failed = true;
      console.error(`[FAIL] prompt=${JSON.stringify(prompt)}`);
      for (const issue of lint.issues) console.error(`  - ${issue}`);
    }
  }
  if (failed) {
    process.exitCode = 1;
    return;
  }
  console.log(`[OK] qa-orchestration-smoke: ${PROMPTS.length} prompts lint clean`);
}

main();
