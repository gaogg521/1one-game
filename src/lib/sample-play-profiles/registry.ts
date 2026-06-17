import type { GameSpec } from "@/lib/game-spec";
import { buildCoasterBlueprint } from "@/lib/coaster-blueprint";
import { buildChessBlueprint } from "@/lib/chess-blueprint";
import { buildCustomizationBlueprint } from "@/lib/customization-blueprint";
import { buildFarmingBlueprint } from "@/lib/farming-blueprint";
import { buildPlatformerBlueprint } from "@/lib/platformer-blueprint";
import { buildPuzzleBlueprint } from "@/lib/puzzle-blueprint";
import type { Sample } from "@/lib/samples";
import type { SamplePlayProfile } from "@/lib/sample-play-profiles/types";

export type SampleProfileDef = {
  variantId: string;
  apply: (spec: GameSpec, sample: Sample, prompt: string) => GameSpec;
};

function withProfile(spec: GameSpec, profile: SamplePlayProfile): GameSpec {
  return { ...spec, samplePlayProfile: profile };
}

/** Astrocade 样品 — 独立定制逻辑（写入 specJson，duplicate 可继承） */
export const SAMPLE_PLAY_PROFILES: Record<string, SampleProfileDef> = {
  "number-merge-2048": {
    variantId: "number-merge-2048",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#f97316",
            playerColor: "#facc15",
            hazardColor: "#ef4444",
            collectibleColor: "#22d3ee",
            particleTint: "#fde68a",
          },
          puzzle: {
            ...buildPuzzleBlueprint({ prompt, spec, sampleId: sample.id }),
            mode: "merge2048",
            cols: 4,
            rows: 4,
            targetScore: 2048,
            moveLimit: 160,
          },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "number-merge-2048", puzzle: {} },
      ),
  },
  "classic-xiangqi-board": {
    variantId: "classic-xiangqi-board",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#92400e",
            playerColor: "#dc2626",
            hazardColor: "#111827",
            collectibleColor: "#fbbf24",
            particleTint: "#fde68a",
          },
          chess: buildChessBlueprint({ prompt, spec }),
          gameplay: { ...spec.gameplay, winScore: 10 },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "classic-xiangqi-board", chess: { showLegalMoves: true, winMoves: 10 } },
      ),
  },
  "classic-international-chess": {
    variantId: "classic-international-chess",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#111827",
            playerColor: "#f8fafc",
            hazardColor: "#0f172a",
            collectibleColor: "#fbbf24",
            particleTint: "#cbd5e1",
          },
          chess: buildChessBlueprint({ prompt, spec }),
          gameplay: { ...spec.gameplay, winScore: 8 },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "classic-international-chess", chess: { showLegalMoves: true, winMoves: 8 } },
      ),
  },
  "temple-relic-runner": {
    variantId: "temple-relic-runner",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#7c2d12",
            playerColor: "#facc15",
            hazardColor: "#78350f",
            collectibleColor: "#f59e0b",
            particleTint: "#86efac",
          },
          coaster: buildCoasterBlueprint({ prompt, spec, sampleId: sample.id }),
          gameplay: { ...spec.gameplay, lives: 1, winScore: 120 },
          labels: {
            ...spec.labels,
            player: "遗迹跑者",
            hazard: "滚石陷阱",
            collectible: "金币遗物",
            subtitle: sample.subtitle,
          },
        },
        { variantId: "temple-relic-runner", coaster: { speedBoost: 1.18, bankIntensity: 1.15 } },
      ),
  },
  "zen-go-board": {
    variantId: "zen-go-board",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#92400e",
            playerColor: "#111827",
            hazardColor: "#f8fafc",
            collectibleColor: "#f59e0b",
            particleTint: "#fde68a",
          },
          chess: buildChessBlueprint({ prompt, spec }),
          gameplay: { ...spec.gameplay, winScore: 12 },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "zen-go-board", chess: { showLegalMoves: true, winMoves: 8 } },
      ),
  },
  "jungle-animal-chess": {
    variantId: "jungle-animal-chess",
    apply: (spec, sample, prompt) =>
      withProfile(
        {
          ...spec,
          title: sample.title,
          theme: {
            ...spec.theme,
            backgroundColor: "#38bdf8",
            playerColor: "#fef9c3",
            hazardColor: "#ef4444",
            collectibleColor: "#22c55e",
            particleTint: "#86efac",
          },
          chess: buildChessBlueprint({ prompt, spec }),
          gameplay: { ...spec.gameplay, winScore: 8 },
          labels: { ...spec.labels, subtitle: sample.subtitle },
        },
        { variantId: "jungle-animal-chess", chess: { showLegalMoves: true, winMoves: 8 } },
      ),
  },
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
          title: "开心消消乐",
          theme: {
            ...spec.theme,
            backgroundColor: "#7dd3fc",
            playerColor: "#4ade80",
            hazardColor: "#a78bfa",
            collectibleColor: "#facc15",
            particleTint: "#38bdf8",
          },
          puzzle: buildPuzzleBlueprint({ prompt, spec, sampleId: sample.id }),
          labels: { ...spec.labels, subtitle: "开心消消乐 · 动物三消 · 交换消除" },
        },
        { variantId: "color-bloom", puzzle: { match3BloomScale: 1.45 } },
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