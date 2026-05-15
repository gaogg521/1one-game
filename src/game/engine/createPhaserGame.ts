import Phaser from "phaser";
import type { GameSpec } from "@/lib/game-spec";
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

export function createPhaserGame(
  parent: HTMLElement,
  spec: GameSpec,
  onEnd: (r: { score: number; won: boolean }) => void,
  opts?: CreatePhaserGameOptions,
): Phaser.Game {
  const ref =
    opts?.referencePayloads?.filter((p) => typeof p.dataUrl === "string" && p.dataUrl.startsWith("data:")) ??
    [];

  const presentation = buildCohesivePresentation(spec);
  const soundscape = new GameSoundscape(
    presentation.musicProfile,
    thematicRootFrequencyHz(spec.theme),
    spec.director?.intensity ?? 0.55,
  );

  const scene =
    spec.templateId === "towerDefense"
      ? new TowerDefenseScene(spec, onEnd, ref, soundscape)
      : spec.templateId === "platformer"
        ? new PlatformerScene(spec, onEnd, soundscape)
        : spec.templateId === "shooter"
          ? new ShooterScene(spec, onEnd, soundscape)
          : new PlayScene(spec, onEnd, soundscape);

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: Math.min(920, Math.max(640, parent.clientWidth || 920)),
    height: 560,
    backgroundColor: spec.theme.backgroundColor,
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

  const onFirstPointer = () => {
    void soundscape.startInteractive();
    parent.removeEventListener("pointerdown", onFirstPointer);
  };
  parent.addEventListener("pointerdown", onFirstPointer, { passive: true });

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    parent.removeEventListener("pointerdown", onFirstPointer);
    soundscape.dispose();
  });

  return game;
}
