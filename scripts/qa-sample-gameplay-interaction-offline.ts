/**
 * 样品馆玩法交互用例离线校验（CI 无需 dev）
 * npm run qa:sample-gameplay-interaction:offline
 */
import { validateSampleGameplayCasesOffline } from "@/lib/qa/sample-gameplay-interaction";

const failures = validateSampleGameplayCasesOffline();
if (failures.length) {
  console.error("[FAIL] qa:sample-gameplay-interaction:offline:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("qa:sample-gameplay-interaction:offline: ok");
