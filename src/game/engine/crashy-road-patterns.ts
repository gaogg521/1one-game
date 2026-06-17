export type CrashyObstacleStyle = "barrier" | "wreck" | "cone";

export type CrashyWaveStep = {
  lane: -1 | 0 | 1;
  style: CrashyObstacleStyle;
  z?: number;
};

export type CrashyWave = {
  id: string;
  steps: CrashyWaveStep[];
  cooldown: number;
};

export const CRASHY_WAVE_LIBRARY: readonly CrashyWave[] = [
  { id: "solo-left", steps: [{ lane: -1, style: "barrier" }], cooldown: 1.15 },
  { id: "solo-right", steps: [{ lane: 1, style: "wreck" }], cooldown: 1.1 },
  { id: "center-cone", steps: [{ lane: 0, style: "cone" }], cooldown: 1.2 },
  {
    id: "double-stagger",
    steps: [
      { lane: -1, style: "barrier", z: 1.16 },
      { lane: 1, style: "wreck", z: 1.04 },
    ],
    cooldown: 1.35,
  },
  {
    id: "zigzag",
    steps: [
      { lane: 1, style: "cone", z: 1.18 },
      { lane: -1, style: "barrier", z: 1.06 },
      { lane: 0, style: "wreck", z: 0.96 },
    ],
    cooldown: 1.5,
  },
  { id: "breather", steps: [], cooldown: 0.85 },
  {
    id: "squeeze",
    steps: [
      { lane: -1, style: "wreck", z: 1.14 },
      { lane: 1, style: "barrier", z: 1.14 },
    ],
    cooldown: 1.4,
  },
  {
    id: "triple-mix",
    steps: [
      { lane: 0, style: "cone", z: 1.2 },
      { lane: -1, style: "barrier", z: 1.08 },
      { lane: 1, style: "wreck", z: 0.98 },
    ],
    cooldown: 1.55,
  },
] as const;

export function crashyWaveAt(index: number): CrashyWave {
  return CRASHY_WAVE_LIBRARY[index % CRASHY_WAVE_LIBRARY.length]!;
}
