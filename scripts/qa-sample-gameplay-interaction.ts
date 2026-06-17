/**
 * 14 款样品馆真实玩法交互验收（本地 dev @8888）
 * npm run qa:sample-gameplay-interaction
 */
import "dotenv/config";
import { writeQaSnapshot } from "../src/lib/qa-cache";
import { healthOk, runSampleGameplayInteractionAudit } from "../src/lib/qa/run-sample-gameplay-interaction-audit";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";

function persistSnapshot(ok: boolean, passed: number, total: number, failedIds?: string[]) {
  try {
    writeQaSnapshot("samplePlay", {
      script: "qa:sample-gameplay-interaction",
      ok,
      passed,
      total,
      ts: new Date().toISOString(),
      failedIds,
    });
  } catch {
    /* cache optional */
  }
}

async function main() {
  if (!(await healthOk(BASE))) {
    console.error(`[FAIL] 服务未就绪 @ ${BASE}`);
    process.exit(1);
  }

  const results = await runSampleGameplayInteractionAudit(BASE);
  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    persistSnapshot(false, results.length - failed.length, results.length, failed.map((r) => r.sampleId));
    console.error(`qa:sample-gameplay-interaction: ${failed.length}/${results.length} failed`);
    for (const f of failed) console.error(`  - ${f.sampleId}: ${f.error ?? "fail"}`);
    process.exit(1);
  }
  persistSnapshot(true, results.length, results.length);
  console.log(`qa:sample-gameplay-interaction: ok (${results.length}/${results.length})`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
