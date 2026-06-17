export type TempleObstacleKind = "rock" | "pillar" | "beam";

export type TempleWaveStep = {
  kind: TempleObstacleKind;
  lane: -1 | 0 | 1;
  z?: number;
};

export type TempleWaveCoins = {
  lane: -1 | 0 | 1;
  count: number;
  z?: number;
};

/** 固定节奏波次：教学 → 单障 → 双障组合 → 横梁收尾 */
export type TempleWave = {
  id: string;
  steps: TempleWaveStep[];
  coins?: TempleWaveCoins[];
  cooldown: number;
};

export const TEMPLE_WAVE_LIBRARY: readonly TempleWave[] = [
  {
    id: "intro-left-rock",
    steps: [{ kind: "rock", lane: -1 }],
    coins: [{ lane: 1, count: 3 }],
    cooldown: 1.45,
  },
  {
    id: "intro-right-rock",
    steps: [{ kind: "rock", lane: 1 }],
    coins: [{ lane: -1, count: 3 }],
    cooldown: 1.4,
  },
  {
    id: "center-pillar",
    steps: [{ kind: "pillar", lane: 0 }],
    coins: [{ lane: 0, count: 2, z: 1.1 }],
    cooldown: 1.55,
  },
  {
    id: "zigzag-rocks",
    steps: [
      { kind: "rock", lane: -1, z: 1.18 },
      { kind: "rock", lane: 1, z: 1.06 },
    ],
    coins: [{ lane: 0, count: 4 }],
    cooldown: 1.65,
  },
  {
    id: "beam-slide",
    steps: [{ kind: "beam", lane: 0 }],
    coins: [
      { lane: -1, count: 2 },
      { lane: 1, count: 2 },
    ],
    cooldown: 1.5,
  },
  {
    id: "side-pillars",
    steps: [
      { kind: "pillar", lane: -1, z: 1.16 },
      { kind: "pillar", lane: 1, z: 1.08 },
    ],
    coins: [{ lane: 0, count: 5 }],
    cooldown: 1.7,
  },
  {
    id: "rock-beam-combo",
    steps: [
      { kind: "rock", lane: 0, z: 1.18 },
      { kind: "beam", lane: -1, z: 1.02 },
    ],
    coins: [{ lane: 1, count: 3 }],
    cooldown: 1.75,
  },
  {
    id: "triple-lane-pressure",
    steps: [
      { kind: "rock", lane: -1, z: 1.2 },
      { kind: "pillar", lane: 0, z: 1.1 },
      { kind: "rock", lane: 1, z: 1.0 },
    ],
    coins: [{ lane: 0, count: 2, z: 1.14 }],
    cooldown: 1.85,
  },
  {
    id: "breather-coins",
    steps: [],
    coins: [
      { lane: -1, count: 2 },
      { lane: 0, count: 3 },
      { lane: 1, count: 2 },
    ],
    cooldown: 1.2,
  },
  {
    id: "beam-right-finale",
    steps: [
      { kind: "beam", lane: 1, z: 1.14 },
      { kind: "rock", lane: 0, z: 1.04 },
    ],
    coins: [{ lane: -1, count: 4 }],
    cooldown: 1.6,
  },
] as const;

export function templeWaveAt(index: number): TempleWave {
  return TEMPLE_WAVE_LIBRARY[index % TEMPLE_WAVE_LIBRARY.length]!;
}
