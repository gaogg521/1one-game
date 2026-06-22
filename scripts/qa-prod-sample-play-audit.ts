/**
 * 生产环境样品馆玩法实机审计
 * PLAYWRIGHT_BASE_URL=http://your-prod-host npm run qa:prod-sample-play-audit
 */
import path from "node:path";
import { healthOk, runSampleGameplayInteractionAudit } from "@/lib/qa/run-sample-gameplay-interaction-audit";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:6666";
const OUT = path.join(process.cwd(), "qa-output", "prod-sample-play-audit");

async function main() {
  console.log(`[prod-audit] target=${BASE}`);
  if (!(await healthOk(BASE))) {
    console.error(`[FAIL] 生产服务未就绪 @ ${BASE}`);
    process.exit(1);
  }

  const results = await runSampleGameplayInteractionAudit(BASE, OUT);
  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.error(`qa:prod-sample-play-audit: ${failed.length}/${results.length} failed`);
    for (const r of failed) {
      console.error(`  - ${r.sampleId}: ${r.error ?? "unknown"}`);
    }
    process.exit(1);
  }
  console.log(`qa:prod-sample-play-audit: ok (${results.length}/${results.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
