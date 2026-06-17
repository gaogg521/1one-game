/**
 * 刷新后台 ops-health 三轨 QA 快照 + board-showcase
 * npm run qa:ops-health-snapshots
 */
import { spawnSync } from "node:child_process";

const steps = [
  "qa:board-showcase-samples",
  "qa:admin-console",
  "qa:sample-gameplay-interaction",
  "qa:sample-gallery-db-sync",
] as const;

function run(script: string): boolean {
  console.log(`\n→ npm run ${script}`);
  const r = spawnSync("npm", ["run", script], {
    stdio: "inherit",
    shell: true,
    cwd: process.cwd(),
  });
  return r.status === 0;
}

let failed = 0;
for (const step of steps) {
  if (!run(step)) failed += 1;
}

if (failed) {
  console.error(`\n[FAIL] refresh-ops-health-snapshots: ${failed}/${steps.length} steps failed`);
  process.exit(1);
}
console.log(`\n[OK] refresh-ops-health-snapshots (${steps.length}/${steps.length})`);
