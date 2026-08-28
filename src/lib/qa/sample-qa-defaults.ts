/**
 * 样品馆 QA 默认推导：门禁随 SAMPLES 自动对齐，无需为每个新样品手写清单。
 * 仅当某款需要特殊点击坐标 / 深度字段时，再写 override。
 */
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import { SAMPLES, type Sample } from "@/lib/samples";
import { buildCanonicalAstrocadeSpec } from "@/lib/astrocade-canonical-spec";

export type GameplayDepthChange = "increased" | "decreased" | "changed";

export type GameplayDepthExpect = {
  field: string;
  change: GameplayDepthChange;
  minDelta?: number;
};

export type DefaultInteractionKind =
  | "click-center"
  | "click-upper"
  | "click-lower"
  | "arrow-right"
  | "arrow-left"
  | "space";

export type DefaultInteraction = {
  interaction: DefaultInteractionKind;
  animated?: boolean;
  clickRel?: { x: number; y: number };
  clickBurst?: number;
  clickRel2?: { x: number; y: number };
};

export function expectedSceneForSample(sample: Sample): string {
  return expectedPhaserSceneName(
    buildCanonicalAstrocadeSpec(sample.prompt, "zh-Hans", { sampleId: sample.id }),
  );
}

/** 持续动画 Scene 族 — idle burst 对比 */
const ANIMATED_SCENES = new Set([
  "CoasterScene",
  "PlatformerScene",
  "TowerDefenseScene",
  "PhysicsScene",
  "CustomizationScene",
  "EndlessRunnerScene",
  "ShooterScene",
]);

export function isAnimatedScene(scene: string): boolean {
  return ANIMATED_SCENES.has(scene);
}

/** 按 Phaser Scene 给默认交互；单样品特殊坐标放 SAMPLE_GAMEPLAY_OVERRIDES */
export function defaultInteractionForScene(scene: string): DefaultInteraction {
  switch (scene) {
    case "CoasterScene":
    case "EndlessRunnerScene":
      return { interaction: "arrow-left", animated: true, clickBurst: 8 };
    case "PlatformerScene":
      return { interaction: "arrow-right", animated: true, clickBurst: 8 };
    case "TowerDefenseScene":
      return {
        interaction: "click-lower",
        animated: true,
        clickRel: { x: 0.71, y: 0.84 },
        clickRel2: { x: 0.81, y: 0.84 },
        clickBurst: 2,
      };
    case "PhysicsScene":
      return {
        interaction: "click-center",
        animated: true,
        clickRel: { x: 0.5, y: 0.46 },
        clickBurst: 3,
      };
    case "CustomizationScene":
      return {
        interaction: "click-center",
        animated: true,
        clickRel: { x: 0.5, y: 0.46 },
        clickBurst: 3,
      };
    case "ChessScene":
      return { interaction: "click-center", clickBurst: 2 };
    case "FarmingScene":
      return { interaction: "click-center", clickRel: { x: 0.38, y: 0.24 }, clickBurst: 2 };
    case "PuzzleScene":
      return { interaction: "click-center", clickRel: { x: 0.38, y: 0.52 }, clickBurst: 2 };
    case "Merge2048Scene":
      return { interaction: "arrow-right", clickBurst: 2 };
    default:
      return {
        interaction: "click-center",
        clickBurst: 2,
        animated: isAnimatedScene(scene) || undefined,
      };
  }
}

/** 按 Scene 默认深度字段；单样品特殊字段放 GAMEPLAY_DEPTH_OVERRIDES */
export function defaultDepthForScene(scene: string): GameplayDepthExpect {
  switch (scene) {
    case "ChessScene":
      return { field: "moves", change: "increased", minDelta: 1 };
    case "CoasterScene":
    case "EndlessRunnerScene":
      return { field: "coasterDistance", change: "increased", minDelta: 1 };
    case "PlatformerScene":
      return { field: "playerX", change: "changed", minDelta: 1 };
    case "TowerDefenseScene":
    case "ShooterScene":
    case "StrategyScene":
      return { field: "qaTouches", change: "increased", minDelta: 1 };
    case "PhysicsScene":
      return { field: "hits", change: "increased", minDelta: 1 };
    case "FarmingScene":
      return { field: "plantedTiles", change: "increased", minDelta: 1 };
    case "PuzzleScene":
    case "Merge2048Scene":
      return { field: "puzzleMoves", change: "increased", minDelta: 1 };
    case "CustomizationScene":
      return { field: "potteryHeight", change: "increased", minDelta: 1 };
    default:
      return { field: "qaTouches", change: "increased", minDelta: 1 };
  }
}

export function buildExpectedSceneBySample(): Record<string, string> {
  return Object.fromEntries(SAMPLES.map((s) => [s.id, expectedSceneForSample(s)]));
}
