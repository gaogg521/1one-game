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
import type { RhythmScene } from "@/game/engine/RhythmScene";
import type { SportsScene } from "@/game/engine/SportsScene";
import type { CardScene } from "@/game/engine/CardScene";
import type { FightingScene } from "@/game/engine/FightingScene";
import type { MobaScene } from "@/game/engine/MobaScene";
import type { HorrorScene } from "@/game/engine/HorrorScene";
import type { MahjongScene } from "@/game/engine/MahjongScene";
import type { TetrisScene } from "@/game/engine/TetrisScene";
import type { EndlessRunnerScene } from "@/game/engine/EndlessRunnerScene";
import type { FruitNinjaScene } from "@/game/engine/FruitNinjaScene";
import type { MahjongSolitaireScene } from "@/game/engine/MahjongSolitaireScene";
import type { DouDizhuScene } from "@/game/engine/DouDizhuScene";
import type { BreakoutScene } from "@/game/engine/BreakoutScene";
import type { Merge2048Scene } from "@/game/engine/Merge2048Scene";
import type { BlackjackScene } from "@/game/engine/BlackjackScene";
import type { ZhaJinHuaScene } from "@/game/engine/ZhaJinHuaScene";
import type { NiuNiuScene } from "@/game/engine/NiuNiuScene";
import type { ShuangKouScene } from "@/game/engine/ShuangKouScene";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import { resolveTemplateRuntime } from "@/lib/game-templates/registry";
import type { ArenaMode, GodotRuntimeKey, PhaserRuntimeFamily } from "@/lib/game-templates/types";

/** Godot 导出 JSON 附带的运行时解析（Godot 侧读取 _runtime） */
export type GodotRuntimePayload = {
  godotKey: GodotRuntimeKey;
  arenaMode?: ArenaMode;
  semanticTemplateId: string;
  /** 千人千面：从 prompt 派生的 seed（0..1），驱动运行时程序化差异化 */
  seed?: number;
  /** 推断的氛围，影响视觉色调 */
  mood?: string;
};

