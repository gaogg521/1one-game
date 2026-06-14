/**
 * 调试 Agentic LLM 失败原因（打印 lastSource 与 runnable 错误）
 * AGENTIC_QA_CASE=physics npx tsx scripts/qa-llm-agentic-debug.ts
 */
import "dotenv/config";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { buildAgenticSystemPrompt, buildAgenticUserPrompt } from "../src/lib/agentic/agentic-prompts";
import { validateAgenticSource, parseAgenticModule } from "../src/lib/agentic/game-module";
import { validateAgenticRunnable } from "../src/lib/agentic/agentic-runnable";
import { llmJson, getActiveProvider, getProviderModelCascade } from "../src/lib/llm";
import { PRODUCT } from "../src/lib/product-config";

const prompt = process.env.AGENTIC_QA_CASE === "shooter" ? "飞船射击消灭敌机" : "打击 dummy 假人解压";
const spec = mockSpecFromPrompt(prompt);

async function main() {
  if (!getActiveProvider()) {
    console.error("no provider");
    process.exit(1);
  }
  const model = getProviderModelCascade()[0]!;
  console.log("model:", model, "template:", spec.templateId);
  const result = await llmJson({
    model,
    system: buildAgenticSystemPrompt(),
    user: buildAgenticUserPrompt(prompt, spec),
    temperature: 0.52,
    mode: "json_object",
    timeoutMs: PRODUCT.game.agenticTimeoutMs,
  });
  if (!result.ok) {
    console.error("llm failed:", result.error);
    process.exit(1);
  }
  const raw = result.raw as { source?: string };
  const source = raw.source ?? "";
  console.log("source length:", source.length);
  const forbidden = validateAgenticSource(source);
  console.log("forbidden:", forbidden);
  const mod = parseAgenticModule({ version: 1, source, entry: "createGame" });
  console.log("parsed:", Boolean(mod));
  if (mod) {
    const run = validateAgenticRunnable(mod);
    console.log("runnable:", run);
    if (!run.ok) {
      console.log("\n--- source excerpt ---\n");
      console.log(source.slice(0, 3000));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
