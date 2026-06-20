import type { GameSpec } from "@/lib/game-spec";

export type AvoiderBlueprint = NonNullable<GameSpec["avoider"]>;

type BulletPattern = NonNullable<GameSpec["avoider"]>["bulletPatterns"][number]["pattern"];

const PATTERNS: BulletPattern[] = ["aimed", "ring", "spiral", "random-burst", "wall", "cross", "fan", "gate"];

export function buildAvoiderBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
}): AvoiderBlueprint {
  const intensity = opts.spec?.director?.intensity ?? 0.65;

  const patternCount = Math.min(5, Math.round(3 + intensity * 2));
  const positions = [0.15, 0.38, 0.58, 0.76, 0.9];

  const bulletPatterns = Array.from({ length: patternCount }, (_, i) => ({
    at: positions[i],
    pattern: PATTERNS[i % PATTERNS.length],
    density: Math.min(5, Math.round(1 + i * 0.6 + intensity * 1.5)) as 1 | 2 | 3 | 4 | 5,
    speedMul: parseFloat((0.8 + i * 0.15 + intensity * 0.8).toFixed(2)),
  }));

  return {
    bulletPatterns,
    finalBarrageDurationMs: Math.round(8000 + intensity * 7000),
    grazingDistancePx: 18,
    grazingBonus: Math.round(3 + intensity * 5),
    focusModeEnabled: intensity > 0.5,
  };
}
