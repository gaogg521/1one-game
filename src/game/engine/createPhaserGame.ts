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
import { RhythmScene } from "@/game/engine/RhythmScene";
import { SportsScene } from "@/game/engine/SportsScene";
import { CardScene } from "@/game/engine/CardScene";
import { FightingScene } from "@/game/engine/FightingScene";
import { MobaScene } from "@/game/engine/MobaScene";
import { HorrorScene } from "@/game/engine/HorrorScene";
import { MahjongScene } from "@/game/engine/MahjongScene";
import { TetrisScene } from "@/game/engine/TetrisScene";
import { EndlessRunnerScene } from "@/game/engine/EndlessRunnerScene";
import { FruitNinjaScene } from "@/game/engine/FruitNinjaScene";
import { MahjongSolitaireScene } from "@/game/engine/MahjongSolitaireScene";
import { DouDizhuScene } from "@/game/engine/DouDizhuScene";
import { BreakoutScene } from "@/game/engine/BreakoutScene";
import { Merge2048Scene } from "@/game/engine/Merge2048Scene";
import { AgenticScene } from "@/game/engine/AgenticScene";
import { createPhaserSceneForSpec } from "@/lib/game-templates/runtime";
import { resolveRuntimeAssets } from "@/lib/assets/asset-runtime-resolver";
import { readAssetManifestFromSession } from "@/lib/assets/asset-manifest-session.client";
import { GameSoundscape } from "@/game/audio/gameSoundscape";
import { thematicRootFrequencyHz, resolveAssetStyle } from "@/lib/cohesive-presentation";
import { bindAudioBootGestures, buildSceneCohesion } from "@/lib/scene-experience";
import { setSfxPack } from "@/game/audio/webBleeps";

import type { RunnerLeaderboardSnapshot } from "@/lib/runner-leaderboard";
import type { RunnerRunRecap } from "@/lib/runner-leaderboard";
import { getDifficultyBias } from "@/game/engine/win-rate-guard";

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
  /**
   * 创作台预览模式：游戏结束时自动重启而非显示结算画面。
   * onEnd 回调不会被调用，让玩家持续观察游戏效果。
   */
  previewMode?: boolean;
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
  // Win Rate Guard: apply difficulty bias from prior play history
  if (!opts?.previewMode) {
    const bias = getDifficultyBias(specPlay.templateId);
    if (bias !== 0 && specPlay.gameplay) {
      const g = specPlay.gameplay as Record<string, unknown>;
      // bias > 0 → too hard → reduce hazard speed, increase lives/grace
      // bias < 0 → too easy → increase hazard speed
      if (typeof g.hazardSpeed === "number") g.hazardSpeed = Math.round(g.hazardSpeed * (1 - bias * 0.5));
      if (typeof g.enemySpeed === "number") g.enemySpeed = Math.round(g.enemySpeed * (1 - bias * 0.5));
      if (typeof g.spawnRate === "number") g.spawnRate = Math.max(0.5, (g.spawnRate as number) * (1 + bias * 0.4));
      if (bias > 0.1 && typeof g.lives === "number") g.lives = Math.min((g.lives as number) + 1, 7);
    }
  }

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
    { blocky: blockyAdventure, templateId: specPlay.templateId, projectId: opts?.projectId },
  );

  // SFX 调色（按 templateId 优先，再按 assetStyle / musicProfile 决定 osc 波形偏好和反射尾比例）
  const sfxStyle = resolveAssetStyle(specPlay);
  const templateId = specPlay.templateId;
  setSfxPack(
    // 按模板类型第一优先级
    templateId === "towerDefense" || templateId === "strategy"
      ? "pulse"           // 节奏感强、有层次的防御类
      : templateId === "platformer" || templateId === "coaster"
        ? "blocky"        // 横版跳跃/过山车保持 8-bit 感
        : templateId === "farming" || templateId === "puzzle"
          ? "organic"     // 农场/消除偏舒缓
          : templateId === "chess"
            ? "minimal"   // 棋类极简
            : templateId === "rhythm"
              ? "chime"   // 节奏音游清脆
              : templateId === "sports"
                ? "whistle" // 体育哨声
                : templateId === "card"
                  ? "shuffle" // 卡牌翻动
                  : templateId === "fighting"
                    ? "impact" // 格斗打击
                    : templateId === "moba"
                      ? "laser" // MOBA 激光
                      : templateId === "horror"
                        ? "drone" // 恐怖低沉
                        // 以下按 assetStyle / musicProfile 细化
                        : sfxStyle === "blocky-pixel"
                          ? "blocky"
                          : sfxStyle === "neon-cyber" || sfxStyle === "bullet-hell"
                            ? "neon"
                            : sfxStyle === "nature-organic" || sfxStyle === "wuxia-flight" || sfxStyle === "paper-craft"
                              ? "organic"
                              : presentation.musicProfile === "minimal"
                    ? "minimal"
                    : presentation.musicProfile === "pulse"
                      ? "pulse"
                      : "arcade",
  );

  // 预览模式：游戏结束时自动重启，不触发结算 overlay
  // 使用 ref 对象绕过 forward-declaration 限制
  const gameRef = { current: null as Phaser.Game | null };
  const effectiveOnEnd = opts?.previewMode
    ? (_r: PhaserEndPayload) => {
        // 延迟 800ms 让死亡动画播完，然后重启所有活动场景
        window.setTimeout(() => {
          try {
            const g = gameRef.current;
            if (!g) return;
            g.scene.getScenes(true).forEach((s) => {
              g.scene.start(s.sys.settings.key as string);
            });
          } catch {
            // game 已销毁，忽略
          }
        }, 800);
      }
    : onEnd;

  const scene = createPhaserSceneForSpec(specPlay, effectiveOnEnd, ref, soundscape, {
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
    RhythmScene,
    SportsScene,
    CardScene,
    FightingScene,
    MobaScene,
    HorrorScene,
    MahjongScene,
    TetrisScene,
    EndlessRunnerScene,
    FruitNinjaScene,
    MahjongSolitaireScene,
    DouDizhuScene,
    BreakoutScene,
    Merge2048Scene,
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
    width: Math.min(1280, Math.max(640, parent.clientWidth || 920)),
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
  gameRef.current = game;
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
