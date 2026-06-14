/**
 * Astrocade 级流水线 smoke：编排档位 + 模板矩阵 + Agentic + 试玩 + Godot 键
 * npm run qa:astrocade-pipeline
 */
import { execSync } from "node:child_process";
import { PRODUCT } from "../src/lib/product-config";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { attachAgenticModuleIfEnabled } from "../src/lib/agentic/generate-game-module";
import { checkAstrocadeParity } from "../src/lib/astrocade-architecture";

function ensureDevServer() {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";
  try {
    execSync(`node -e "fetch('${base}/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`, {
      stdio: "pipe",
      timeout: 5000,
    });
  } catch {
    console.error(
      `[FAIL] dev server not reachable at ${base}. Start: DATABASE_URL=file:./prisma/ci.sqlite PORT=8888 npm run dev`,
    );
    process.exit(1);
  }
}

function run(cmd: string, extraEnv?: Record<string, string>) {
  console.log(`\n→ ${cmd}`);
  execSync(cmd, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./prisma/ci.sqlite",
      ...extraEnv,
    },
  });
}

async function main() {
  const tier = PRODUCT.orchestration.qualityTier;
  if (tier !== "astrocade") {
    console.warn(`[warn] qualityTier=${tier} (expected astrocade for production parity)`);
  }
  if (!PRODUCT.game.agenticModuleEnabled) {
    console.error("[FAIL] agenticModuleEnabled=false");
    process.exit(1);
  }
  console.log(`[OK] orchestration tier=${tier} agentic=${PRODUCT.game.agenticModuleEnabled}`);

  const spec = mockSpecFromPrompt("做一个解压物理打 dummy 游戏");
  if (spec.templateId !== "physics") {
    console.error(`[FAIL] expected physics template, got ${spec.templateId}`);
    process.exit(1);
  }
  const withAgentic = await attachAgenticModuleIfEnabled("解压打 dummy", spec, true);
  const violations = checkAstrocadeParity(withAgentic, { label: "physics" });
  if (violations.length) {
    console.error("[FAIL]", violations.map((v) => v.message).join("; "));
    process.exit(1);
  }
  console.log("[OK] attachAgenticModuleIfEnabled (template-first → dedicated Scene)");

  run("npm run qa:prompt-profile-infer");
  run("npm run qa:scene-hud-i18n");
  run("npm run qa:samples-locale");
  run("npm run qa:architecture-parity");
  run("npm run qa:spec-canonical-parity");
  run("npm run qa:platform-user-journey");
  run("npm run qa:godot-3d-matrix");
  run("npm run qa:template-matrix");
  run("npm run qa:asset-alignment");
  run("npm run qa:agentic-sandbox");
  run("npm run qa:agentic-sandbox-mock");
  run("npm run qa:agentic-template-matrix");
  run("npm run qa:agentic-repair");
  if (process.env.RUN_LLM_QA === "1") {
    process.env.AGENTIC_LLM_FAST = process.env.AGENTIC_LLM_FAST ?? "1";
    process.env.AGENTIC_QA_STRICT = process.env.AGENTIC_QA_STRICT ?? "1";
    run("npm run qa:generate-stream-agentic");
    run("npm run qa:llm-agentic");
    run("npm run qa:llm-agentic:monitor:all");
  }
  run("npm run qa:godot:runtime-profile");
  run("npm run qa:godot:juice-gate");
  run("npm run qa:sample-templates");
  ensureDevServer();
  run("npm run seed:samples");
  run("npm run qa:gameplay-agent");
  run("npm run qa:sample-play-extended");
  ensureDevServer();
  run("npm run qa:generate-stream-sse");
  run("npm run qa:cover-play-alignment");
  run("npm run qa:game-effect-compare");
  run("npm run qa:competitor-parity-validation", { COMPETITOR_PARITY_STRICT: "1" });
  run("npm run qa:competitor-gates");
  run("npm run qa:astrocade-competitor-matrix");

  console.log("\n[OK] qa:astrocade-pipeline complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
