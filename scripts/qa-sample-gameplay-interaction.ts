/**
 * 17 款样品馆真实玩法交互验收（本地 dev @8888）
 * npm run qa:sample-gameplay-interaction
 */
import "dotenv/config";
import { healthOk, runSampleGameplayInteractionAudit } from "../src/lib/qa/run-sample-gameplay-interaction-audit";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";

async function main() {
  if (!(await healthOk(BASE))) {
    console.error(`[FAIL] 服务未就绪 @ ${BASE}`);
    process.exit(1);
  }

  const results = await runSampleGameplayInteractionAudit(BASE);
  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.error(`qa:sample-gameplay-interaction: ${failed.length}/${results.length} failed`);
    process.exit(1);
  }
  console.log(`qa:sample-gameplay-interaction: ok (${results.length}/${results.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
