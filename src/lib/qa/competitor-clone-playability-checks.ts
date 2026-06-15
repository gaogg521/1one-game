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
  "smash-the-dummy": "PhysicsScene",
  "rail-in-air": "CoasterScene",
  "grow-a-garden": "FarmingScene",
  "color-bloom": "PuzzleScene",
  "whimsy-differences": "PuzzleScene",
  "gun-merge-3d-zombie-apocalypse": "TowerDefenseScene",
  "ultimate-3d-chess": "ChessScene",
  "elastic-thief-2": "PlatformerScene",
  "state-conquest": "StrategyScene",
  "tiny-planet-chopper": "ShooterScene",
  "blade-defender-merge": "TowerDefenseScene",
  "car-color-palette": "CustomizationScene",
  "blocky-sniper-hunter": "ShooterScene",
  "memory-match-mania": "PuzzleScene",
  "kids-puzzle": "PuzzleScene",
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
    case "crashy-roads":
      perSample.endlessRoad = coasterMode === "endlessRoad";
      perSample.distanceGoal = (cloneSpec.coaster?.distanceGoal ?? 0) > 400;
      break;
    case "rail-in-air":
      perSample.coasterMode = coasterMode === "coaster";
      perSample.speedBoost = (samplePf?.coaster?.speedBoost ?? 0) >= 1.1;
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
    case "car-color-palette":
      perSample.carPaintMode = customizationMode === "carPaint";
      perSample.editGoal = (cloneSpec.customization?.editGoal ?? 0) >= 5;
      break;
    case "color-bloom":
      perSample.match3Mode = puzzleMode === "match3";
      perSample.bloomScale = (samplePf?.puzzle?.match3BloomScale ?? 0) >= 1.3;
      break;
    case "whimsy-differences":
      perSample.spotDifference = puzzleMode === "spotDifference";
      perSample.whimsicalPanels = samplePf?.puzzle?.whimsicalPanels === true;
      break;
    case "memory-match-mania":
      perSample.memoryMatch = puzzleMode === "memoryMatch";
      break;
    case "kids-puzzle":
      perSample.jigsawMode = puzzleMode === "jigsaw";
      perSample.kidsJigsaw = samplePf?.puzzle?.kidsJigsaw === true;
      break;
    case "state-conquest":
      perSample.strategyNodes = (cloneSpec.strategy?.nodes?.length ?? 0) >= 4;
      perSample.rushMode = samplePf?.strategy?.rushMode === true;
      break;
    case "ultimate-3d-chess":
      perSample.legalMoves = samplePf?.chess?.showLegalMoves === true;
      break;
    case "grow-a-garden":
      perSample.farmingGrid = (cloneSpec.farming?.cols ?? 0) >= 4;
      perSample.autoWater = samplePf?.farming?.autoWater === true;
      break;
    case "smash-the-dummy":
      perSample.physicsCombo = (samplePf?.physics?.comboMultiplier ?? 0) >= 1.5;
      break;
    case "gun-merge-3d-zombie-apocalypse":
    case "blade-defender-merge":
      perSample.mergeGrid = samplePf?.towerDefense?.mergeGrid === true;
      break;
    case "tiny-planet-chopper":
      perSample.orbitChopper = samplePf?.shooter?.orbitChopper === true;
      break;
    case "blocky-sniper-hunter":
      perSample.sniperScope = samplePf?.shooter?.sniperScope === true;
      break;
    default:
      break;
  }

  return { ...perSample, ...base };
}

export function playabilityChecksPass(checks: Record<string, boolean>): boolean {
  return Object.values(checks).every(Boolean);
}
