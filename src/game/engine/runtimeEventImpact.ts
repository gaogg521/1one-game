import Phaser from "phaser";
import type { GameSpec } from "@/lib/game-spec";
import type { CohesivePresentation } from "@/lib/cohesive-presentation";
import {
  juiceBoss,
  juiceCombo,
  juiceHit,
  juicePickup,
  themeParticleHex,
} from "@/game/engine/gameJuice";

export type RuntimeEventImpactKind = NonNullable<NonNullable<GameSpec["director"]>["events"]>[number]["type"];

export function applyRuntimeEventImpact(
  scene: Phaser.Scene,
  kind: RuntimeEventImpactKind,
  params: {
    x: number;
    y: number;
    title: string;
    spec: GameSpec;
    cohesive: CohesivePresentation;
    strength?: number;
    rng?: () => number;
  },
): void {
  const strength = params.strength ?? 0.6;
  const large = strength >= 0.72;
  const colorHex = themeParticleHex(params.spec);
  const textColorCss = params.cohesive.hud.accent;

  if (kind === "miniBoss" || kind === "finalBarrage") {
    juiceBoss(scene, {
      x: params.x,
      y: params.y,
      colorHex: params.spec.theme.hazardColor,
      text: params.title,
      textColorCss: params.cohesive.hud.danger,
      large,
      rng: params.rng,
    });
    return;
  }

  if (kind === "goalShift") {
    juiceCombo(scene, {
      x: params.x,
      y: params.y,
      colorHex,
      text: params.title,
      textColorCss,
      combo: Math.max(3, Math.round(3 + strength * 5)),
      large,
      rng: params.rng,
    });
    return;
  }

  if (kind === "coinRain" || kind === "goldenPickup" || kind === "breathingRoom") {
    juicePickup(scene, {
      x: params.x,
      y: params.y,
      colorHex: params.spec.theme.collectibleColor ?? colorHex,
      text: params.title,
      textColorCss,
      large,
      rng: params.rng,
    });
    return;
  }

  juiceHit(scene, {
    x: params.x,
    y: params.y,
    colorHex,
    text: params.title,
    textColorCss,
    large,
    rng: params.rng,
  });
}
