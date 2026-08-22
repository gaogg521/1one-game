import { enrichGameSpecForRuntime } from "../src/lib/enrich-game-spec";
import { evaluateGameVerticalSlice } from "../src/lib/game-vertical-slice";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const flagshipCases = [
  { prompt: "做一个霓虹地铁无尽跑酷游戏", templateId: "endless-runner" },
  { prompt: "做一个可爱动物三消闯关游戏", templateId: "puzzle" },
  { prompt: "做一个解压弹珠物理碰撞游戏", templateId: "physics" },
  { prompt: "做一个森林精灵平台跳跃冒险游戏", templateId: "platformer" },
  { prompt: "做一个治愈系农场经营游戏", templateId: "farming" },
] as const;

for (const fixture of flagshipCases) {
  const spec = enrichGameSpecForRuntime(mockSpecFromPrompt(fixture.prompt, { templateId: fixture.templateId }), fixture.prompt);
  const scorecard = evaluateGameVerticalSlice(spec);

  assert(scorecard.templateId === fixture.templateId, `${fixture.templateId}: template id changed`);
  assert(scorecard.contract.firstMinute.length === 4, `${fixture.templateId}: expected four first-minute beats`);
  assert(scorecard.contract.firstMinute.map((beat) => beat.window).join(",") === "0-5,5-20,20-40,40-60", `${fixture.templateId}: first-minute windows changed`);
  assert(scorecard.artDirection.visual.assetStyle, `${fixture.templateId}: missing resolved asset style`);
  assert(scorecard.artDirection.audio.musicProfile, `${fixture.templateId}: missing resolved music profile`);
  assert(scorecard.artDirection.characterActions.length >= 4, `${fixture.templateId}: action contract needs at least four cues`);
  assert(scorecard.dimensions.pacing >= 55, `${fixture.templateId}: pacing baseline too low (${scorecard.dimensions.pacing})`);
  assert(scorecard.dimensions.presentation >= 70, `${fixture.templateId}: presentation baseline too low (${scorecard.dimensions.presentation})`);
  assert(scorecard.verdict !== "blocked", `${fixture.templateId}: flagship slice must not be blocked: ${scorecard.reasons.join(",")}`);
}

console.log("[OK] qa-game-vertical-slice");
