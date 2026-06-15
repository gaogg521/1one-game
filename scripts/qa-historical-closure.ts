/**
 * 历史问题闭环总验：Astrocade 关键 QA 一键绿
 * npm run qa:historical-closure
 * 需 dev @8888（Playwright 段）
 */
import { execSync } from "node:child_process";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";

function run(cmd: string) {
  console.log(`\n→ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd(), env: process.env });
}

async function healthOk(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log("# qa:historical-closure — Astrocade 历史问题总验\n");

  run("npm run qa:agentic-sandbox");
  run("npm run qa:agentic-template-matrix");
  run("npm run qa:scene-hud-i18n");
  run("npm run qa:astrocade-user-path");
  run("npm run qa:godot-3d-matrix");
  run("npm run qa:game-hud-locale-dedicated");
  run("npm run qa:architecture-parity");
  run("npm run qa:b-tier-smoke");
  run("npm run qa:database-url");
  run("npm run qa:comic-director-pipeline");
  run("npm run qa:songliao:artifacts");
  run("npm run qa:novel-character-roster-db");
  run("npm run qa:comic-storyboard-resilience");
  run("npm run qa:console-sso-config");
  run("npm run qa:admin-console");

  if (await healthOk()) {
    run("npm run qa:prompt-parity-compare");
  } else {
    console.warn("[skip] qa:prompt-parity-compare — dev not running");
  }
  run("npm run qa:agentic-repair");
  run("npm run qa:asset-alignment");
  const coverEnv = { ...process.env };
  delete coverEnv.RUN_REAL_IMAGE_GEN;
  console.log("\n→ npm run qa:cover-play-alignment");
  execSync("npm run qa:cover-play-alignment", { stdio: "inherit", cwd: process.cwd(), env: coverEnv });

  if (await healthOk()) {
    run("npm run qa:generate-stream-sse");
  } else {
    console.warn(`[skip] qa:generate-stream-sse — dev not at ${BASE}`);
  }

  const llmEnv = { ...process.env };
  delete llmEnv.E2E_AGENTIC_FALLBACK_ONLY;
  console.log("\n→ npm run qa:llm-agentic");
  execSync("npm run qa:llm-agentic", { stdio: "inherit", cwd: process.cwd(), env: llmEnv });

  if (process.env.AGENTIC_MONITOR === "1") {
    console.log("\n→ npm run qa:llm-agentic:monitor (AGENTIC_MONITOR=1)");
    execSync("npm run qa:llm-agentic:monitor", { stdio: "inherit", cwd: process.cwd(), env: llmEnv });
  } else {
    console.warn("[skip] qa:llm-agentic:monitor — set AGENTIC_MONITOR=1 for full LLM repair stats");
  }

  if (await healthOk()) {
    process.env.PW_EXTERNAL = "1";
    run(
      "npx playwright test e2e/astrocade-agentic.smoke.spec.ts e2e/astrocade-duplicate-phaser.smoke.spec.ts e2e/create-generate-stream-agentic.spec.ts e2e/samples-en-matrix.smoke.spec.ts e2e/competitor-clone.smoke.spec.ts --workers=1 --reporter=line",
    );
    run("npm run qa:game-effect-compare");
    console.log("\n→ npm run qa:competitor-clone-batch (COMPETITOR_CLONE_BATCH=smoke)");
    execSync("npm run qa:competitor-clone-batch", {
      stdio: "inherit",
      cwd: process.cwd(),
      env: { ...process.env, COMPETITOR_CLONE_BATCH: "smoke" },
    });
  } else {
    console.warn("[skip] Playwright + game-effect + competitor-clone-batch — start dev first");
  }

  console.log("\n[OK] qa:historical-closure complete — 历史 Astrocade + 文学链路已验");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
