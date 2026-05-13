import Phaser from "phaser";
import type { GameSpec } from "@/lib/game-spec";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import { PlayScene } from "@/game/engine/PlayScene";
import { PlatformerScene } from "@/game/engine/PlatformerScene";
import { TowerDefenseScene } from "@/game/engine/TowerDefenseScene";

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
  const ref = opts?.referencePayloads?.filter((p) => typeof p.dataUrl === "string" && p.dataUrl.startsWith("data:")) ?? [];
  const scene =
    spec.templateId === "towerDefense"
      ? new TowerDefenseScene(spec, onEnd, ref)
      : spec.templateId === "platformer"
        ? new PlatformerScene(spec, onEnd)
        : new PlayScene(spec, onEnd);
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
    scene: [scene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };
  return new Phaser.Game(config);
}
