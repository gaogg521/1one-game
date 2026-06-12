import type { GameSpec } from "@/lib/game-spec";

export type FarmingCrop = {
  id: string;
  name: string;
  growSec: number;
  seedCost: number;
  sellPrice: number;
  color: string;
};

export type FarmingBlueprint = {
  cols: number;
  rows: number;
  startingCoins: number;
  harvestGoal: number;
  crops: FarmingCrop[];
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function buildFarmingBlueprint(opts: { prompt?: string; spec?: GameSpec }): FarmingBlueprint {
  const seed = hashSeed(opts.prompt ?? opts.spec?.title ?? "garden");
  const intensity = opts.spec?.director?.intensity ?? 0.5;
  return {
    cols: 4 + (seed % 2),
    rows: 4 + (seed % 2),
    startingCoins: 40 + (seed % 20),
    harvestGoal: Math.round(8 + intensity * 10),
    crops: [
      { id: "carrot", name: "胡萝卜", growSec: 4, seedCost: 5, sellPrice: 12, color: "#f97316" },
      { id: "tomato", name: "番茄", growSec: 6, seedCost: 8, sellPrice: 18, color: "#ef4444" },
      { id: "corn", name: "玉米", growSec: 8, seedCost: 12, sellPrice: 28, color: "#eab308" },
    ],
  };
}
