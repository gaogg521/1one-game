import Phaser from "phaser";
import type { GameSpec } from "@/lib/game-spec";
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

  const specPlay = applyMinecraftThemeOverlay(spec);
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
          ? new ShooterScene(specPlay, onEnd, soundscape)
          : new PlayScene(specPlay, onEnd, soundscape);

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: Math.min(920, Math.max(640, parent.clientWidth || 920)),
    height: 560,
    backgroundColor: specPlay.theme.backgroundColor,
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
    },
    scene: [scene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

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
