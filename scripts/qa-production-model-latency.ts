/** Opt-in paid, isolated phase benchmark using existing routes. Never changes configuration. */
import fs from "node:fs/promises";
import { loadRuntimeConfig, getSceneModelCascade } from "@/lib/runtime-config";
import { llmJson } from "@/lib/llm";
import { buildDesignSystemPrompt, buildDesignUserPrompt, DESIGN_JSON_SCHEMA } from "@/lib/game-forge/design-agent";
import { GameDesignDocSchema } from "@/lib/game-forge/types";
import { generateModule } from "@/lib/game-forge/code-agent";
import { prisma } from "@/lib/prisma";

async function main() {
  if (process.env.QA_PRODUCTION_MODEL_LATENCY !== "1") throw new Error("Opt in with QA_PRODUCTION_MODEL_LATENCY=1");
  await loadRuntimeConfig();
  const prompt = "竖屏小游戏：点击竹子收集积分，避开石头，达到10分获胜，三次误点失败。";
  const results: unknown[] = [];
  await fs.mkdir("qa-output/model-latency", { recursive: true });
  for (const scene of ["game_text", "game_vision"] as const) {
    const model = getSceneModelCascade(scene, "zh")[0];
    if (!model) continue;
    const started = Date.now();
    console.log(JSON.stringify({ event: "started", scene, model }));
    const response = await llmJson({ model, scene, localeGroup: "zh", strictSceneModel: true, system: buildDesignSystemPrompt(), user: buildDesignUserPrompt(prompt, {}), temperature: 0.3, mode: "json_schema", singleModeOnly: true, jsonSchema: DESIGN_JSON_SCHEMA, maxTokens: 32768, timeoutMs: 210_000 });
    const designMs = Date.now() - started;
    const design = response.ok ? GameDesignDocSchema.safeParse(response.raw) : null;
    let moduleResult: unknown = null;
    if (design?.success) {
      const plan = design.data.modules.find(m => m.role === "config")!;
      const t = Date.now();
      const generated = await generateModule(design.data, plan, [model], scene, "zh");
      moduleResult = { ok: generated.ok, durationMs: Date.now() - t, chars: generated.ok ? generated.module.source.length : 0 };
    }
    const result = { scene, model, designMs, designParsed: design?.success ?? false, module: moduleResult, totalMs: Date.now() - started, scope: "one_design_and_config_module", playableSuccessRate: null, note: "Phase benchmark only; no complete runtime or price estimate is implied." };
    results.push(result);
    await fs.writeFile("qa-output/model-latency/REPORT.json", JSON.stringify(results, null, 2));
    console.log(JSON.stringify(result));
  }
}
void main().finally(() => prisma.$disconnect());
