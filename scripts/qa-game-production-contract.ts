import assert from "node:assert/strict";
import { generateGameSpecWithMeta } from "@/lib/generate-spec";
import { evaluateGameVerticalSlice } from "@/lib/game-vertical-slice";

const cases = [
  { prompt: "设计一个开心消消乐游戏", ambience: "arcade" },
  { prompt: "做一个单手操作的太空躲避游戏", ambience: "space" },
  { prompt: "做一个种花、收获、升级的小农场", ambience: "meadow" },
  { prompt: "设计一款恐怖洞穴逃脱游戏", ambience: "cave" },
] as const;

async function main() {
  for (const testCase of cases) {
    const { spec, debug } = await generateGameSpecWithMeta(testCase.prompt, { pipeline: "kernel" });
    const contract = spec.production;
    assert.ok(contract, `${testCase.prompt}: generated games require a production contract`);
    assert.deepEqual(contract.levelFlow.map((beat) => beat.window), ["0-5", "5-20", "20-40", "40-60"]);
    assert.deepEqual(contract.audio.sections.map((section) => section.section), ["intro", "build", "drop", "climax"]);
    assert.equal(contract.audio.ambience, testCase.ambience, `${testCase.prompt}: ambience must follow the game fantasy`);
    assert.equal(contract.audio.mobile.startsAfterFirstGesture, true);
    assert.equal(contract.audio.mobile.pausesWhenHidden, true);
    assert.ok(contract.audio.mix.maxConcurrentSfx <= 4, "mobile SFX voice budget must be safe");
    assert.equal(debug.kernelPlan?.production.audio.ambience, testCase.ambience, "stream plan and persisted spec must agree");

    const scorecard = evaluateGameVerticalSlice(spec);
    assert.equal(scorecard.artDirection.audio.mobileSafeMix, true, "quality score must see the mobile-safe mix");
    assert.equal(scorecard.artDirection.audio.musicSections, 4, "quality score must see the full BGM progression");
  }
  console.log(`[OK] qa-game-production-contract: ${cases.length} games have level, audio, mix and mobile contracts`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
