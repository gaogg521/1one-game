import { applyHardQualityDefaults } from "../src/lib/game-quality";
import type { GameSpec } from "../src/lib/game-spec";
import { resolveCloneBatchGateOk } from "../src/lib/qa/competitor-gates-summary";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const baseFarmingSpec: GameSpec = {
  version: 1,
  templateId: "farming",
  title: "契约农场",
  theme: {
    backgroundColor: "#162013",
    playerColor: "#4ade80",
    hazardColor: "#92400e",
    collectibleColor: "#fde68a",
    particleTint: "#bbf7d0",
  },
  gameplay: {
    playerSpeed: 180,
    hazardSpeed: 120,
    spawnIntervalMs: 500,
    winScore: 8,
    lives: 2,
    arenaPadding: 32,
    jumpStrength: 360,
    gravity: 900,
    startingCoins: 50,
    baseHealth: 32,
  },
  labels: {
    player: "农夫",
    hazard: "害虫",
    collectible: "种子",
    subtitle: "低初始金币契约样本",
  },
  farming: {
    plots: 9,
    startingCoins: 42,
    cropStages: ["seed", "sprout", "harvest"],
    seedCost: 12,
    harvestValue: 28,
    growMs: 2400,
    autoWaterEveryMs: 3200,
  },
};

const upgraded = applyHardQualityDefaults(baseFarmingSpec, "做一个农场经营游戏");

assert(upgraded.gameplay.startingCoins >= 120, "hard quality should raise farming gameplay.startingCoins");
assert(upgraded.farming, "hard quality should preserve farming blueprint");
assert(
  upgraded.farming!.startingCoins === upgraded.gameplay.startingCoins,
  `farming.startingCoins should sync with gameplay.startingCoins, got ${upgraded.farming!.startingCoins} vs ${upgraded.gameplay.startingCoins}`,
);

const cloneGateOk = resolveCloneBatchGateOk({
  commandOk: false,
  summary: {
    at: "2026-06-16T15:51:19.416Z",
    batch: "all",
    total: 17,
    passCount: 17,
    pass: true,
    rows: [],
  },
});

assert(cloneGateOk, "clone batch gate should trust an explicit all-batch passing summary when wrapper command reports a false negative");

console.log("[OK] qa-game-quality-contracts");
