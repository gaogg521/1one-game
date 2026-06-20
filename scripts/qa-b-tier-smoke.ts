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
  "npm run qa:game-quality-contracts",
  "npm run qa:non-sample-game-quality",
  "npm run qa:commercial-game-design-contracts",
  "npm run qa:match3-commercial-runtime",
  "npm run qa:xiangqi-commercial-runtime",
  "npm run qa:board-showcase-samples",
  "npm run qa:juice-quality-tier",
  "npm run qa:juice-semantic-presets",
  "npm run qa:physics-semantic-juice",
  "npm run qa:play-scene-semantic-juice",
  "npm run qa:shooter-semantic-juice",
  "npm run qa:platformer-semantic-juice",
  "npm run qa:farming-semantic-juice",
  "npm run qa:puzzle-semantic-juice",
  "npm run qa:tower-defense-semantic-juice",
  "npm run qa:rhythm-semantic-juice",
  "npm run qa:sports-semantic-juice",
  "npm run qa:card-semantic-juice",
  "npm run qa:fighting-semantic-juice",
  "npm run qa:moba-semantic-juice",
  "npm run qa:horror-semantic-juice",
  "npm run qa:scene-goal-guidance",
  "npm run qa:hud-goal-panel",
  "npm run qa:asset-visibility-floor",
  "npm run qa:runtime-depth-observable",
  "npm run qa:systems-observable-impact",
  "npm run qa:literary-safety-contracts",
  "npm run qa:comic-safety-contracts",
  "npm run qa:product-lines-summary-contracts",
  "npm run qa:next-trace-config",
  "npm run qa:public-path-contracts",
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
  "npm run qa:gameplay-depth-offline",
  "npm run qa:sample-gameplay-interaction:offline",
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