export function buildGodotRuntimePayload(spec: GameSpec): GodotRuntimePayload {
  const rt = resolveTemplateRuntime(spec.templateId);
  const payload: GodotRuntimePayload = {
    godotKey: rt.godot,
    arenaMode: rt.arenaMode,
    semanticTemplateId: spec.templateId,
  };
  // 千人千面：从 samplePlayProfile 或 director 推断 seed（enrich 阶段已写入）
  const spp = spec.samplePlayProfile as Record<string, unknown> | undefined;
  if (spp && typeof spp.seed === "number") {
    payload.seed = spp.seed;
  }
  if (spp && typeof spp.mood === "string") {
    payload.mood = spp.mood;
  }
  return payload;
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
    case "rhythm":
      return { ...spec, templateId: "rhythm" };
    case "sports":
      return { ...spec, templateId: "sports" };
    case "card":
      return { ...spec, templateId: "card" };
    case "fighting":
      return { ...spec, templateId: "fighting" };
    case "moba":
      return { ...spec, templateId: "moba" };
    case "horror":
      return { ...spec, templateId: "horror" };
    case "mahjong":
      return { ...spec, templateId: "mahjong" };
    case "tetris":
      return { ...spec, templateId: "tetris" };
    case "endlessRunner":
      return { ...spec, templateId: "endless-runner" };
    case "fruitNinja":
      return { ...spec, templateId: "fruit-ninja" };
    case "mahjongSolitaire":
      return { ...spec, templateId: "mahjong-solitaire" };
    case "douDizhu":
      return { ...spec, templateId: "dou-dizhu" };
    case "breakout":
      return { ...spec, templateId: "breakout" };
    case "merge2048":
      return { ...spec, templateId: "merge" };
    case "blackjack":
      return { ...spec, templateId: "blackjack" };
    case "zhaJinHua":
      return { ...spec, templateId: "zha-jin-hua" };
    case "niuNiu":
      return { ...spec, templateId: "niu-niu" };
    case "shuangKou":
      return { ...spec, templateId: "shuang-kou" };
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
  RhythmScene: typeof RhythmScene;
  SportsScene: typeof SportsScene;
  CardScene: typeof CardScene;
  FightingScene: typeof FightingScene;
  MobaScene: typeof MobaScene;
  HorrorScene: typeof HorrorScene;
  MahjongScene: typeof MahjongScene;
  TetrisScene: typeof TetrisScene;
  EndlessRunnerScene: typeof EndlessRunnerScene;
  FruitNinjaScene: typeof FruitNinjaScene;
  MahjongSolitaireScene: typeof MahjongSolitaireScene;
  DouDizhuScene: typeof DouDizhuScene;
  BreakoutScene: typeof BreakoutScene;
  Merge2048Scene: typeof Merge2048Scene;
  BlackjackScene: typeof BlackjackScene;
  ZhaJinHuaScene: typeof ZhaJinHuaScene;
  NiuNiuScene: typeof NiuNiuScene;
  ShuangKouScene: typeof ShuangKouScene;
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
  | RhythmScene
  | SportsScene
  | CardScene
  | FightingScene
  | MobaScene
  | HorrorScene
  | MahjongScene
  | TetrisScene
  | EndlessRunnerScene
  | FruitNinjaScene
  | MahjongSolitaireScene
  | DouDizhuScene
  | BreakoutScene
  | Merge2048Scene
  | BlackjackScene
  | ZhaJinHuaScene
  | NiuNiuScene
  | ShuangKouScene
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
    case "rhythm":
      return new imports.RhythmScene(playSpec, onEnd, sfxOpt);
    case "sports":
      return new imports.SportsScene(playSpec, onEnd, sfxOpt);
    case "card":
      return new imports.CardScene(playSpec, onEnd, sfxOpt);
    case "fighting":
      return new imports.FightingScene(playSpec, onEnd, sfxOpt);
    case "moba":
      return new imports.MobaScene(playSpec, onEnd, sfxOpt);
    case "horror":
      return new imports.HorrorScene(playSpec, onEnd, sfxOpt);
    case "mahjong":
      return new imports.MahjongScene(playSpec, onEnd, sfxOpt);
    case "tetris":
      return new imports.TetrisScene(playSpec, onEnd, sfxOpt);
    case "endlessRunner":
      return new imports.EndlessRunnerScene(playSpec, onEnd, sfxOpt);
    case "fruitNinja":
      return new imports.FruitNinjaScene(playSpec, onEnd, sfxOpt);
    case "mahjongSolitaire":
      return new imports.MahjongSolitaireScene(playSpec, onEnd, sfxOpt);
    case "douDizhu":
      return new imports.DouDizhuScene(playSpec, onEnd, sfxOpt);
    case "breakout":
      return new imports.BreakoutScene(playSpec, onEnd, sfxOpt);
    case "merge2048":
      return new imports.Merge2048Scene(playSpec, onEnd, sfxOpt);
    case "blackjack":
      return new imports.BlackjackScene(playSpec, onEnd, sfxOpt);
    case "zhaJinHua":
      return new imports.ZhaJinHuaScene(playSpec, onEnd, sfxOpt);
    case "niuNiu":
      return new imports.NiuNiuScene(playSpec, onEnd, sfxOpt);
    case "shuangKou":
      return new imports.ShuangKouScene(playSpec, onEnd, sfxOpt);
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
    rhythm: "RhythmScene",
    sports: "SportsScene",
    card: "CardScene",
    fighting: "FightingScene",
    moba: "MobaScene",
    horror: "HorrorScene",
    mahjong: "MahjongScene",
    tetris: "TetrisScene",
    endlessRunner: "EndlessRunnerScene",
    fruitNinja: "FruitNinjaScene",
    mahjongSolitaire: "MahjongSolitaireScene",
    douDizhu: "DouDizhuScene",
    breakout: "BreakoutScene",
    merge2048: "Merge2048Scene",
    blackjack: "BlackjackScene",
    zhaJinHua: "ZhaJinHuaScene",
    niuNiu: "NiuNiuScene",
    shuangKou: "ShuangKouScene",
    agentic: "AgenticScene",
  };
  return map[family] ?? "PlayScene";
}
