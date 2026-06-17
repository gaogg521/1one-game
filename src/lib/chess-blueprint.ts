import type { GameSpec } from "@/lib/game-spec";

export type ChessRuleset = "international" | "xiangqi" | "go" | "jungle";

export type ChessBlueprint = {
  ruleset: ChessRuleset;
  boardCols: number;
  boardRows: number;
  pieceSet: string[];
  aiDepth: number;
  showLegalMoves?: boolean;
  checkHint?: boolean;
};

export function inferChessRuleset(prompt = ""): ChessRuleset {
  if (/国际象棋|international chess|western chess|classic chess/i.test(prompt)) return "international";
  if (/围棋|go board|baduk|黑白棋子/.test(prompt)) return "go";
  if (/斗兽棋|动物棋|jungle chess|兽棋|狮虎|鼠吃象|动物棋子/.test(prompt)) return "jungle";
  return /中国象棋|楚河|汉界|红黑|帅|仕|相|马|车|炮|兵|xiangqi/i.test(prompt) ? "xiangqi" : "international";
}

export function buildChessBlueprint(opts: { prompt?: string; spec?: GameSpec }): ChessBlueprint {
  const ruleset = inferChessRuleset(opts.prompt ?? opts.spec?.title ?? "");
  if (ruleset === "xiangqi") {
    return {
      ruleset,
      boardCols: 9,
      boardRows: 10,
      pieceSet: ["帅", "仕", "相", "马", "车", "炮", "兵"],
      aiDepth: 1,
      showLegalMoves: true,
      checkHint: true,
    };
  }

  if (ruleset === "go") {
    return {
      ruleset,
      boardCols: 19,
      boardRows: 19,
      pieceSet: ["黑子", "白子"],
      aiDepth: 1,
      showLegalMoves: true,
      checkHint: false,
    };
  }

  if (ruleset === "jungle") {
    return {
      ruleset,
      boardCols: 7,
      boardRows: 9,
      pieceSet: ["象", "狮", "虎", "豹", "狼", "狗", "猫", "鼠"],
      aiDepth: 1,
      showLegalMoves: true,
      checkHint: true,
    };
  }

  return {
    ruleset,
    boardCols: 8,
    boardRows: 8,
    pieceSet: ["K", "Q", "R", "B", "N", "P"],
    aiDepth: 1,
    showLegalMoves: true,
    checkHint: true,
  };
}
