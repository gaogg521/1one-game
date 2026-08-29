/**
 * 内核编译器对照实验。默认生产管线是 LLM-first（见 docs/game-generation-pipeline.md）。
 * 本脚本显式 pipeline=kernel，断言正则核能把明确意图编进已测模板。
 */
import assert from "node:assert/strict";
import { generateGameSpecWithMeta } from "@/lib/generate-spec";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";

const cases = [
  { prompt: "设计一个开心消消乐游戏", template: "puzzle", scene: "PuzzleScene" },
  { prompt: "做一个单手操作的太空躲避游戏", template: "avoider", scene: "BespokeRuntimeRequired" },
  { prompt: "做一个种花、收获、升级的小农场", template: "garden", scene: "FarmingScene" },
  { prompt: "做一个横版跳跃收集宝石的冒险", template: "platformer", scene: "PlatformerScene" },
  { prompt: "设计一款防守城堡抵抗怪物的塔防", template: "towerDefense", scene: "TowerDefenseScene" },
] as const;

async function main() {
  for (const testCase of cases) {
    const { spec, source, debug } = await generateGameSpecWithMeta(testCase.prompt, { pipeline: "kernel" });
    assert.equal(source, "kernel", "kernel pipeline must compile a deterministic kernel");
    assert.equal(spec.templateId, testCase.template, testCase.prompt);
    assert.equal(expectedPhaserSceneName(spec), testCase.scene, testCase.prompt);
    assert.ok(debug.kernelPlan?.coreLoop, "must expose an inspectable core loop");
    assert.equal(debug.fallback, false, "kernel compile is not an LLM fallback");
  }
  const fireflyPrompt = "做一个手机单手玩的萤火虫护送小游戏：手指左右移动，引导萤火虫穿过夜森林，避开蜘蛛网，收集三颗月光种子";
  const firefly = await generateGameSpecWithMeta(fireflyPrompt, { pipeline: "kernel" });
  assert.equal(firefly.spec.templateId, "collector", "firefly escort must compile to the collector runtime");
  assert.equal(firefly.spec.title, "萤火虫护送", "title must describe the game rather than repeat the request boilerplate");
  assert.equal(firefly.spec.labels.player, "萤火虫", "player label must not capture an unrelated sentence fragment");
  assert.equal(firefly.spec.labels.hazard, "蜘蛛网", "explicit hazards must outrank a generic forest hazard");
  assert.equal(firefly.spec.labels.collectible, "三颗月光种子", "explicit collectibles must remain aligned with the request");
  assert.equal(firefly.spec.gameplay.winScore, 3, "an explicit three-item win condition must stay three, not become a generic score target");
  console.log(`[OK] qa-game-generation-kernel: ${cases.length} intents compiled into tested runtimes (pipeline=kernel)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
