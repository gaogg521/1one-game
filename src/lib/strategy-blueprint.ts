import type { GameSpec } from "@/lib/game-spec";

export type StrategyNode = {
  id: string;
  x: number;
  y: number;
  owner: "player" | "ai" | "neutral";
  troops: number;
  links: string[];
};

export type StrategyBlueprint = {
  nodes: StrategyNode[];
  winNodes: number;
};

export function buildStrategyBlueprint(opts: { prompt?: string; spec?: GameSpec }): StrategyBlueprint {
  return {
    winNodes: 4,
    nodes: [
      { id: "p0", x: 0.18, y: 0.42, owner: "player", troops: 24, links: ["n1", "n2"] },
      { id: "n1", x: 0.42, y: 0.28, owner: "neutral", troops: 12, links: ["p0", "n3"] },
      { id: "n2", x: 0.38, y: 0.58, owner: "neutral", troops: 10, links: ["p0", "n3"] },
      { id: "n3", x: 0.62, y: 0.45, owner: "ai", troops: 20, links: ["n1", "n2", "n4"] },
      { id: "n4", x: 0.82, y: 0.38, owner: "ai", troops: 16, links: ["n3"] },
    ],
  };
}
