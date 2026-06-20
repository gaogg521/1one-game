import type { GameSpec } from "@/lib/game-spec";

export type SurvivorBlueprint = NonNullable<GameSpec["survivor"]>;

export function buildSurvivorBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
}): SurvivorBlueprint {
  const intensity = opts.spec?.director?.intensity ?? 0.6;

  const eliteCount = Math.max(1, Math.round(1 + intensity * 3));
  const positions = [0.35, 0.6, 0.8, 0.92];

  const eliteWaves = Array.from({ length: Math.min(eliteCount, positions.length) }, (_, i) => ({
    at: positions[i],
    label: i === eliteCount - 1 ? "最终精英波" : `精英波 ${i + 1}`,
    hpMul: parseFloat((2 + i * 0.8 + intensity * 1.2).toFixed(1)),
    speedMul: parseFloat((1.2 + i * 0.2 + intensity * 0.5).toFixed(1)),
    count: Math.round(2 + i + intensity * 3),
  }));

  return {
    eliteWaves,
    breathingRoomPausesSpawns: true,
    supplyDrops: [
      { type: "heal", durationMs: 0 },
      { type: "shield", durationMs: Math.round(3000 + intensity * 3000) },
    ],
    maxHazardsOnScreen: Math.round(8 + intensity * 16),
  };
}
