import Phaser from "phaser";
import { captureGameKeys } from "@/game/engine/phaser-input";
import type { GameSpec } from "@/lib/game-spec";
import type { AppLocale } from "@/i18n/routing";
import { canonicalSpecForPlay, resolveAssetProjectId } from "@/lib/astrocade-canonical-spec";
import {
  clearPhaserQaGame,
  markPhaserPlayReady,
  registerPhaserQaGame,
  resetPhaserPlayReady,
} from "@/game/engine/phaser-play-ready";
import { applyMinecraftThemeOverlay, isMinecraftLikeSpec } from "@/lib/minecraft-franchise";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import { CoasterScene } from "@/game/engine/CoasterScene";
import { PlatformerScene } from "@/game/engine/PlatformerScene";
import { PlayScene } from "@/game/engine/PlayScene";
import { ShooterScene } from "@/game/engine/ShooterScene";
import { TowerDefenseScene } from "@/game/engine/TowerDefenseScene";
import { PuzzleScene } from "@/game/engine/PuzzleScene";
import { FarmingScene } from "@/game/engine/FarmingScene";
import { PhysicsScene } from "@/game/engine/PhysicsScene";
import { ChessScene } from "@/game/engine/ChessScene";
import { CustomizationScene } from "@/game/engine/CustomizationScene";
import { StrategyScene } from "@/game/engine/StrategyScene";
import { AgenticScene } from "@/game/engine/AgenticScene";
import { createPhaserSceneForSpec } from "@/lib/game-templates/runtime";
import { resolveRuntimeAssets } from "@/lib/assets/asset-runtime-resolver";
import { readAssetManifestFromSession } from "@/lib/assets/asset-manifest-session.client";
import { GameSoundscape } from "@/game/audio/gameSoundscape";
import { thematicRootFrequencyHz } from "@/lib/cohesive-presentation";
import { bindAudioBootGestures, buildSceneCohesion } from "@/lib/scene-experience";

import type { RunnerLeaderboardSnapshot } from "@/lib/runner-leaderboard";
import type { RunnerRunRecap } from "@/lib/runner-leaderboard";

export type PhaserEndPayload = {
  score: number;
  won: boolean;
  runnerLeaderboard?: RunnerLeaderboardSnapshot;
  runnerRecap?: RunnerRunRecap;
};

export type CreatePhaserGameOptions = {
  /** 创作台解析后写入 sessionStorage 的参考图 data URL（仅会话） */
  referencePayloads?: RuntimeReferencePayload[];
  /** 游戏背景图 URL（文生图异步生成，不存在时回退纯色背景） */
  backgroundUrl?: string | null;
  /** 项目 ID，用于加载文生图 sprite（不存在时回退几何体） */
  projectId?: string;
  /** UI locale for in-game HUD copy */
  uiLocale?: AppLocale;
  /** 原始 prompt，用于 blueprint 推断（样品馆 / 用户项目） */
  promptHint?: string;
  /** OpenGame Browser Bench：保留 agenticModule，不 strip template-first normalize */
  preserveAgenticModule?: boolean;
};

export type PhaserGameHandle = {
  game: Phaser.Game;
  /** 在用户手势后启动程序化铺底（满足自动播放策略） */
  bootAudio: () => void;
};

export function createPhaserGame(
  parent: HTMLElement,
  spec: GameSpec,
  onEnd: (r: PhaserEndPayload) => void,
  opts?: CreatePhaserGameOptions,
): PhaserGameHandle {
  const ref =
    opts?.referencePayloads?.filter((p) => typeof p.dataUrl === "string" && p.dataUrl.startsWith("data:")) ??
    [];

  const uiLocale = opts?.uiLocale ?? "zh-Hans";
  const promptHint =
    opts?.promptHint?.trim() ||
    [spec.labels.subtitle, spec.title].filter(Boolean).join(" · ");
  resetPhaserPlayReady();
  const specPlay = applyMinecraftThemeOverlay(
    opts?.preserveAgenticModule
      ? spec
      : canonicalSpecForPlay(spec, promptHint, uiLocale, opts?.projectId),
  );
  const assetProjectId = resolveAssetProjectId(specPlay, opts?.projectId);
  const canonicalBackgroundUrl = assetProjectId ? `/game-bg/${assetProjectId}.png` : null;
  const presentation = buildSceneCohesion(specPlay);
  const assets = resolveRuntimeAssets({
    projectId: assetProjectId,
    /** 样品 profile 优先：忽略 GamePlayer 传入的 raw projectId 背景 */
    backgroundUrl: canonicalBackgroundUrl ?? opts?.backgroundUrl ?? null,
    manifest: typeof window !== "undefined" ? readAssetManifestFromSession() : null,
    themeBackground: specPlay.theme.backgroundColor,
  });
  const blockyAdventure = isMinecraftLikeSpec(specPlay);
  const soundscape = new GameSoundscape(
    presentation.musicProfile,
    thematicRootFrequencyHz(specPlay.theme),
    specPlay.director?.intensity ?? 0.55,
    { blocky: blockyAdventure, templateId: specPlay.templateId },
  );

  const scene = createPhaserSceneForSpec(specPlay, onEnd, ref, soundscape, {
    PlayScene,
    PlatformerScene,
    TowerDefenseScene,
    ShooterScene,
    CoasterScene,
    PuzzleScene,
    FarmingScene,
    PhysicsScene,
    ChessScene,
    CustomizationScene,
    StrategyScene,
    AgenticScene,
  });
  scene.backgroundUrl = assets.backgroundUrl ?? null;
  scene.projectId = assetProjectId ?? opts?.projectId ?? null;
  scene.uiLocale = uiLocale;

  const dpr =
    typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

  const config = {
    type: Phaser.AUTO,
    parent,
    width: Math.min(920, Math.max(640, parent.clientWidth || 920)),
    height: 560,
    backgroundColor: specPlay.theme.backgroundColor,
    resolution: dpr,
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    render: {
      // Must be true for canvas.toDataURL() to work with WebGL renderer.
      // Without this, WebGL clears the framebuffer after each frame → black covers.
      preserveDrawingBuffer: true,
      antialias: true,
      roundPixels: true,
    },
    scene: [scene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  } as Phaser.Types.Core.GameConfig;

  const game = new Phaser.Game(config);
  registerPhaserQaGame(game);

  /** 同步 Scene 兜底；异步 Scene 在 bootstrap 完成后会再次 mark */
  const fallbackReady = window.setTimeout(() => markPhaserPlayReady(), 4200);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    window.clearTimeout(fallbackReady);
    clearPhaserQaGame();
  });

  const bootAudio = () => {
    void soundscape.startInteractive();
  };

  const detachAudioGestures = bindAudioBootGestures({
    parent,
    bootAudio,
  });

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    detachAudioGestures();
    soundscape.dispose();
  });

  const kb = game.input.keyboard;
  if (kb) {
    captureGameKeys(kb);
  }

  return { game, bootAudio };
}
