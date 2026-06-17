import type { GameSpec } from "@/lib/game-spec";

export type PuzzleMode = "match3" | "spotDifference" | "memoryMatch" | "jigsaw" | "merge2048";

export type PuzzleBlueprint = {
  mode: PuzzleMode;
  matchMechanic?: "flood" | "swap";
  cols: number;
  rows: number;
  targetScore: number;
  moveLimit: number;
  levelCount?: number;
  objectives?: Array<{
    id: string;
    label: string;
    type: "score" | "collectColor" | "clearObstacle" | "combo";
    target: number;
  }>;
  boosters?: Array<{
    id: string;
    name: string;
    effect: "rowClear" | "colClear" | "bomb" | "rainbow" | "shuffle" | "extraMoves";
    unlockLevel?: number;
  }>;
  specialTiles?: Array<"rowClear" | "colClear" | "bomb" | "rainbow">;
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
    case "color-bloom":
      return "match3";
    case "number-merge-2048":
      return "merge2048";
    default:
      break;
  }
  const blob = (opts.prompt ?? "").toLowerCase();
  if (/找不同|spot the difference|whimsy/i.test(blob)) return "spotDifference";
  if (/记忆|翻牌|memory match/i.test(blob)) return "memoryMatch";
  if (/拼图|jigsaw|kids puzzle|儿童.*拼图/i.test(blob)) return "jigsaw";
  if (/2048|数字合成|数字合并|number merge|merge numbers/i.test(blob)) return "merge2048";
  return "match3";
}

function wantsSwapMatch3(prompt = ""): boolean {
  return /开心消消乐|消消乐|三消|交换|swap|candy crush|match.?3/i.test(prompt);
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
    case "merge2048":
      return {
        mode,
        cols: 4,
        rows: 4,
        targetScore: 2048,
        moveLimit: 160,
        levelCount: 4,
        objectives: [
          { id: "reach-2048", label: "合成 2048", type: "score", target: 2048 },
          { id: "combo-merge", label: "连续合成", type: "combo", target: 6 },
        ],
        boosters: [
          { id: "undo", name: "悔一步", effect: "shuffle", unlockLevel: 1 },
          { id: "hammer", name: "敲掉低数", effect: "bomb", unlockLevel: 2 },
          { id: "refresh", name: "重排棋盘", effect: "shuffle", unlockLevel: 3 },
        ],
        specialTiles: ["bomb", "rainbow", "rowClear"],
      };
    case "match3":
      if (opts.sampleId === "color-bloom") {
        return {
          mode,
          matchMechanic: "swap",
          cols: 9,
          rows: 9,
          targetScore: 1200,
          moveLimit: 22,
          levelCount: 3,
          objectives: [
            { id: "score", label: "达成目标分", type: "score", target: 1200 },
            { id: "collect-chick", label: "收集小鸡", type: "collectColor", target: 14 },
            { id: "combo", label: "触发连锁", type: "combo", target: 2 },
          ],
          boosters: [
            { id: "hammer", name: "锤子", effect: "bomb", unlockLevel: 1 },
            { id: "stripe", name: "条纹", effect: "rowClear", unlockLevel: 2 },
            { id: "rainbow", name: "彩虹", effect: "rainbow", unlockLevel: 3 },
          ],
          specialTiles: ["rowClear", "colClear", "bomb", "rainbow"],
        };
      }
      if (wantsSwapMatch3(opts.prompt)) {
        return {
          mode,
          matchMechanic: "swap",
          cols: 8,
          rows: 8,
          targetScore: Math.round(220 + intensity * 120),
          moveLimit: 28 + (seed % 8),
          levelCount: 5,
          objectives: [
            { id: "score", label: "达成目标分", type: "score", target: Math.round(220 + intensity * 120) },
            { id: "collect-red", label: "收集红色糖果", type: "collectColor", target: 16 + (seed % 8) },
            { id: "combo", label: "触发连锁消除", type: "combo", target: 3 },
          ],
          boosters: [
            { id: "hammer", name: "棒棒糖锤", effect: "bomb", unlockLevel: 1 },
            { id: "stripe", name: "条纹糖", effect: "rowClear", unlockLevel: 2 },
            { id: "rainbow", name: "彩虹糖", effect: "rainbow", unlockLevel: 3 },
            { id: "steps", name: "加五步", effect: "extraMoves", unlockLevel: 4 },
          ],
          specialTiles: ["rowClear", "colClear", "bomb", "rainbow"],
        };
      }
      return {
        mode,
        matchMechanic: "flood",
        cols: 8 + (seed % 2),
        rows: 8 + (seed % 2),
        targetScore: Math.round(160 + intensity * 100),
        moveLimit: 32 + (seed % 10),
      };
    default:
      return {
        mode,
        matchMechanic: "flood",
        cols: 8,
        rows: 8,
        targetScore: 160,
        moveLimit: 32,
      };
  }
}
