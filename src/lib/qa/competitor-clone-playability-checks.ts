import type { GameSpec } from "@/lib/game-spec";
import { shouldUseAgenticRuntime } from "@/lib/agentic/game-module";
import { inferCoasterMode } from "@/lib/coaster-blueprint";
import { inferCustomizationMode } from "@/lib/customization-blueprint";
import { inferPlatformerMode } from "@/lib/platformer-blueprint";
import { inferPuzzleMode } from "@/lib/puzzle-blueprint";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import type { Sample } from "@/lib/samples";

/** 各样品期望 Phaser Scene（duplicate 后不得落 Agentic） */
export const EXPECTED_SCENE_BY_SAMPLE: Record<string, string> = {
  "number-merge-2048": "PuzzleScene",
  "classic-xiangqi-board": "ChessScene",
  "classic-international-chess": "ChessScene",
  "zen-go-board": "ChessScene",
  "jungle-animal-chess": "ChessScene",
  "temple-relic-runner": "CoasterScene",
  "smash-the-dummy": "PhysicsScene",
  "grow-a-garden": "FarmingScene",
  "color-bloom": "PuzzleScene",
  "gun-merge-3d-zombie-apocalypse": "TowerDefenseScene",
  "elastic-thief-2": "PlatformerScene",
  "blade-defender-merge": "TowerDefenseScene",
  "pottery-master-3d": "CustomizationScene",
  "crashy-roads": "CoasterScene",
};

export function buildCompetitorClonePlayabilityChecks(
  sample: Sample,
  cloneSpec: GameSpec,
): Record<string, boolean> {
  const scene = expectedPhaserSceneName(cloneSpec);
  const samplePf = cloneSpec.samplePlayProfile;
  const profileOk = samplePf?.variantId === sample.id;
  const noAgentic = !shouldUseAgenticRuntime(cloneSpec) && !cloneSpec.agenticModule;
  const expectedScene = EXPECTED_SCENE_BY_SAMPLE[sample.id];

  const coasterMode =
    cloneSpec.coaster?.mode ?? inferCoasterMode({ prompt: sample.prompt, sampleId: sample.id });
  const platformerMode =
    cloneSpec.platformer?.mode ??
    inferPlatformerMode({ prompt: sample.prompt, sampleId: sample.id, spec: cloneSpec });
  const customizationMode =
    cloneSpec.customization?.mode ??
    inferCustomizationMode({ prompt: sample.prompt, sampleId: sample.id });
  const puzzleMode =
    cloneSpec.puzzle?.mode ?? inferPuzzleMode({ prompt: sample.prompt, sampleId: sample.id });

  const base: Record<string, boolean> = {
    profilePreserved: profileOk,
    dedicatedScene: scene !== "AgenticScene",
    noAgenticFallback: noAgentic,
    expectedScene: expectedScene ? scene === expectedScene : true,
  };

  const perSample: Record<string, boolean> = {};

  switch (sample.id) {
    case "number-merge-2048":
      perSample.merge2048Mode = puzzleMode === "merge2048";
      perSample.colorfulNumbers = cloneSpec.puzzle?.targetScore === 2048;
      break;
    case "classic-xiangqi-board":
      perSample.xiangqiRuleset = cloneSpec.chess?.ruleset === "xiangqi";
      perSample.xiangqiBoard = cloneSpec.chess?.boardCols === 9 && cloneSpec.chess?.boardRows === 10;
      break;
    case "classic-international-chess":
      perSample.internationalRuleset = cloneSpec.chess?.ruleset === "international";
      perSample.internationalBoard = cloneSpec.chess?.boardCols === 8 && cloneSpec.chess?.boardRows === 8;
      break;
    case "zen-go-board":
      perSample.goRuleset = cloneSpec.chess?.ruleset === "go";
      perSample.goBoard = cloneSpec.chess?.boardCols === 19 && cloneSpec.chess?.boardRows === 19;
      break;
    case "jungle-animal-chess":
      perSample.jungleRuleset = cloneSpec.chess?.ruleset === "jungle";
      perSample.jungleBoard = cloneSpec.chess?.boardCols === 7 && cloneSpec.chess?.boardRows === 9;
      break;
    case "temple-relic-runner":
      perSample.templeEndlessRoad = coasterMode === "endlessRoad";
      perSample.templeDistanceGoal = (cloneSpec.coaster?.distanceGoal ?? 0) > 700;
      break;
    case "crashy-roads":
      perSample.endlessRoad = coasterMode === "endlessRoad";
      perSample.distanceGoal = (cloneSpec.coaster?.distanceGoal ?? 0) > 400;
      break;
    case "elastic-thief-2":
      perSample.stealthMode = platformerMode === "stealth";
      perSample.grappleEnabled = cloneSpec.platformer?.grappleEnabled === true;
      perSample.treasureHeist = samplePf?.platformer?.treasureHeist === true;
      perSample.laserSentries = samplePf?.platformer?.laserSentries === true;
      break;
    case "pottery-master-3d":
      perSample.potteryMode = customizationMode === "pottery";
      perSample.editGoal =
        (cloneSpec.customization?.editGoal ?? samplePf?.customization?.editGoal ?? 0) >= 6;
      perSample.potterySpin = (samplePf?.customization?.potterySpin ?? 0) >= 1.2;
      break;
    case "color-bloom":
      perSample.match3Mode = puzzleMode === "match3";
      perSample.bloomScale = (samplePf?.puzzle?.match3BloomScale ?? 0) >= 1.3;
      break;
    case "grow-a-garden":
      perSample.farmingGrid = (cloneSpec.farming?.cols ?? 0) >= 4;
      perSample.autoWater = samplePf?.farming?.autoWater === true;
      perSample.decorativeFence = samplePf?.farming?.decorativeFence === true;
      perSample.richCrops = (cloneSpec.farming?.crops?.length ?? 0) >= 3;
      perSample.startingCoins = (cloneSpec.farming?.startingCoins ?? 0) >= 50;
      break;
    case "smash-the-dummy":
      perSample.physicsCombo = (samplePf?.physics?.comboMultiplier ?? 0) >= 1.5;
      break;
    case "gun-merge-3d-zombie-apocalypse":
    case "blade-defender-merge":
      perSample.mergeGrid = samplePf?.towerDefense?.mergeGrid === true;
      break;
    default:
      break;
  }

  return { ...perSample, ...base };
}

export function playabilityChecksPass(checks: Record<string, boolean>): boolean {
  return Object.values(checks).every(Boolean);
}
