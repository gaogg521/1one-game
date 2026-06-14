import type { GameSpec } from "@/lib/game-spec";
import { shouldUseAgenticRuntime } from "@/lib/agentic/game-module";
import type { AgenticScene } from "@/game/engine/AgenticScene";
import type { StrategyScene } from "@/game/engine/StrategyScene";
import type { ChessScene } from "@/game/engine/ChessScene";
import type { CoasterScene } from "@/game/engine/CoasterScene";
import type { CustomizationScene } from "@/game/engine/CustomizationScene";
import type { FarmingScene } from "@/game/engine/FarmingScene";
import type { PhysicsScene } from "@/game/engine/PhysicsScene";
import type { PlatformerScene } from "@/game/engine/PlatformerScene";
import type { PlayScene } from "@/game/engine/PlayScene";
import type { PuzzleScene } from "@/game/engine/PuzzleScene";
import type { ShooterScene } from "@/game/engine/ShooterScene";
import type { TowerDefenseScene } from "@/game/engine/TowerDefenseScene";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import { resolveTemplateRuntime } from "@/lib/game-templates/registry";
import type { ArenaMode, GodotRuntimeKey, PhaserRuntimeFamily } from "@/lib/game-templates/types";

/** Godot 导出 JSON 附带的运行时解析（Godot 侧读取 _runtime） */
export type GodotRuntimePayload = {
  godotKey: GodotRuntimeKey;
  arenaMode?: ArenaMode;
  semanticTemplateId: string;
};

export function buildGodotRuntimePayload(spec: GameSpec): GodotRuntimePayload {
  const rt = resolveTemplateRuntime(spec.templateId);
  return {
    godotKey: rt.godot,
    arenaMode: rt.arenaMode,
    semanticTemplateId: spec.templateId,
  };
}

/** 写入 spec/gamespec.json 的 Godot 导出体 */
export function specJsonForGodotExport(spec: GameSpec): Record<string, unknown> {
  return {
    ...spec,
    _runtime: buildGodotRuntimePayload(spec),
  };
}

/**
 * Phaser 运行时族映射。语义模板（farming/puzzle 等）保留 title/labels/director，
 * 仅 arena 族回落为 avoider/collector/survivor 子模式。
 */
export function toPhaserPlaySpec(spec: GameSpec): GameSpec {
  const rt = resolveTemplateRuntime(spec.templateId);
  switch (rt.phaser) {
    case "arena":
      return { ...spec, templateId: rt.arenaMode ?? "avoider" };
    case "platformer":
      return { ...spec, templateId: "platformer" };
    case "towerDefense":
      return { ...spec, templateId: "towerDefense" };
    case "shooter":
      return { ...spec, templateId: "shooter" };
    case "coaster":
      return { ...spec, templateId: "coaster" };
    case "puzzle":
      return { ...spec, templateId: "puzzle" };
    case "farming":
      return { ...spec, templateId: "farming" };
    case "physics":
      return { ...spec, templateId: "physics" };
    case "chess":
      return { ...spec, templateId: "chess" };
    case "customization":
      return { ...spec, templateId: "customization" };
    case "strategy":
      return { ...spec, templateId: "strategy" };
    case "agentic":
      return spec;
    default:
      return spec;
  }
}

export function phaserFamilyFor(spec: GameSpec): PhaserRuntimeFamily {
  if (shouldUseAgenticRuntime(spec)) return "agentic";
  return resolveTemplateRuntime(spec.templateId).phaser;
}

export type PhaserSceneImports = {
  PlayScene: typeof PlayScene;
  PlatformerScene: typeof PlatformerScene;
  TowerDefenseScene: typeof TowerDefenseScene;
  ShooterScene: typeof ShooterScene;
  CoasterScene: typeof CoasterScene;
  PuzzleScene: typeof PuzzleScene;
  FarmingScene: typeof FarmingScene;
  PhysicsScene: typeof PhysicsScene;
  ChessScene: typeof ChessScene;
  CustomizationScene: typeof CustomizationScene;
  StrategyScene: typeof StrategyScene;
  AgenticScene: typeof AgenticScene;
};

export type PhaserSceneInstance =
  | PlayScene
  | PlatformerScene
  | TowerDefenseScene
  | ShooterScene
  | CoasterScene
  | PuzzleScene
  | FarmingScene
  | PhysicsScene
  | ChessScene
  | CustomizationScene
  | StrategyScene
  | AgenticScene;

export function createPhaserSceneForSpec(
  spec: GameSpec,
  onEnd: (r: { score: number; won: boolean }) => void,
  ref: RuntimeReferencePayload[],
  soundscape: GameSoundscape | null,
  imports: PhaserSceneImports,
): PhaserSceneInstance {
  const family = phaserFamilyFor(spec);
  const playSpec = toPhaserPlaySpec(spec);
  const sfxOpt = soundscape ?? undefined;
  const sfxNull = soundscape ?? null;

  switch (family) {
    case "agentic":
      return new imports.AgenticScene(playSpec, onEnd, sfxNull);
    case "towerDefense":
      return new imports.TowerDefenseScene(playSpec, onEnd, ref, sfxOpt);
    case "platformer":
      return new imports.PlatformerScene(playSpec, onEnd, sfxOpt);
    case "shooter":
      return new imports.ShooterScene(playSpec, onEnd, ref, sfxOpt);
    case "coaster":
      return new imports.CoasterScene(playSpec, onEnd, sfxNull);
    case "puzzle":
      return new imports.PuzzleScene(playSpec, onEnd, sfxNull);
    case "farming":
      return new imports.FarmingScene(playSpec, onEnd, sfxNull);
    case "physics":
      return new imports.PhysicsScene(playSpec, onEnd, sfxNull);
    case "chess":
      return new imports.ChessScene(playSpec, onEnd, sfxNull);
    case "customization":
      return new imports.CustomizationScene(playSpec, onEnd, sfxNull);
    case "strategy":
      return new imports.StrategyScene(playSpec, onEnd, sfxNull);
    case "arena":
    default:
      return new imports.PlayScene(playSpec, onEnd, sfxOpt);
  }
}

export function isGodotExportSupportedForTemplate(templateId: string): boolean {
  return resolveTemplateRuntime(templateId).godotExport;
}

/** Phase 4 QA：模板 → 期望 Phaser 场景类名 */
export function expectedPhaserSceneName(spec: GameSpec): string {
  const family = phaserFamilyFor(spec);
  const map: Record<PhaserRuntimeFamily, string> = {
    arena: "PlayScene",
    platformer: "PlatformerScene",
    towerDefense: "TowerDefenseScene",
    shooter: "ShooterScene",
    coaster: "CoasterScene",
    puzzle: "PuzzleScene",
    farming: "FarmingScene",
    physics: "PhysicsScene",
    chess: "ChessScene",
    customization: "CustomizationScene",
    strategy: "StrategyScene",
    agentic: "AgenticScene",
  };
  return map[family] ?? "PlayScene";
}
