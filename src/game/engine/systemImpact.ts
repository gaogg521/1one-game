import Phaser from "phaser";
import type { GameSpec } from "@/lib/game-spec";
import type { CohesivePresentation } from "@/lib/cohesive-presentation";
import { juiceBoss, juiceCombo, juicePickup, themeParticleHex } from "@/game/engine/gameJuice";

export type SystemImpactSource = "skill" | "powerup";

export function applySystemImpact(
  scene: Phaser.Scene,
  source: SystemImpactSource,
  params: {
    effect: string;
    label: string;
    x: number;
    y: number;
    spec: GameSpec;
    cohesive: CohesivePresentation;
    rng?: () => number;
  },
): void {
  const effect = params.effect;
  const common = {
    x: params.x,
    y: params.y,
    text: params.label,
    textColorCss: params.cohesive.hud.accent,
    rng: params.rng,
  };

  if (effect === "bomb") {
    juiceBoss(scene, {
      ...common,
      colorHex: themeParticleHex(params.spec),
      large: true,
    });
    return;
  }

  if (effect === "doubleScore" || effect === "dash") {
    juiceCombo(scene, {
      ...common,
      colorHex: params.spec.theme.collectibleColor ?? themeParticleHex(params.spec),
      combo: source === "skill" ? 4 : 3,
      large: source === "skill",
    });
    return;
  }

  juicePickup(scene, {
    ...common,
    colorHex: effect === "heal" ? "#4ade80" : params.cohesive.hud.accent2,
    large: effect === "shield" || effect === "timeSlow",
  });
}
