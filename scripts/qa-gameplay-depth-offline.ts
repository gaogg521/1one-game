/**
 * 玩法深度断言离线校验（旗舰样品字段映射 + 用例对齐）
 * npm run qa:gameplay-depth-offline
 */
import assert from "node:assert/strict";
import { GAMEPLAY_DEPTH_BY_SAMPLE, validateGameplayDepthOffline } from "@/lib/qa/gameplay-depth";
import { STRICT_VISUAL_SAMPLE_IDS } from "@/lib/qa/canvas-image-parity";
import { validateSampleGameplayCasesOffline } from "@/lib/qa/sample-gameplay-interaction";
import { SAMPLES } from "@/lib/samples";

const depthFailures = validateGameplayDepthOffline();
const caseFailures = validateSampleGameplayCasesOffline();

for (const id of STRICT_VISUAL_SAMPLE_IDS) {
  assert.ok(SAMPLES.some((s) => s.id === id), `strict visual sample missing: ${id}`);
}

for (const id of Object.keys(GAMEPLAY_DEPTH_BY_SAMPLE)) {
  assert.ok(SAMPLES.some((s) => s.id === id), `depth sample missing from SAMPLES: ${id}`);
}

const all = [...depthFailures, ...caseFailures];
if (all.length) {
  console.error("[FAIL] qa:gameplay-depth-offline:\n" + all.join("\n"));
  process.exit(1);
}

console.log(
  `qa:gameplay-depth-offline: ok (depth=${Object.keys(GAMEPLAY_DEPTH_BY_SAMPLE).length} strictVisual=${STRICT_VISUAL_SAMPLE_IDS.size})`,
);
