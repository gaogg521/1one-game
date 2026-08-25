import assert from "node:assert/strict";
import { generateGameSpecWithMeta } from "@/lib/generate-spec";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";

const cases = [
  { prompt: "设计一个开心消消乐游戏", template: "puzzle", scene: "PuzzleScene" },
  { prompt: "做一个单手操作的太空躲避游戏", template: "avoider", scene: "PlayScene" },
  { prompt: "做一个种花、收获、升级的小农场", template: "garden", scene: "FarmingScene" },
  { prompt: "做一个横版跳跃收集宝石的冒险", template: "platformer", scene: "PlatformerScene" },
  { prompt: "设计一款防守城堡抵抗怪物的塔防", template: "towerDefense", scene: "TowerDefenseScene" },
] as const;

async function main() {
  for (const testCase of cases) {
    const { spec, source, debug } = await generateGameSpecWithMeta(testCase.prompt);
    assert.equal(source, "kernel", "public generation must compile a deterministic kernel");
    assert.equal(spec.templateId, testCase.template, testCase.prompt);
    assert.equal(expectedPhaserSceneName(spec), testCase.scene, testCase.prompt);
    assert.ok(debug.kernelPlan?.coreLoop, "must expose an inspectable core loop");
    assert.equal(debug.fallback, false, "kernel compile is not an LLM fallback");
  }
  console.log(`[OK] qa-game-generation-kernel: ${cases.length} intents compiled into tested runtimes`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
