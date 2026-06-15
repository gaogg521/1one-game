import type { GameSpec } from "@/lib/game-spec";
import { buildCoasterBlueprint } from "@/lib/coaster-blueprint";
import { buildCustomizationBlueprint } from "@/lib/customization-blueprint";
import { buildFarmingBlueprint } from "@/lib/farming-blueprint";
import { buildPlatformerBlueprint } from "@/lib/platformer-blueprint";
import { buildPuzzleBlueprint } from "@/lib/puzzle-blueprint";
import { buildStrategyBlueprint } from "@/lib/strategy-blueprint";
import type { Sample } from "@/lib/samples";
import type { SamplePlayProfile } from "@/lib/sample-play-profiles/types";

export type SampleProfileDef = {
  variantId: string;
  apply: (spec: GameSpec, sample: Sample, prompt: string) => GameSpec;
};

function withProfile(spec: GameSpec, profile: SamplePlayProfile): GameSpec {
  return { ...spec, samplePlayProfile: profile };
}

/** 17 款 Astrocade 样品 — 独立定制逻辑（写入 specJson，duplicate 可继承） */
export const SAMPLE_PLAY_PROFILES: Record<string, SampleProfileDef> = {
  "smash-the-dummy": {
    variantId: "smash-the-dummy",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#1e1b4b",
            playerColor: "#f97316",
            hazardColor: "#ef4444",
            collectibleColor: "#fbbf24",
            particleTint: "#fb923c",
          },
          gameplay: { ...spec.gameplay, winScore: Math.min(spec.gameplay.winScore ?? 100, 200) },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        {
          variantId: "smash-the-dummy",
          physics: { hitImpulse: 1.35, comboWindowMs: 1400, comboMultiplier: 1.8, targetHits: 420 },
        },
      ),
  },
  "rail-in-air": {
    variantId: "rail-in-air",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#0c4a6e",
            playerColor: "#38bdf8",
            hazardColor: "#f97316",
            collectibleColor: "#fde047",
            particleTint: "#7dd3fc",
          },
          coaster: buildCoasterBlueprint({ prompt, spec, sampleId: sample.id }),
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "rail-in-air", coaster: { speedBoost: 1.12, bankIntensity: 1.35 } },
      ),
  },
  "grow-a-garden": {
    variantId: "grow-a-garden",
    apply: (spec, sample, prompt) => {
      const farm = buildFarmingBlueprint({ prompt, spec });
      return withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#166534",
            playerColor: "#fef08a",
            hazardColor: "#854d0e",
            collectibleColor: "#facc15",
            particleTint: "#86efac",
          },
          farming: {
            ...farm,
            cols: Math.min(farm.cols + 1, 6),
            rows: Math.min(farm.rows + 1, 6),
            harvestGoal: Math.round(farm.harvestGoal * 1.15),
            startingCoins: farm.startingCoins + 15,
            crops: [
              { id: "carrot", name: "胡萝卜", growSec: 3.5, seedCost: 4, sellPrice: 11, color: "#f97316" },
              { id: "tomato", name: "番茄", growSec: 5, seedCost: 7, sellPrice: 16, color: "#ef4444" },
              { id: "corn", name: "玉米", growSec: 6.5, seedCost: 10, sellPrice: 24, color: "#eab308" },
              { id: "sunflower", name: "向日葵", growSec: 4.5, seedCost: 6, sellPrice: 14, color: "#facc15" },
            ],
          },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        {
          variantId: "grow-a-garden",
          farming: { autoWater: true, harvestGoalBoost: 1.15, decorativeFence: true, gridBoost: 1 },
        },
      );
    },
  },
  "color-bloom": {
    variantId: "color-bloom",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#fdf2f8",
            playerColor: "#f472b6",
            hazardColor: "#a78bfa",
            collectibleColor: "#fb7185",
            particleTint: "#f9a8d4",
          },
          puzzle: buildPuzzleBlueprint({ prompt, spec, sampleId: sample.id }),
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "color-bloom", puzzle: { match3BloomScale: 1.45 } },
      ),
  },
  "whimsy-differences": {
    variantId: "whimsy-differences",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#312e81",
            playerColor: "#c4b5fd",
            hazardColor: "#f472b6",
            collectibleColor: "#fde047",
            particleTint: "#a78bfa",
          },
          puzzle: { ...buildPuzzleBlueprint({ prompt, spec, sampleId: sample.id }), targetScore: 8, moveLimit: 120 },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "whimsy-differences", puzzle: { whimsicalPanels: true, diffCount: 8 } },
      ),
  },
  "gun-merge-3d-zombie-apocalypse": {
    variantId: "gun-merge-3d-zombie-apocalypse",
    apply: (spec, sample) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#14532d",
            playerColor: "#4ade80",
            hazardColor: "#ef4444",
            collectibleColor: "#fbbf24",
            particleTint: "#86efac",
          },
          labels: { ...spec.labels, subtitle: sample.subtitle },
          gameplay: {
            ...spec.gameplay,
            startingCoins: Math.max(spec.gameplay.startingCoins ?? 95, 140),
          },
        },
        {
          variantId: "gun-merge-3d-zombie-apocalypse",
          towerDefense: { mergeGrid: true, mergeBonusCoins: 35 },
        },
      ),
  },
  "ultimate-3d-chess": {
    variantId: "ultimate-3d-chess",
    apply: (spec, sample) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#292524",
            playerColor: "#fafaf9",
            hazardColor: "#1c1917",
            collectibleColor: "#fbbf24",
            particleTint: "#d6d3d1",
          },
          gameplay: { ...spec.gameplay, winScore: 10 },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        {
          variantId: "ultimate-3d-chess",
          chess: { showLegalMoves: true, isometricHints: true, winMoves: 10 },
        },
      ),
  },
  "elastic-thief-2": {
    variantId: "elastic-thief-2",
    apply: (spec, sample, prompt) => {
      const plat = buildPlatformerBlueprint({ prompt, spec, sampleId: sample.id });
      return withProfile(
        {
          ...spec,
          theme: {
            ...spec.theme,
            backgroundColor: "#0f172a",
            playerColor: "#a78bfa",
            hazardColor: "#ef4444",
            collectibleColor: "#fbbf24",
            particleTint: "#818cf8",
          },
          title: sample.title,
          templateId: "stealth",
          platformer: {
            ...plat,
            mode: "stealth",
            doubleJump: true,
            grappleEnabled: true,
            levelLayers: Math.max(plat.levelLayers ?? 56, 60),
          },
          gameplay: {
            ...spec.gameplay,
            winScore: 12,
            jumpStrength: 520,
            gravity: 780,
            lives: 5,
          },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        {
          variantId: "elastic-thief-2",
          platformer: { treasureHeist: true, laserSentries: true, grapplePull: 0.028 },
        },
      );
    },
  },
  "state-conquest": {
    variantId: "state-conquest",
    apply: (spec, sample, prompt) => {
      const strat = buildStrategyBlueprint({ prompt, spec });
      return withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#1c1917",
            playerColor: "#38bdf8",
            hazardColor: "#ef4444",
            collectibleColor: "#fbbf24",
            particleTint: "#0ea5e9",
          },
          strategy: { ...strat, winNodes: 3 },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        {
          variantId: "state-conquest",
          strategy: { rushMode: true, winNodes: 3, aiAggression: 1.35 },
        },
      );
    },
  },
  "tiny-planet-chopper": {
    variantId: "tiny-planet-chopper",
    apply: (spec, sample) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#0f172a",
            playerColor: "#38bdf8",
            hazardColor: "#f472b6",
            collectibleColor: "#4ade80",
            particleTint: "#818cf8",
          },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "tiny-planet-chopper", shooter: { orbitChopper: true } },
      ),
  },
  "blade-defender-merge": {
    variantId: "blade-defender-merge",
    apply: (spec, sample) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#1e1b4b",
            playerColor: "#a78bfa",
            hazardColor: "#ef4444",
            collectibleColor: "#fbbf24",
            particleTint: "#c4b5fd",
          },
          labels: { ...spec.labels, subtitle: sample.subtitle },
          gameplay: {
            ...spec.gameplay,
            startingCoins: Math.max(spec.gameplay.startingCoins ?? 95, 120),
          },
        },
        { variantId: "blade-defender-merge", towerDefense: { mergeGrid: true, mergeBonusCoins: 25 } },
      ),
  },
  "car-color-palette": {
    variantId: "car-color-palette",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#18181b",
            playerColor: "#ef4444",
            hazardColor: "#1e293b",
            collectibleColor: "#38bdf8",
            particleTint: "#f97316",
          },
          customization: buildCustomizationBlueprint({ prompt, spec, sampleId: sample.id }),
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "car-color-palette", customization: { editGoal: 6 } },
      ),
  },
  "blocky-sniper-hunter": {
    variantId: "blocky-sniper-hunter",
    apply: (spec, sample) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#052e16",
            playerColor: "#4ade80",
            hazardColor: "#ef4444",
            collectibleColor: "#fbbf24",
            particleTint: "#86efac",
          },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "blocky-sniper-hunter", shooter: { sniperScope: true } },
      ),
  },
  "memory-match-mania": {
    variantId: "memory-match-mania",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#3b0764",
            playerColor: "#e879f9",
            hazardColor: "#f472b6",
            collectibleColor: "#fbbf24",
            particleTint: "#c084fc",
          },
          puzzle: { ...buildPuzzleBlueprint({ prompt, spec, sampleId: sample.id }), moveLimit: 48 },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "memory-match-mania", puzzle: { memoryTimerSec: 90 } },
      ),
  },
  "kids-puzzle": {
    variantId: "kids-puzzle",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#0c4a6e",
            playerColor: "#38bdf8",
            hazardColor: "#fcd34d",
            collectibleColor: "#f472b6",
            particleTint: "#7dd3fc",
          },
          puzzle: {
            ...buildPuzzleBlueprint({ prompt, spec, sampleId: sample.id }),
            mode: "jigsaw",
            cols: 3,
            rows: 3,
            moveLimit: 60,
            targetScore: 9,
          },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        {
          variantId: "kids-puzzle",
          puzzle: { kidsJigsaw: true, starReward: true, jigsawLargeBlocks: true },
        },
      ),
  },
  "pottery-master-3d": {
    variantId: "pottery-master-3d",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#44403c",
            playerColor: "#d6d3d1",
            hazardColor: "#78716c",
            collectibleColor: "#fbbf24",
            particleTint: "#a8a29e",
          },
          customization: buildCustomizationBlueprint({ prompt, spec, sampleId: sample.id }),
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "pottery-master-3d", customization: { potterySpin: 1.35, editGoal: 6 } },
      ),
  },
  "crashy-roads": {
    variantId: "crashy-roads",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#713f12",
            playerColor: "#fde047",
            hazardColor: "#ef4444",
            collectibleColor: "#f97316",
            particleTint: "#fcd34d",
          },
          coaster: buildCoasterBlueprint({ prompt, spec, sampleId: sample.id }),
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "crashy-roads", coaster: { speedBoost: 1.08 } },
      ),
  },
};