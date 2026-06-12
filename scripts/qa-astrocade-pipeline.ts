/**
 * Astrocade 级流水线 smoke：编排档位 + 模板矩阵 + Agentic + 试玩 + Godot 键
 * npm run qa:astrocade-pipeline
 */
import { execSync } from "node:child_process";
import { PRODUCT } from "../src/lib/product-config";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { shouldUseAgenticRuntime } from "../src/lib/agentic/game-module";
import { attachAgenticModuleIfEnabled } from "../src/lib/agentic/generate-game-module";

function run(cmd: string) {
  console.log(`\n→ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
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
  const withAgentic = await attachAgenticModuleIfEnabled("解压打 dummy", spec, true);
  if (!shouldUseAgenticRuntime(withAgentic)) {
    console.error("[FAIL] generated spec missing agenticModule");
    process.exit(1);
  }
  console.log("[OK] attachAgenticModuleIfEnabled");

  run("npm run qa:astrocade-user-path");
  run("npm run qa:template-matrix");
  run("npm run qa:agentic-repair");
  run("npm run qa:agentic-sandbox");
  run("npm run qa:godot-runtime-keys");
  run("npm run qa:sample-templates");
  run("npm run qa:gameplay-agent");
  run("npm run qa:sample-play-extended");

  console.log("\n[OK] qa:astrocade-pipeline complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
