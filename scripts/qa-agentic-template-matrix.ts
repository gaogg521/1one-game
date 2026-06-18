/**
 * 全模板 Agentic fallback runnable 矩阵
 * npm run qa:agentic-template-matrix
 */
import { AGENTIC_QA_CASES } from "./agentic-qa-cases";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { buildTemplateFallbackModule } from "../src/lib/agentic/template-fallback-modules";
import { runDebugSkillPipeline } from "../src/lib/opengame-skills";
import { PRODUCT } from "../src/lib/product-config";

function main() {
  let failed = 0;
  const first = PRODUCT.game.agenticTemplateFirst;

  for (const c of AGENTIC_QA_CASES) {
    const spec = mockSpecFromPrompt(c.prompt);
    if (spec.templateId !== c.expectTemplate) {
      console.error(`[FAIL] mock ${c.expectTemplate} got ${spec.templateId} (${c.prompt.slice(0, 24)})`);
      failed += 1;
      continue;
    }
    if (!first.includes(spec.templateId)) {
      console.warn(`[warn] ${spec.templateId} not in agenticTemplateFirst`);
    }
    const mod = buildTemplateFallbackModule(spec);
    const run = runDebugSkillPipeline(mod);
    if (!run.ok) {
      console.error(`[FAIL] ${spec.templateId} not runnable: ${run.reason} (${mod.source.length} chars)`);
      failed += 1;
    } else {
      console.log(`[OK] ${spec.templateId} fallback runnable (${mod.source.length} chars)`);
    }
  }

  if (failed > 0) {
    console.error(`\n[FAIL] qa-agentic-template-matrix: ${failed}/${AGENTIC_QA_CASES.length}`);
    process.exit(1);
  }
  console.log(`\n[OK] qa-agentic-template-matrix: ${AGENTIC_QA_CASES.length}/${AGENTIC_QA_CASES.length} templates`);
}

main();
