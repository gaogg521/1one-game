import type { GameSpec } from "@/lib/game-spec";

export type PuzzleMode = "match3" | "spotDifference" | "memoryMatch" | "jigsaw";

export type PuzzleBlueprint = {
  mode: PuzzleMode;
  cols: number;
  rows: number;
  targetScore: number;
  moveLimit: number;
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function inferPuzzleMode(opts: { prompt?: string; sampleId?: string }): PuzzleMode {
  switch (opts.sampleId) {
    case "whimsy-differences":
      return "spotDifference";
    case "memory-match-mania":
      return "memoryMatch";
    case "kids-puzzle":
      return "jigsaw";
    case "color-bloom":
      return "match3";
    default:
      break;
  }
  const blob = (opts.prompt ?? "").toLowerCase();
  if (/找不同|spot the difference|whimsy/i.test(blob)) return "spotDifference";
  if (/记忆|翻牌|memory match/i.test(blob)) return "memoryMatch";
  if (/拼图|jigsaw|kids puzzle|儿童.*拼图/i.test(blob)) return "jigsaw";
  return "match3";
}

export function buildPuzzleBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
  sampleId?: string;
}): PuzzleBlueprint {
  const mode = inferPuzzleMode({ prompt: opts.prompt, sampleId: opts.sampleId });
  const seed = hashSeed(opts.prompt ?? opts.spec?.title ?? mode);
  const intensity = opts.spec?.director?.intensity ?? 0.55;

  switch (mode) {
    case "spotDifference":
      return { mode, cols: 2, rows: 2, targetScore: 7, moveLimit: 110 };
    case "memoryMatch":
      return { mode, cols: 4, rows: 4, targetScore: 8, moveLimit: 52 + (seed % 12) };
    case "jigsaw": {
      const grid = 3 + (seed % 2);
      return { mode, cols: grid, rows: grid, targetScore: grid * grid, moveLimit: 999 };
    }
    default:
      return {
        mode,
        cols: 8 + (seed % 2),
        rows: 8 + (seed % 2),
        targetScore: Math.round(160 + intensity * 100),
        moveLimit: 32 + (seed % 10),
      };
  }
}
