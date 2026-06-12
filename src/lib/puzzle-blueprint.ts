import type { GameSpec } from "@/lib/game-spec";

export type PuzzleMode = "match3" | "spotDifference" | "memoryMatch" | "jigsaw";

export type PuzzleBlueprint = {
  mode: PuzzleMode;
  cols: number;
  rows: number;
  targetScore: number;
  moveLimit: number;
};

const SAMPLE_MODES: Record<string, PuzzleMode> = {
  "color-bloom": "match3",
  "whimsy-differences": "spotDifference",
  "memory-match-mania": "memoryMatch",
  "kids-puzzle": "jigsaw",
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
  if (opts.sampleId && SAMPLE_MODES[opts.sampleId]) return SAMPLE_MODES[opts.sampleId]!;
  const blob = (opts.prompt ?? "").toLowerCase();
  if (/找不同|spot the difference|whimsy/i.test(blob)) return "spotDifference";
  if (/记忆|翻牌|memory match/i.test(blob)) return "memoryMatch";
  if (/拼图|jigsaw|kids puzzle/i.test(blob)) return "jigsaw";
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
      return { mode, cols: 2, rows: 2, targetScore: 5, moveLimit: 90 };
    case "memoryMatch":
      return { mode, cols: 4, rows: 3, targetScore: 6, moveLimit: 40 + (seed % 10) };
    case "jigsaw":
      return { mode, cols: 3, rows: 3, targetScore: 9, moveLimit: 999 };
    default:
      return {
        mode,
        cols: 7 + (seed % 2),
        rows: 7 + (seed % 2),
        targetScore: Math.round(120 + intensity * 80),
        moveLimit: 28 + (seed % 8),
      };
  }
}
