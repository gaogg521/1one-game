/**
 * 创作链路 generate/stream 等价路径：generateGameSpecWithMeta → dedicated Scene
 * npm run qa:generate-stream-agentic
 * 快速模式默认；无密钥时跳过 exit 0
 */
import "dotenv/config";
import { generateGameSpecWithMeta } from "../src/lib/generate-spec";
import { parseGameSpec } from "../src/lib/game-spec";
import { shouldUseAgenticRuntime } from "../src/lib/agentic/game-module";
import { expectedPhaserSceneName } from "../src/lib/game-templates/runtime";
import { getActiveProvider } from "../src/lib/llm";

if (process.env.AGENTIC_LLM_FAST === undefined) process.env.AGENTIC_LLM_FAST = "1";
if (process.env.E2E_AGENTIC_FALLBACK_ONLY === undefined) process.env.E2E_AGENTIC_FALLBACK_ONLY = "0";

async function main() {
  if (!getActiveProvider() || !process.env.OPENAI_API_KEY?.trim()) {
    console.warn("[skip] no LLM provider / OPENAI_API_KEY");
    return;
  }

  const prompt = "打击 dummy 假人解压";
  const t0 = Date.now();
  console.log("▶ generateGameSpecWithMeta …");
  const { spec, source: specSource, debug } = await generateGameSpecWithMeta(prompt, {
    enhancePass: false,
    templateHint: "physics",
  });
  const ms = Date.now() - t0;

  parseGameSpec(spec);
  if (spec.templateId !== "physics") {
    console.warn(`[warn] expected physics template, got ${spec.templateId}`);
  }
  if (shouldUseAgenticRuntime(spec)) {
    console.error("[FAIL] dedicated path should not attach agenticModule");
    process.exit(1);
  }
  if (expectedPhaserSceneName(spec) !== "PhysicsScene") {
    console.error("[FAIL] expected PhysicsScene, got", expectedPhaserSceneName(spec));
    process.exit(1);
  }

  console.log(
    `[OK] template=${spec.templateId} specSource=${specSource} scene=PhysicsScene (${ms}ms)`,
  );
  if (debug.orchestrationTrace?.notes?.some((n) => n.kind === "agentic_module")) {
    console.warn("[warn] orchestration trace still contains agentic_module on dedicated path");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
