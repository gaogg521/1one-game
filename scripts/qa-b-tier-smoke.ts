/**
 * B 档产品线离线 smoke：六模板 + director + 共创 + 文学规则
 * npm run qa:b-tier-smoke
 */
import { execSync } from "node:child_process";

const STEPS = [
  "npm run qa:template-matrix",
  "npm run qa:director-spec",
  "npm run qa:refinement-log",
  "npm run qa:co-create-loop",
  "npm run qa:comic-novel-product-rules",
  "npm run qa:comic-storyboard-resilience",
  "npm run qa:comic-director-pipeline",
  "npm run qa:database-url",
  "npm run qa:songliao:artifacts",
  "npm run qa:novel-character-roster-db",
  "npm run qa:coaster-endless-mode",
  "npm run qa:platformer-stealth-mode",
  "npm run qa:pottery-mode",
  "npm run qa:puzzle-mode",
  "npm run qa:comic-panel-eta",
  "npm run qa:comic-featured:offline",
  "npm run qa:comic-director-chunk-stats",
  "npm run qa:runtime-config-admin",
  "npm run qa:architecture-parity",
  "npm run qa:competitor-clone-checks-offline",
] as const;

function run(cmd: string): { ok: boolean; detail?: string } {
  try {
    execSync(cmd, { stdio: "pipe", encoding: "utf8" });
    return { ok: true };
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    const detail = (err.stderr || err.stdout || err.message || "").trim().slice(0, 400);
    return { ok: false, detail };
  }
}

function main() {
  let failed = 0;
  for (const cmd of STEPS) {
    const r = run(cmd);
    console.log(`${r.ok ? "[OK]" : "[FAIL]"} ${cmd}${r.detail ? `\n  ${r.detail}` : ""}`);
    if (!r.ok) failed += 1;
  }
  if (failed) {
    console.error(`qa:b-tier-smoke: ${failed}/${STEPS.length} failed`);
    process.exit(1);
  }
  console.log(`qa:b-tier-smoke: ok (${STEPS.length}/${STEPS.length})`);
}

main();
