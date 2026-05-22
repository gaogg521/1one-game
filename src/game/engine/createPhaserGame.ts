import Phaser from "phaser";
import type { GameSpec } from "@/lib/game-spec";
import { enrichGameSpecForRuntime } from "@/lib/enrich-game-spec";
import { applyMinecraftThemeOverlay, isMinecraftLikeSpec } from "@/lib/minecraft-franchise";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import { PlayScene } from "@/game/engine/PlayScene";
import { PlatformerScene } from "@/game/engine/PlatformerScene";
import { TowerDefenseScene } from "@/game/engine/TowerDefenseScene";
import { ShooterScene } from "@/game/engine/ShooterScene";
import { GameSoundscape } from "@/game/audio/gameSoundscape";
import {
  buildCohesivePresentation,
  thematicRootFrequencyHz,
} from "@/lib/cohesive-presentation";

export type CreatePhaserGameOptions = {
  /** 创作台解析后写入 sessionStorage 的参考图 data URL（仅会话） */
  referencePayloads?: RuntimeReferencePayload[];
  /** 游戏背景图 URL（文生图异步生成，不存在时回退纯色背景） */
  backgroundUrl?: string | null;
  /** 项目 ID，用于加载文生图 sprite（不存在时回退几何体） */
  projectId?: string;
};

export type PhaserGameHandle = {
  game: Phaser.Game;
  /** 在用户手势后启动程序化铺底（满足自动播放策略） */
  bootAudio: () => void;
};

export function createPhaserGame(
  parent: HTMLElement,
  spec: GameSpec,
  onEnd: (r: { score: number; won: boolean }) => void,
  opts?: CreatePhaserGameOptions,
): PhaserGameHandle {
  const ref =
    opts?.referencePayloads?.filter((p) => typeof p.dataUrl === "string" && p.dataUrl.startsWith("data:")) ??
    [];

  const specPlay = applyMinecraftThemeOverlay(enrichGameSpecForRuntime(spec));
  const presentation = buildCohesivePresentation(specPlay);
  const blockyAdventure = isMinecraftLikeSpec(specPlay);
  const soundscape = new GameSoundscape(
    presentation.musicProfile,
    thematicRootFrequencyHz(specPlay.theme),
    specPlay.director?.intensity ?? 0.55,
    { blocky: blockyAdventure },
  );

  const scene =
    specPlay.templateId === "towerDefense"
      ? new TowerDefenseScene(specPlay, onEnd, ref, soundscape)
      : specPlay.templateId === "platformer"
        ? new PlatformerScene(specPlay, onEnd, soundscape)
        : specPlay.templateId === "shooter"
          ? new ShooterScene(specPlay, onEnd, ref, soundscape)
          : new PlayScene(specPlay, onEnd, soundscape);
  scene.backgroundUrl = opts?.backgroundUrl ?? null;
  scene.projectId = opts?.projectId ?? null;

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

  const bootAudio = () => {
    void soundscape.startInteractive();
  };

  let audioArmed = true;
  const onUserGesture = () => {
    if (!audioArmed) return;
    bootAudio();
    detachAudioGestures();
  };
  const detachAudioGestures = () => {
    audioArmed = false;
    parent.removeEventListener("pointerdown", onUserGesture);
    parent.removeEventListener("keydown", onUserGesture);
    window.removeEventListener("keydown", onUserGesture, true);
  };

  parent.addEventListener("pointerdown", onUserGesture, { passive: true });
  parent.addEventListener("keydown", onUserGesture);
  window.addEventListener("keydown", onUserGesture, true);

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    detachAudioGestures();
    soundscape.dispose();
  });

  return { game, bootAudio };
}
