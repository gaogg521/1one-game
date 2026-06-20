import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildSceneCohesion } from "@/lib/scene-experience";
import type { GameSpec } from "@/lib/game-spec";
import {
  bannerChessFinish,
  hudChessThinkingBlack,
  hudChessPieceSelected,
  hudChessTurnWhite,
  hudChessTurnWhiteShort,
  hudReady,
} from "@/lib/i18n/game-hud-labels";
import { pickSeededFromArray, runtimeSeedFromSpec, seededRandom } from "@/lib/runtime-seed";
import { paintChessStudioBackdrop } from "@/game/engine/action-visual";
import { bumpQaTouch, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { schedulePhaserPlayReady, setPhaserQaClickHints } from "@/game/engine/phaser-play-ready";
import { showControlsHint, chessControlLines } from "@/game/engine/controls-hint";
import { juiceFlash, juiceShake } from "@/game/engine/gameJuice";

type EndPayload = { score: number; won: boolean };
type BoardRuleset = "international" | "xiangqi" | "go" | "jungle";
type Piece = { color: "w" | "b"; type: string; row: number; col: number };
type BoardSquare = { row: number; col: number };

/** 简化国际象棋：白方走子 + 随机黑方回应 */
export class ChessScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private pieces: Piece[] = [];
  private selected: Piece | null = null;
  private whiteTurn = true;
  private moves = 0;
  private finished = false;
  private cell = 48;
  private ox = 0;
  private oy = 80;
  private boardCols = 8;
  private boardRows = 8;
  private boardGfx!: Phaser.GameObjects.Graphics;
  private pieceTexts: Phaser.GameObjects.Text[] = [];
  private riverTexts: Phaser.GameObjects.Text[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private cohesive!: CohesivePresentation;
  private legalGfx!: Phaser.GameObjects.Graphics;
  private winMoves = 8;
  private isometricHints = false;
  private runtimeRng!: () => number;
  private ruleset: BoardRuleset = "international";
  private checkTarget: "w" | "b" | null = null;
  private goKoBan: BoardSquare | null = null;
  private goCapturesW = 0;
  private goCapturesB = 0;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "ChessScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  create() {
    const cohesive = buildSceneCohesion(this.spec);
    this.cohesive = cohesive;
    this.runtimeRng = seededRandom(runtimeSeedFromSpec(this.spec));

    const chessPf = this.spec.samplePlayProfile?.chess;
    this.ruleset = this.spec.chess?.ruleset ?? "international";
    this.winMoves = chessPf?.winMoves ?? 8;
    this.isometricHints = chessPf?.isometricHints ?? false;
    this.boardCols = this.spec.chess?.boardCols ?? 8;
    this.boardRows = this.spec.chess?.boardRows ?? 8;

    const w = this.scale.width;
    const h = this.scale.height;
    this.cell = Math.min(52, (w - 60) / this.boardCols, (h - 150) / this.boardRows);
    this.ox = (w - this.cell * this.boardCols) / 2;
    this.oy = this.isometricHints ? 88 : 80;

    if (this.isometricHints) {
      paintChessStudioBackdrop(this, this.spec, w, h);
    } else {
      this.add
        .rectangle(w / 2, h / 2, w, h, Phaser.Display.Color.HexStringToColor(this.spec.theme.backgroundColor).color)
        .setDepth(-1);
    }
    this.boardGfx = this.add.graphics();
    this.legalGfx = this.add.graphics().setDepth(3);

    this.pieces =
      this.ruleset === "xiangqi"
        ? this.buildXiangqiPieces()
        : this.ruleset === "go"
          ? this.buildGoPieces()
          : this.ruleset === "jungle"
            ? this.buildJunglePieces()
            : this.buildInternationalPieces();

    this.statusText = styleHudText(
      this.add.text(16, 12, hudChessTurnWhite(this.uiLocale), { fontSize: "16px", color: "#fff" }),
    );
    this.banner = new HudBanner(this, this.cohesive.banner);
    this.banner.show({ title: hudReady(this.uiLocale), ms: 1200 });

    if (chessPf?.isometricHints) {
      this.statusText.setText(
        this.uiLocale === "zh-Hans" ? "3D 视角 · 白方先行 · 点击走子" : "3D view · White to move",
      );
    } else if (this.ruleset === "xiangqi") {
      this.statusText.setText(this.uiLocale === "zh-Hans" ? "红方先行 · 点击棋子走子" : "Red to move · tap a piece");
      this.checkTarget = this.xiangqiInCheck("w", this.pieces) ? "w" : null;
      if (this.checkTarget === "w") this.refreshCheckStatus();
    } else if (this.ruleset === "international") {
      this.statusText.setText(
        this.uiLocale === "zh-Hans" ? "白方先行 · 点击棋子走子" : "White to move · tap a piece",
      );
      this.checkTarget = this.intlInCheck("w", this.pieces) ? "w" : null;
      if (this.checkTarget === "w") this.refreshCheckStatus();
    } else if (this.ruleset === "go") {
      this.statusText.setText(
        this.uiLocale === "zh-Hans" ? "围棋 · 提子有气 · 打劫禁入" : "Go · capture · ko rule",
      );
    } else if (this.ruleset === "jungle") {
      this.statusText.setText(
        this.uiLocale === "zh-Hans" ? "斗兽棋 · 鼠能过河 · 狮虎可跳河" : "Jungle · rat swims · lion/tiger jump",
      );
    }

    this.publishQaState();
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onBoardClick(p));
    this.redraw();
    schedulePhaserPlayReady(this, 400, {});
    if (this.ruleset === "go") {
      const c = Math.floor(this.boardCols / 2);
      const r = Math.floor(this.boardRows / 2);
      setPhaserQaClickHints([
        {
          x: (this.ox + (c + 0.5) * this.cell) / w,
          y: (this.oy + (r + 0.5) * this.cell) / h,
        },
      ]);
    } else {
      const pawn = this.pieces.find(
        (p) => p.color === "w" && (p.type === "P" || p.type === "兵" || p.type === "黑" || p.type === "鼠"),
      );
      if (pawn) {
        setPhaserQaClickHints([
          {
            x: (this.ox + (pawn.col + 0.5) * this.cell) / w,
            y: (this.oy + (pawn.row + 0.5) * this.cell) / h,
          },
          {
            x: (this.ox + (pawn.col + 0.5) * this.cell) / w,
            y: (this.oy + (pawn.row - 0.5) * this.cell) / h,
          },
        ]);
      }
    }
    showControlsHint(this, chessControlLines(this.uiLocale));
  }

  private buildInternationalPieces(): Piece[] {
    const back = ["R", "N", "B", "Q", "K", "B", "N", "R"];
    const pieces: Piece[] = [];
    for (let c = 0; c < 8; c += 1) {
      pieces.push({ color: "b", type: back[c]!, row: 0, col: c });
      pieces.push({ color: "b", type: "P", row: 1, col: c });
      pieces.push({ color: "w", type: "P", row: 6, col: c });
      pieces.push({ color: "w", type: back[c]!, row: 7, col: c });
    }
    return pieces;
  }

  private buildXiangqiPieces(): Piece[] {
    const redBack = ["车", "马", "相", "仕", "帅", "仕", "相", "马", "车"];
    const blackBack = ["车", "马", "象", "士", "将", "士", "象", "马", "车"];
    const pieces: Piece[] = [];
    for (let c = 0; c < 9; c += 1) {
      pieces.push({ color: "b", type: blackBack[c]!, row: 0, col: c });
      pieces.push({ color: "w", type: redBack[c]!, row: 9, col: c });
    }
    for (const c of [1, 7]) {
      pieces.push({ color: "b", type: "炮", row: 2, col: c });
      pieces.push({ color: "w", type: "炮", row: 7, col: c });
    }
    for (const c of [0, 2, 4, 6, 8]) {
      pieces.push({ color: "b", type: "卒", row: 3, col: c });
      pieces.push({ color: "w", type: "兵", row: 6, col: c });
    }
    return pieces;
  }

  private xiangqiPieceAtIn(pieces: Piece[], row: number, col: number): Piece | undefined {
    return pieces.find((x) => x.row === row && x.col === col);
  }

  private xiangqiCanLandOn(p: Piece, row: number, col: number, pieces: Piece[]): boolean {
    if (row < 0 || row >= this.boardRows || col < 0 || col >= this.boardCols) return false;
    const occ = this.xiangqiPieceAtIn(pieces, row, col);
    return !occ || occ.color !== p.color;
  }

  private xiangqiInPalace(color: "w" | "b", row: number, col: number): boolean {
    if (col < 3 || col > 5) return false;
    return color === "w" ? row >= 7 && row <= 9 : row >= 0 && row <= 2;
  }

  private xiangqiGeneralOf(color: "w" | "b", pieces: Piece[]): Piece | undefined {
    return pieces.find((p) => p.color === color && (p.type === "帅" || p.type === "将"));
  }

  /** 将帅同线无子相隔（白脸将） */
  private xiangqiGeneralsFaceEachOtherIn(pieces: Piece[]): boolean {
    const red = this.xiangqiGeneralOf("w", pieces);
    const black = this.xiangqiGeneralOf("b", pieces);
    if (!red || !black || red.col !== black.col) return false;
    const minR = Math.min(red.row, black.row);
    const maxR = Math.max(red.row, black.row);
    for (let r = minR + 1; r < maxR; r += 1) {
      if (this.xiangqiPieceAtIn(pieces, r, red.col)) return false;
    }
    return true;
  }

  private xiangqiRayMovesIn(p: Piece, pieces: Piece[], dirs: number[][]): BoardSquare[] {
    const moves: BoardSquare[] = [];
    for (const [dr, dc] of dirs) {
      for (let step = 1; step < 10; step += 1) {
        const row = p.row + dr! * step;
        const col = p.col + dc! * step;
        if (row < 0 || row >= this.boardRows || col < 0 || col >= this.boardCols) break;
        const occupant = this.xiangqiPieceAtIn(pieces, row, col);
        if (!occupant) {
          moves.push({ row, col });
          continue;
        }
        if (occupant.color !== p.color) moves.push({ row, col });
        break;
      }
    }
    return moves;
  }

  /** 不考虑应将的伪合法走法（用于攻击判定与应将过滤） */
  private xiangqiPseudoMoves(p: Piece, pieces: Piece[]): BoardSquare[] {
    const moves: BoardSquare[] = [];
    const add = (row: number, col: number) => {
      if (this.xiangqiCanLandOn(p, row, col, pieces)) moves.push({ row, col });
    };

    const forward = p.color === "w" ? -1 : 1;
    const riverCrossed = p.color === "w" ? p.row <= 4 : p.row >= 5;

    if (p.type === "兵" || p.type === "卒") {
      add(p.row + forward, p.col);
      if (riverCrossed) {
        add(p.row, p.col - 1);
        add(p.row, p.col + 1);
      }
    } else if (p.type === "帅" || p.type === "将") {
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const row = p.row + dr!;
        const col = p.col + dc!;
        if (this.xiangqiInPalace(p.color, row, col)) add(row, col);
      }
      const enemyGeneral = this.xiangqiGeneralOf(p.color === "w" ? "b" : "w", pieces);
      if (enemyGeneral && enemyGeneral.col === p.col) {
        const between = pieces.some(
          (x) =>
            x.col === p.col &&
            x.row > Math.min(p.row, enemyGeneral.row) &&
            x.row < Math.max(p.row, enemyGeneral.row),
        );
        if (!between) add(enemyGeneral.row, enemyGeneral.col);
      }
    } else if (p.type === "仕" || p.type === "士") {
      for (const [dr, dc] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const row = p.row + dr!;
        const col = p.col + dc!;
        if (this.xiangqiInPalace(p.color, row, col)) add(row, col);
      }
    } else if (p.type === "相" || p.type === "象") {
      const jumps: Array<[number, number, number, number]> = [
        [2, 2, 1, 1],
        [2, -2, 1, -1],
        [-2, 2, -1, 1],
        [-2, -2, -1, -1],
      ];
      for (const [dr, dc, er, ec] of jumps) {
        if (this.xiangqiPieceAtIn(pieces, p.row + er, p.col + ec)) continue;
        const row = p.row + dr;
        const col = p.col + dc;
        if (p.color === "w" && row < 5) continue;
        if (p.color === "b" && row > 4) continue;
        add(row, col);
      }
    } else if (p.type === "马") {
      const jumps: Array<[number, number, number, number]> = [
        [2, 1, 1, 0],
        [2, -1, 1, 0],
        [-2, 1, -1, 0],
        [-2, -1, -1, 0],
        [1, 2, 0, 1],
        [1, -2, 0, -1],
        [-1, 2, 0, 1],
        [-1, -2, 0, -1],
      ];
      for (const [dr, dc, lr, lc] of jumps) {
        if (this.xiangqiPieceAtIn(pieces, p.row + lr, p.col + lc)) continue;
        add(p.row + dr, p.col + dc);
      }
    } else if (p.type === "车") {
      moves.push(...this.xiangqiRayMovesIn(p, pieces, [[1, 0], [-1, 0], [0, 1], [0, -1]]));
    } else if (p.type === "炮") {
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        let seenScreen = false;
        for (let step = 1; step < 10; step += 1) {
          const row = p.row + dr! * step;
          const col = p.col + dc! * step;
          if (row < 0 || row >= this.boardRows || col < 0 || col >= this.boardCols) break;
          const occ = this.xiangqiPieceAtIn(pieces, row, col);
          if (!occ) {
            if (!seenScreen) add(row, col);
            continue;
          }
          if (!seenScreen) {
            seenScreen = true;
            continue;
          }
          if (occ.color !== p.color) add(row, col);
          break;
        }
      }
    }

    if (p.type === "帅" || p.type === "将") {
      return moves.filter((m) => {
        const trial = this.xiangqiApplyMove(pieces, p, m);
        return !this.xiangqiGeneralsFaceEachOtherIn(trial);
      });
    }
    return moves;
  }

  private xiangqiApplyMove(pieces: Piece[], piece: Piece, move: BoardSquare): Piece[] {
    const captured = this.xiangqiPieceAtIn(pieces, move.row, move.col);
    const rest = pieces.filter((x) => x !== piece && x !== captured);
    return [...rest, { ...piece, row: move.row, col: move.col }];
  }

  private xiangqiIsSquareAttacked(row: number, col: number, byColor: "w" | "b", pieces: Piece[]): boolean {
    for (const p of pieces.filter((x) => x.color === byColor)) {
      const attacks = this.xiangqiPseudoMoves(p, pieces);
      if (attacks.some((m) => m.row === row && m.col === col)) return true;
    }
    return false;
  }

  private xiangqiInCheck(color: "w" | "b", pieces: Piece[]): boolean {
    const general = this.xiangqiGeneralOf(color, pieces);
    if (!general) return true;
    const enemy: "w" | "b" = color === "w" ? "b" : "w";
    return this.xiangqiIsSquareAttacked(general.row, general.col, enemy, pieces);
  }

  /** 真合法走法：走完己方不被将军，且不构成白脸将 */
  private xiangqiLegalMovesFiltered(p: Piece, pieces: Piece[]): BoardSquare[] {
    return this.xiangqiPseudoMoves(p, pieces).filter((m) => {
      const after = this.xiangqiApplyMove(pieces, p, m);
      if (this.xiangqiGeneralsFaceEachOtherIn(after)) return false;
      return !this.xiangqiInCheck(p.color, after);
    });
  }

  private xiangqiAllLegalMoves(color: "w" | "b", pieces: Piece[]): Array<{ piece: Piece; move: BoardSquare }> {
    const out: Array<{ piece: Piece; move: BoardSquare }> = [];
    for (const p of pieces.filter((x) => x.color === color)) {
      for (const move of this.xiangqiLegalMovesFiltered(p, pieces)) {
        out.push({ piece: p, move });
      }
    }
    return out;
  }

  private afterMoveStatus(mover: "w" | "b") {
    const enemy: "w" | "b" = mover === "w" ? "b" : "w";
    const enemyMoves = this.allLegalMovesFor(enemy, this.pieces);
    const enemyInCheck = this.inCheckFor(enemy, this.pieces);
    this.checkTarget = enemyInCheck ? enemy : null;

    if (!this.leaderOf(enemy, this.pieces)) {
      this.finishCheckmate(mover);
      return;
    }
    if (enemyInCheck && enemyMoves.length === 0) {
      this.finishCheckmate(mover);
      return;
    }
    if (!enemyInCheck && enemyMoves.length === 0) {
      this.finishStalemate();
      return;
    }

    if (enemyInCheck) {
      this.banner.show({
        title: this.uiLocale === "zh-Hans" ? "将军！" : "Check!",
        message: this.uiLocale === "zh-Hans" ? "对方必须应将" : "Opponent must respond",
        ms: 1400,
      });
      juiceShake(this, { intensity: 0.012, durationMs: 160 });
      playBleep("hit");
    }
    this.refreshCheckStatus();
    this.redraw();
  }

  private refreshCheckStatus() {
    if (this.ruleset !== "xiangqi" && this.ruleset !== "international") return;
    if (this.finished) return;
    const isXiangqi = this.ruleset === "xiangqi";
    if (!this.whiteTurn) {
      if (this.checkTarget === "b") {
        this.statusText.setText(
          this.uiLocale === "zh-Hans" ? "黑方应将中…" : "Black escaping check…",
        );
        return;
      }
      this.statusText.setText(this.uiLocale === "zh-Hans" ? "黑方思考…" : "Black thinking…");
      return;
    }
    if (this.checkTarget === "w") {
      this.statusText.setText(
        this.uiLocale === "zh-Hans"
          ? isXiangqi
            ? "⚠ 你被将军！必须应将"
            : "⚠ 白方被将军！必须应将"
          : "⚠ You are in check!",
      );
      return;
    }
    this.statusText.setText(
      isXiangqi
        ? this.uiLocale === "zh-Hans"
          ? "红方行棋 · 点击棋子"
          : "Red to move"
        : hudChessTurnWhite(this.uiLocale),
    );
  }

  private finishCheckmate(winner: "w" | "b") {
    const playerWon = winner === "w";
    const isXiangqi = this.ruleset === "xiangqi";
    this.banner.show({
      title:
        winner === "w"
          ? isXiangqi
            ? this.uiLocale === "zh-Hans"
              ? "将死！红方胜"
              : "Checkmate! Red wins"
            : this.uiLocale === "zh-Hans"
              ? "将死！白方胜"
              : "Checkmate! White wins"
          : isXiangqi
            ? this.uiLocale === "zh-Hans"
              ? "将死！黑方胜"
              : "Checkmate! Black wins"
            : this.uiLocale === "zh-Hans"
              ? "将死！黑方胜"
              : "Checkmate! Black wins",
      message: playerWon
        ? this.uiLocale === "zh-Hans"
          ? "绝杀成功"
          : "Decisive checkmate"
        : isXiangqi
          ? this.uiLocale === "zh-Hans"
            ? "红帅被将死"
            : "Red general trapped"
          : this.uiLocale === "zh-Hans"
            ? "白王被将死"
            : "White king trapped",
      ms: 2800,
    });
    juiceFlash(this, { r: 251, g: 191, b: 36 }, { durationMs: 220 });
    this.finish(playerWon);
  }

  private finishStalemate() {
    this.banner.show({
      title: this.uiLocale === "zh-Hans" ? "困毙 · 和棋" : "Stalemate · Draw",
      message: this.uiLocale === "zh-Hans" ? "无子可动且未被将军" : "No legal moves without check",
      ms: 2400,
    });
    this.finish(false);
  }

  private leaderOf(color: "w" | "b", pieces: Piece[]): Piece | undefined {
    if (this.ruleset === "xiangqi") return this.xiangqiGeneralOf(color, pieces);
    return this.intlKingOf(color, pieces);
  }

  private allLegalMovesFor(color: "w" | "b", pieces: Piece[]): Array<{ piece: Piece; move: BoardSquare }> {
    if (this.ruleset === "xiangqi") return this.xiangqiAllLegalMoves(color, pieces);
    return this.intlAllLegalMoves(color, pieces);
  }

  private inCheckFor(color: "w" | "b", pieces: Piece[]): boolean {
    if (this.ruleset === "xiangqi") return this.xiangqiInCheck(color, pieces);
    return this.intlInCheck(color, pieces);
  }

  private applyBoardMove(pieces: Piece[], piece: Piece, move: BoardSquare): Piece[] {
    if (this.ruleset === "xiangqi") return this.xiangqiApplyMove(pieces, piece, move);
    return this.intlApplyMove(pieces, piece, move);
  }

  private intlPieceAtIn(pieces: Piece[], row: number, col: number): Piece | undefined {
    return pieces.find((x) => x.row === row && x.col === col);
  }

  private intlCanLandOn(p: Piece, row: number, col: number, pieces: Piece[]): boolean {
    if (row < 0 || row >= this.boardRows || col < 0 || col >= this.boardCols) return false;
    const occ = this.intlPieceAtIn(pieces, row, col);
    return !occ || occ.color !== p.color;
  }

  private intlKingOf(color: "w" | "b", pieces: Piece[]): Piece | undefined {
    return pieces.find((p) => p.color === color && p.type === "K");
  }

  private intlRayMovesIn(p: Piece, pieces: Piece[], dirs: number[][]): BoardSquare[] {
    const moves: BoardSquare[] = [];
    for (const [dr, dc] of dirs) {
      for (let step = 1; step < Math.max(this.boardCols, this.boardRows); step += 1) {
        const row = p.row + dr! * step;
        const col = p.col + dc! * step;
        if (row < 0 || row >= this.boardRows || col < 0 || col >= this.boardCols) break;
        const occupant = this.intlPieceAtIn(pieces, row, col);
        if (!occupant) {
          moves.push({ row, col });
          continue;
        }
        if (occupant.color !== p.color) moves.push({ row, col });
        break;
      }
    }
    return moves;
  }

  private intlPseudoMoves(p: Piece, pieces: Piece[]): BoardSquare[] {
    const moves: BoardSquare[] = [];
    const add = (row: number, col: number) => {
      if (this.intlCanLandOn(p, row, col, pieces)) moves.push({ row, col });
    };
    if (p.type === "P") {
      const forward = p.color === "w" ? -1 : 1;
      const startRow = p.color === "w" ? 6 : 1;
      if (!this.intlPieceAtIn(pieces, p.row + forward, p.col)) {
        add(p.row + forward, p.col);
        if (p.row === startRow && !this.intlPieceAtIn(pieces, p.row + forward * 2, p.col)) {
          add(p.row + forward * 2, p.col);
        }
      }
      for (const dc of [-1, 1]) {
        const cap = this.intlPieceAtIn(pieces, p.row + forward, p.col + dc);
        if (cap && cap.color !== p.color) add(p.row + forward, p.col + dc);
      }
    } else if (p.type === "K") {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          add(p.row + dr, p.col + dc);
        }
      }
    } else if (p.type === "N") {
      for (const [dr, dc] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]) {
        add(p.row + dr!, p.col + dc!);
      }
    } else if (p.type === "B") {
      moves.push(...this.intlRayMovesIn(p, pieces, [[1, 1], [1, -1], [-1, 1], [-1, -1]]));
    } else if (p.type === "R") {
      moves.push(...this.intlRayMovesIn(p, pieces, [[1, 0], [-1, 0], [0, 1], [0, -1]]));
    } else if (p.type === "Q") {
      moves.push(
        ...this.intlRayMovesIn(p, pieces, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]),
      );
    }
    return moves;
  }

  private intlApplyMove(pieces: Piece[], piece: Piece, move: BoardSquare): Piece[] {
    const captured = this.intlPieceAtIn(pieces, move.row, move.col);
    const rest = pieces.filter((x) => x !== piece && x !== captured);
    let type = piece.type;
    if (
      piece.type === "P" &&
      ((piece.color === "w" && move.row === 0) || (piece.color === "b" && move.row === this.boardRows - 1))
    ) {
      type = "Q";
    }
    return [...rest, { ...piece, type, row: move.row, col: move.col }];
  }

  private intlIsSquareAttacked(row: number, col: number, byColor: "w" | "b", pieces: Piece[]): boolean {
    for (const p of pieces.filter((x) => x.color === byColor)) {
      const attacks = this.intlPseudoMoves(p, pieces);
      if (attacks.some((m) => m.row === row && m.col === col)) return true;
    }
    return false;
  }

  private intlInCheck(color: "w" | "b", pieces: Piece[]): boolean {
    const king = this.intlKingOf(color, pieces);
    if (!king) return true;
    const enemy: "w" | "b" = color === "w" ? "b" : "w";
    return this.intlIsSquareAttacked(king.row, king.col, enemy, pieces);
  }

  private intlLegalMovesFiltered(p: Piece, pieces: Piece[]): BoardSquare[] {
    return this.intlPseudoMoves(p, pieces).filter((m) => !this.intlInCheck(p.color, this.intlApplyMove(pieces, p, m)));
  }

  private intlAllLegalMoves(color: "w" | "b", pieces: Piece[]): Array<{ piece: Piece; move: BoardSquare }> {
    const out: Array<{ piece: Piece; move: BoardSquare }> = [];
    for (const p of pieces.filter((x) => x.color === color)) {
      for (const move of this.intlLegalMovesFiltered(p, pieces)) {
        out.push({ piece: p, move });
      }
    }
    return out;
  }

  private xiangqiPieceAt(row: number, col: number): Piece | undefined {
    return this.xiangqiPieceAtIn(this.pieces, row, col);
  }

  private buildGoPieces(): Piece[] {
    return [];
  }

  private goKey(row: number, col: number): string {
    return `${row},${col}`;
  }

  private goStoneAtIn(pieces: Piece[], row: number, col: number): Piece | undefined {
    return pieces.find((x) => x.row === row && x.col === col);
  }

  private goNeighbors(row: number, col: number): BoardSquare[] {
    const out: BoardSquare[] = [];
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const r = row + dr!;
      const c = col + dc!;
      if (r >= 0 && r < this.boardRows && c >= 0 && c < this.boardCols) out.push({ row: r, col: c });
    }
    return out;
  }

  private goGroupAt(pieces: Piece[], row: number, col: number): Piece[] {
    const start = this.goStoneAtIn(pieces, row, col);
    if (!start) return [];
    const color = start.color;
    const visited = new Set<string>();
    const group: Piece[] = [];
    const stack: BoardSquare[] = [{ row, col }];
    while (stack.length) {
      const cur = stack.pop()!;
      const k = this.goKey(cur.row, cur.col);
      if (visited.has(k)) continue;
      visited.add(k);
      const stone = this.goStoneAtIn(pieces, cur.row, cur.col);
      if (!stone || stone.color !== color) continue;
      group.push(stone);
      for (const n of this.goNeighbors(cur.row, cur.col)) {
        if (!visited.has(this.goKey(n.row, n.col))) stack.push(n);
      }
    }
    return group;
  }

  private goLibertyCount(pieces: Piece[], group: Piece[]): number {
    const libs = new Set<string>();
    for (const s of group) {
      for (const n of this.goNeighbors(s.row, s.col)) {
        if (!this.goStoneAtIn(pieces, n.row, n.col)) libs.add(this.goKey(n.row, n.col));
      }
    }
    return libs.size;
  }

  private goRemoveDeadGroups(
    pieces: Piece[],
    victimColor: "w" | "b",
  ): { pieces: Piece[]; captured: number } {
    let board = [...pieces];
    const toRemove = new Set<Piece>();
    const seen = new Set<string>();
    for (const p of board.filter((x) => x.color === victimColor)) {
      const k = this.goKey(p.row, p.col);
      if (seen.has(k)) continue;
      const group = this.goGroupAt(board, p.row, p.col);
      for (const g of group) seen.add(this.goKey(g.row, g.col));
      if (this.goLibertyCount(board, group) === 0) {
        for (const g of group) toRemove.add(g);
      }
    }
    if (!toRemove.size) return { pieces: board, captured: 0 };
    board = board.filter((x) => !toRemove.has(x));
    return { pieces: board, captured: toRemove.size };
  }

  private goSimulatePlay(
    pieces: Piece[],
    row: number,
    col: number,
    color: "w" | "b",
  ): { ok: boolean; pieces: Piece[]; captured: number; ko: BoardSquare | null } {
    if (this.goStoneAtIn(pieces, row, col)) return { ok: false, pieces, captured: 0, ko: null };
    const stoneType = color === "w" ? "黑" : "白";
    let board: Piece[] = [...pieces, { color, type: stoneType, row, col }];
    const enemy: "w" | "b" = color === "w" ? "b" : "w";
    const removed = this.goRemoveDeadGroups(board, enemy);
    board = removed.pieces;
    const captured = removed.captured;
    const ownGroup = this.goGroupAt(board, row, col);
    if (!ownGroup.length || this.goLibertyCount(board, ownGroup) === 0) {
      return { ok: false, pieces, captured: 0, ko: null };
    }
    const ko = captured === 1 ? { row, col } : null;
    return { ok: true, pieces: board, captured, ko };
  }

  private goIsLegalPlay(row: number, col: number, color: "w" | "b"): boolean {
    if (this.goKoBan && row === this.goKoBan.row && col === this.goKoBan.col) return false;
    return this.goSimulatePlay(this.pieces, row, col, color).ok;
  }

  private goLegalIntersections(color: "w" | "b"): BoardSquare[] {
    const moves: BoardSquare[] = [];
    for (let r = 0; r < this.boardRows; r += 1) {
      for (let c = 0; c < this.boardCols; c += 1) {
        if (this.goIsLegalPlay(r, c, color)) moves.push({ row: r, col: c });
      }
    }
    return moves;
  }

  private goApplyPlay(row: number, col: number, color: "w" | "b"): boolean {
    const sim = this.goSimulatePlay(this.pieces, row, col, color);
    if (!sim.ok) return false;
    this.pieces = sim.pieces;
    this.goKoBan = sim.ko;
    if (color === "w") this.goCapturesW += sim.captured;
    else this.goCapturesB += sim.captured;
    if (sim.captured > 0) {
      this.banner.show({
        title: this.uiLocale === "zh-Hans" ? `提子 ×${sim.captured}` : `Capture ×${sim.captured}`,
        message:
          this.uiLocale === "zh-Hans"
            ? `黑提 ${this.goCapturesW} · 白提 ${this.goCapturesB}`
            : `B ${this.goCapturesB} · W ${this.goCapturesW}`,
        ms: 900,
      });
      juiceShake(this, { intensity: 0.008, durationMs: 100 });
    }
    if (sim.ko) {
      this.banner.show({
        title: this.uiLocale === "zh-Hans" ? "打劫" : "Ko",
        message: this.uiLocale === "zh-Hans" ? "对方下一手不可立即回提" : "Recapture forbidden next turn",
        ms: 1100,
      });
    }
    return true;
  }

  private refreshGoStatus() {
    if (this.ruleset !== "go" || this.finished) return;
    const cap =
      this.uiLocale === "zh-Hans"
        ? `提子 黑${this.goCapturesW}:白${this.goCapturesB}`
        : `Caps B${this.goCapturesB}:W${this.goCapturesW}`;
    if (this.whiteTurn) {
      this.statusText.setText(
        this.uiLocale === "zh-Hans" ? `你的回合 · ${cap}` : `Your turn · ${cap}`,
      );
      return;
    }
    this.statusText.setText(this.uiLocale === "zh-Hans" ? `黑方思考… · ${cap}` : `Black… · ${cap}`);
  }

  private buildJunglePieces(): Piece[] {
    const order = ["狮", "狗", "鼠", "豹", "狼", "猫", "虎", "象"];
    const pieces: Piece[] = [];
    for (let i = 0; i < order.length; i += 1) {
      const col = [0, 1, 0, 2, 4, 6, 5, 6][i]!;
      const row = [8, 7, 6, 6, 6, 6, 7, 8][i]!;
      pieces.push({ color: "w", type: order[i]!, row, col });
      pieces.push({ color: "b", type: order[i]!, row: this.boardRows - 1 - row, col: this.boardCols - 1 - col });
    }
    return pieces;
  }

  private publishQaState() {
    setPhaserQaState({
      moves: this.moves,
      qaTouches: this.moves,
      boardCols: this.boardCols,
      boardRows: this.boardRows,
      pieceCount: this.pieces.length,
      ruleset: this.ruleset,
      ...(this.ruleset === "go"
        ? {
            goCapturesW: this.goCapturesW,
            goCapturesB: this.goCapturesB,
            goKoBan: this.goKoBan ? `${this.goKoBan.row},${this.goKoBan.col}` : "",
          }
        : {}),
      ...(this.ruleset === "xiangqi" || this.ruleset === "international"
        ? {
            inCheck: this.checkTarget ?? "",
            redInCheck: this.inCheckFor("w", this.pieces),
            blackInCheck: this.inCheckFor("b", this.pieces),
          }
        : {}),
    });
  }

  private pieceGlyph(p: Piece): string {
    const map: Record<string, string> = {
      wK: "♔",
      wQ: "♕",
      wR: "♖",
      wB: "♗",
      wN: "♘",
      wP: "♙",
      bK: "♚",
      bQ: "♛",
      bR: "♜",
      bB: "♝",
      bN: "♞",
      bP: "♟",
    };
    if (this.ruleset === "go") return "";
    if (this.ruleset === "jungle") return this.junglePieceText(p);
    if (this.ruleset === "xiangqi") return p.type;
    return map[`${p.color}${p.type}`] ?? "?";
  }

  private drawGoStone(cx: number, cy: number, p: Piece) {
    const isBlack = p.type === "黑" || p.color === "w";
    const fill = isBlack ? 0x0f172a : 0xf8fafc;
    const rim = isBlack ? 0x020617 : 0xcbd5e1;
    const shine = isBlack ? 0x475569 : 0xffffff;
    this.boardGfx.fillStyle(0x000000, 0.22);
    this.boardGfx.fillCircle(cx + this.cell * 0.06, cy + this.cell * 0.08, this.cell * 0.43);
    this.boardGfx.fillStyle(fill, 1);
    this.boardGfx.lineStyle(2, rim, 0.95);
    this.boardGfx.fillCircle(cx, cy, this.cell * 0.43);
    this.boardGfx.strokeCircle(cx, cy, this.cell * 0.43);
    this.boardGfx.fillStyle(shine, isBlack ? 0.22 : 0.7);
    this.boardGfx.fillCircle(cx - this.cell * 0.13, cy - this.cell * 0.14, this.cell * 0.12);
  }

  private drawXiangqiBoard() {
    this.boardGfx.fillStyle(0xe7b66a, 1);
    this.boardGfx.fillRoundedRect(this.ox - 18, this.oy - 18, this.cell * this.boardCols + 36, this.cell * this.boardRows + 36, 18);
    this.boardGfx.lineStyle(2, 0x7c2d12, 0.92);
    const x = (c: number) => this.ox + c * this.cell + this.cell / 2;
    const y = (r: number) => this.oy + r * this.cell + this.cell / 2;
    for (let r = 0; r < this.boardRows; r += 1) {
      this.boardGfx.lineBetween(x(0), y(r), x(8), y(r));
    }
    for (let c = 0; c < this.boardCols; c += 1) {
      this.boardGfx.lineBetween(x(c), y(0), x(c), y(4));
      this.boardGfx.lineBetween(x(c), y(5), x(c), y(9));
    }
    this.boardGfx.lineStyle(3, 0x7c2d12, 0.95);
    this.boardGfx.strokeRoundedRect(this.ox, this.oy, this.cell * this.boardCols, this.cell * this.boardRows, 8);
    this.boardGfx.lineBetween(x(3), y(0), x(5), y(2));
    this.boardGfx.lineBetween(x(5), y(0), x(3), y(2));
    this.boardGfx.lineBetween(x(3), y(7), x(5), y(9));
    this.boardGfx.lineBetween(x(5), y(7), x(3), y(9));
  }

  private drawXiangqiPiece(cx: number, cy: number, p: Piece) {
    const redSide = p.color === "w";
    this.boardGfx.fillStyle(0x000000, 0.2);
    this.boardGfx.fillCircle(cx + this.cell * 0.05, cy + this.cell * 0.06, this.cell * 0.39);
    this.boardGfx.fillStyle(0xfff7ed, 1);
    this.boardGfx.lineStyle(3, redSide ? 0xdc2626 : 0x111827, 0.98);
    this.boardGfx.fillCircle(cx, cy, this.cell * 0.39);
    this.boardGfx.strokeCircle(cx, cy, this.cell * 0.39);
  }

  private jungleAnimalIcon(type: string): string {
    const icons: Record<string, string> = {
      象: "🐘",
      狮: "🦁",
      虎: "🐯",
      豹: "🐆",
      狼: "🐺",
      狗: "🐶",
      猫: "🐱",
      鼠: "🐭",
    };
    return icons[type] ?? "🐾";
  }

  private junglePieceText(p: Piece): string {
    return `${this.jungleAnimalIcon(p.type)}\n${p.type}`;
  }

  private redraw() {
    this.boardGfx.clear();
    this.legalGfx.clear();
    this.riverTexts.forEach((t) => t.destroy());
    this.riverTexts = [];
    if (this.ruleset === "xiangqi") {
      this.drawXiangqiBoard();
    } else {
      for (let r = 0; r < this.boardRows; r += 1) {
        for (let c = 0; c < this.boardCols; c += 1) {
          const light = (r + c) % 2 === 0;
          const skew = this.isometricHints ? (r - 3.5) * 2.5 : 0;
          const tileColor = this.boardTileColor(r, c, light);
          this.boardGfx.fillStyle(tileColor, 1);
          this.boardGfx.fillRect(this.ox + c * this.cell + skew * 0.15, this.oy + r * this.cell, this.cell, this.cell);
          if (this.isometricHints && light) {
            this.boardGfx.lineStyle(1, 0xfafafa, 0.35);
            this.boardGfx.strokeRect(this.ox + c * this.cell + skew * 0.15, this.oy + r * this.cell, this.cell, this.cell);
          }
        }
      }
    }
    if (this.ruleset === "xiangqi") {
      this.boardGfx.lineStyle(2, 0x92400e, 0.6);
      this.boardGfx.strokeRect(this.ox, this.oy, this.cell * this.boardCols, this.cell * this.boardRows);
      this.riverTexts.push(styleHudText(
        this.add
          .text(this.ox + this.cell * 2.2, this.oy + this.cell * 4.55, "楚河", { fontSize: "18px", color: "#fbbf24" })
          .setDepth(2),
      ));
      this.riverTexts.push(styleHudText(
        this.add
          .text(this.ox + this.cell * 5.5, this.oy + this.cell * 4.55, "汉界", { fontSize: "18px", color: "#fbbf24" })
          .setDepth(2),
      ));
    }
    if (this.ruleset === "go") {
      this.boardGfx.lineStyle(1, 0x5f3b17, 0.88);
      for (let r = 0; r < this.boardRows; r += 1) {
        const y = this.oy + r * this.cell + this.cell / 2;
        this.boardGfx.lineBetween(this.ox + this.cell / 2, y, this.ox + (this.boardCols - 0.5) * this.cell, y);
      }
      for (let c = 0; c < this.boardCols; c += 1) {
        const x = this.ox + c * this.cell + this.cell / 2;
        this.boardGfx.lineBetween(x, this.oy + this.cell / 2, x, this.oy + (this.boardRows - 0.5) * this.cell);
      }
      for (const r of [3, 9, 15]) {
        for (const c of [3, 9, 15]) {
          this.boardGfx.fillStyle(0x5f3b17, 0.9);
          this.boardGfx.fillCircle(this.ox + (c + 0.5) * this.cell, this.oy + (r + 0.5) * this.cell, Math.max(2, this.cell * 0.09));
        }
      }
    }
    if (this.ruleset === "jungle") {
      this.riverTexts.push(styleHudText(
        this.add
          .text(this.ox + this.cell * 2.05, this.oy + this.cell * 4.3, this.uiLocale === "zh-Hans" ? "河流" : "River", { fontSize: "14px", color: "#0f172a" })
          .setDepth(2),
      ));
      this.riverTexts.push(styleHudText(
        this.add
          .text(this.ox + this.cell * 2.8, this.oy + this.cell * 0.05, this.uiLocale === "zh-Hans" ? "兽穴" : "Den", { fontSize: "13px", color: "#7f1d1d" })
          .setDepth(2),
      ));
    }
    this.pieceTexts.forEach((t) => t.destroy());
    this.pieceTexts = [];
    for (const p of this.pieces) {
      const skew = this.isometricHints ? (p.row - 3.5) * 2 : 0;
      const cx = this.ox + p.col * this.cell + this.cell / 2 + skew * 0.15;
      const cy = this.oy + p.row * this.cell + this.cell / 2;
      if (this.ruleset === "jungle") {
        this.boardGfx.fillStyle(p.color === "w" ? 0xfff7ed : 0x1e3a8a, 0.96);
        this.boardGfx.lineStyle(3, p.color === "w" ? 0xdc2626 : 0x0f172a, 0.95);
        this.boardGfx.fillCircle(cx, cy, this.cell * 0.38);
        this.boardGfx.strokeCircle(cx, cy, this.cell * 0.38);
      } else if (this.ruleset === "go") {
        this.drawGoStone(cx, cy, p);
      } else if (this.ruleset === "xiangqi") {
        this.drawXiangqiPiece(cx, cy, p);
      }
      const t = this.add
        .text(
          cx,
          cy,
          this.pieceGlyph(p),
          {
            fontSize: `${Math.round(this.cell * (this.ruleset === "jungle" ? 0.3 : 0.62))}px`,
            color:
              this.ruleset === "go"
                ? p.color === "w"
                  ? "#111827"
                  : "#f8fafc"
                : this.ruleset === "jungle"
                  ? p.color === "w"
                    ? "#7f1d1d"
                    : "#f8fafc"
                  : this.ruleset === "xiangqi"
                    ? p.color === "w"
                      ? "#dc2626"
                      : "#111827"
                    : p.color === "w"
                      ? "#fafafa"
                      : "#1c1917",
            align: "center",
            fontStyle: this.ruleset === "jungle" ? "700" : undefined,
          })
        .setOrigin(0.5)
        .setDepth(4);
      if (this.ruleset === "jungle") t.setLineSpacing(-5);
      this.pieceTexts.push(t);
    }
    if (this.selected && (this.spec.samplePlayProfile?.chess?.showLegalMoves || this.spec.chess?.showLegalMoves)) {
      this.drawLegalMoves(this.selected);
    }
    if (
      (this.ruleset === "xiangqi" || this.ruleset === "international") &&
      this.checkTarget &&
      !this.finished
    ) {
      const threatened = this.leaderOf(this.checkTarget, this.pieces);
      if (threatened) {
        const skew = this.isometricHints ? (threatened.row - 3.5) * 2 : 0;
        const cx = this.ox + threatened.col * this.cell + this.cell / 2 + skew * 0.15;
        const cy = this.oy + threatened.row * this.cell + this.cell / 2;
        this.legalGfx.lineStyle(4, 0xef4444, 0.92);
        this.legalGfx.strokeCircle(cx, cy, this.cell * 0.44);
        this.legalGfx.fillStyle(0xef4444, 0.12);
        this.legalGfx.fillCircle(cx, cy, this.cell * 0.44);
      }
    }
  }

  private drawLegalMoves(p: Piece) {
    const moves = this.legalMovesFor(p);
    for (const m of moves) {
      if (m.row < 0 || m.row >= this.boardRows || m.col < 0 || m.col >= this.boardCols) continue;
      const skew = this.isometricHints ? (m.row - 3.5) * 2 : 0;
      const cx = this.ox + m.col * this.cell + this.cell / 2 + skew * 0.15;
      const cy = this.oy + m.row * this.cell + this.cell / 2;
      this.legalGfx.fillStyle(0x4ade80, 0.35);
      this.legalGfx.fillCircle(cx, cy, this.cell * 0.18);
    }
  }

  private boardTileColor(r: number, c: number, light: boolean): number {
    if (this.ruleset === "go") return 0xf3b562;
    if (this.ruleset === "jungle") return this.jungleTileColor(r, c, light);
    if (this.isometricHints) return light ? 0xe7e5e4 : 0x78716c;
    return light ? 0xd6d3d1 : 0x57534e;
  }

  private jungleTileColor(r: number, c: number, light: boolean): number {
    const isRiver = r >= 3 && r <= 5 && ((c >= 1 && c <= 2) || (c >= 4 && c <= 5));
    const isTrap = ["0,2", "0,4", "1,3", "7,3", "8,2", "8,4"].includes(`${r},${c}`);
    const isDen = (r === 0 || r === 8) && c === 3;
    if (isRiver) return 0x38bdf8;
    if (isTrap) return 0xfca5a5;
    if (isDen) return 0xfacc15;
    return light ? 0xfef9c3 : 0x86efac;
  }

  private jungleIsRiver(row: number, col: number): boolean {
    return row >= 3 && row <= 5 && ((col >= 1 && col <= 2) || (col >= 4 && col <= 5));
  }

  private jungleIsOwnDen(color: "w" | "b", row: number, col: number): boolean {
    return col === 3 && (color === "w" ? row === 8 : row === 0);
  }

  private jungleIsTrap(color: "w" | "b", row: number, col: number): boolean {
    const traps =
      color === "w"
        ? ["0,2", "0,4", "1,3", "7,3", "8,2", "8,4"]
        : ["8,2", "8,4", "7,3", "1,3", "0,2", "0,4"];
    return traps.includes(`${row},${col}`);
  }

  private jungleCanStepTo(p: Piece, row: number, col: number): boolean {
    if (this.jungleIsOwnDen(p.color, row, col)) return false;
    if (this.jungleIsRiver(row, col) && p.type !== "鼠") return false;
    return true;
  }

  private jungleLegalMoves(p: Piece): BoardSquare[] {
    const own = (row: number, col: number) =>
      this.pieces.some((x) => x.row === row && x.col === col && x.color === p.color);
    const inside = (row: number, col: number) =>
      row >= 0 && row < this.boardRows && col >= 0 && col < this.boardCols && !own(row, col);
    const moves: BoardSquare[] = [];
    const tryAdd = (row: number, col: number) => {
      if (!inside(row, col) || !this.jungleCanStepTo(p, row, col)) return;
      const target = this.pieces.find((x) => x.row === row && x.col === col);
      if (!target || this.jungleCanCapture(p, target)) moves.push({ row, col });
    };
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      tryAdd(p.row + dr!, p.col + dc!);
    }
    if (p.type === "狮" || p.type === "虎") {
      const jumpRow = p.color === "w" ? 2 : 6;
      const landRow = p.color === "w" ? 6 : 2;
      if (p.row === jumpRow && p.col === 3) {
        const blocked = this.pieces.some((x) => x.col === 3 && x.row > Math.min(jumpRow, landRow) && x.row < Math.max(jumpRow, landRow));
        if (!blocked) tryAdd(landRow, 3);
      }
    }
    return moves;
  }

  private jungleCanCapture(attacker: Piece, target: Piece): boolean {
    const rank: Record<string, number> = { 鼠: 1, 猫: 2, 狗: 3, 狼: 4, 豹: 5, 虎: 6, 狮: 7, 象: 8 };
    if (attacker.type === "鼠" && target.type === "象") return true;
    if (attacker.type === "象" && target.type === "鼠") return false;
    const attackerInTrap = this.jungleIsTrap(attacker.color, attacker.row, attacker.col);
    const targetInTrap = this.jungleIsTrap(target.color, target.row, target.col);
    const aRank = rank[attacker.type] ?? 0;
    const tRank = rank[target.type] ?? 0;
    if (targetInTrap) return aRank >= tRank || attacker.type === "鼠";
    if (attackerInTrap) return aRank > tRank;
    return aRank >= tRank;
  }

  private onBoardClick(p: Phaser.Input.Pointer) {
    if (!this.whiteTurn || this.finished) return;
    const col = Math.floor((p.x - this.ox) / this.cell);
    const row = Math.floor((p.y - this.oy) / this.cell);
    if (col < 0 || col >= this.boardCols || row < 0 || row >= this.boardRows) return;

    const hit = this.pieces.find((x) => x.row === row && x.col === col);
    if (this.ruleset === "go") {
      if (hit) return;
      if (!this.goApplyPlay(row, col, "w")) {
        this.banner.show({
          title: this.uiLocale === "zh-Hans" ? "禁着点" : "Illegal",
          message: this.uiLocale === "zh-Hans" ? "自杀或打劫禁入" : "Suicide or ko",
          ms: 1000,
        });
        return;
      }
      this.moves += 1;
      this.publishQaState();
      bumpQaTouch();
      playBleep("pickup");
      this.whiteTurn = false;
      this.refreshGoStatus();
      this.redraw();
      juiceFlash(this, { r: 250, g: 250, b: 250 }, { durationMs: 150 });
      this.time.delayedCall(360, () => this.blackMove());
      return;
    }
    if (!this.selected && hit?.color === "w") {
      this.selected = hit;
      this.statusText.setText(hudChessPieceSelected(this.uiLocale));
      juiceFlash(this, { r: 74, g: 222, b: 128 }, { durationMs: 120 });
      this.redraw();
      return;
    }
    if (this.selected) {
      if (!this.legalMovesFor(this.selected).some((m) => m.row === row && m.col === col)) {
        this.selected = null;
        this.redraw();
        return;
      }
      const moving = this.selected;
      const move = { row, col };
      if (this.ruleset === "xiangqi" || this.ruleset === "international") {
        this.pieces = this.applyBoardMove(this.pieces, moving, move);
      } else {
        const cap = this.pieces.find((x) => x.row === row && x.col === col && x.color === "b");
        if (cap) this.pieces = this.pieces.filter((x) => x !== cap);
        moving.row = row;
        moving.col = col;
      }
      this.selected = null;
      this.moves += 1;
      this.publishQaState();
      bumpQaTouch();
      playBleep("pickup");
      this.redraw();
      juiceFlash(this, { r: 250, g: 250, b: 250 }, { durationMs: 150 });

      if (this.ruleset === "xiangqi" || this.ruleset === "international") {
        this.whiteTurn = false;
        this.afterMoveStatus("w");
        if (!this.finished) this.time.delayedCall(500, () => this.blackMove());
        return;
      }

      this.whiteTurn = false;
      this.statusText.setText(hudChessThinkingBlack(this.uiLocale));
      this.time.delayedCall(500, () => this.blackMove());
    }
  }

  update() {
    this.banner.tick();
  }

  private rayMoves(p: Piece, dirs: number[][]): Array<{ row: number; col: number }> {
    const moves: Array<{ row: number; col: number }> = [];
    for (const [dr, dc] of dirs) {
      for (let step = 1; step < Math.max(this.boardCols, this.boardRows); step += 1) {
        const row = p.row + dr! * step;
        const col = p.col + dc! * step;
        if (row < 0 || row >= this.boardRows || col < 0 || col >= this.boardCols) break;
        const occupant = this.pieces.find((x) => x.row === row && x.col === col);
        if (!occupant) {
          moves.push({ row, col });
          continue;
        }
        if (occupant.color !== p.color) moves.push({ row, col });
        break;
      }
    }
    return moves;
  }

  private legalMovesFor(p: Piece): Array<{ row: number; col: number }> {
    const own = (row: number, col: number) => this.pieces.some((x) => x.row === row && x.col === col && x.color === p.color);
    const inside = (row: number, col: number) => row >= 0 && row < this.boardRows && col >= 0 && col < this.boardCols && !own(row, col);
    if (this.ruleset === "go") {
      return this.goLegalIntersections(p.color);
    }
    if (this.ruleset === "jungle") {
      return this.jungleLegalMoves(p);
    }
    if (this.ruleset === "international") {
      return this.intlLegalMovesFiltered(p, this.pieces);
    }

    return this.xiangqiLegalMovesFiltered(p, this.pieces);
  }

  private blackMove() {
    if (this.finished) return;
    if (this.ruleset === "go") {
      const legal = this.goLegalIntersections("b");
      const move = pickSeededFromArray(legal, this.runtimeRng);
      if (move) this.goApplyPlay(move.row, move.col, "b");
      this.whiteTurn = true;
      this.refreshGoStatus();
      this.redraw();
      this.publishQaState();
      if (this.moves >= this.winMoves) this.finish(true);
      return;
    }
    if (this.ruleset === "xiangqi") {
      const candidates = this.xiangqiAllLegalMoves("b", this.pieces);
      if (candidates.length === 0) {
        if (this.xiangqiInCheck("b", this.pieces)) this.finishCheckmate("w");
        else this.finishStalemate();
        return;
      }
      const captureGeneral = candidates.find(({ move }) =>
        this.pieces.some((x) => x.color === "w" && x.type === "帅" && x.row === move.row && x.col === move.col),
      );
      const capture = candidates.find(({ move }) =>
        this.pieces.some((x) => x.color === "w" && x.row === move.row && x.col === move.col),
      );
      const chosen = captureGeneral ?? capture ?? pickSeededFromArray(candidates, this.runtimeRng);
      if (chosen) {
        this.pieces = this.xiangqiApplyMove(this.pieces, chosen.piece, chosen.move);
        this.moves += 1;
      }
      this.whiteTurn = true;
      this.publishQaState();
      this.redraw();
      this.afterMoveStatus("b");
      return;
    }
    if (this.ruleset === "international") {
      const candidates = this.intlAllLegalMoves("b", this.pieces);
      if (candidates.length === 0) {
        if (this.intlInCheck("b", this.pieces)) this.finishCheckmate("w");
        else this.finishStalemate();
        return;
      }
      const captureKing = candidates.find(({ move }) =>
        this.pieces.some((x) => x.color === "w" && x.type === "K" && x.row === move.row && x.col === move.col),
      );
      const capture = candidates.find(({ move }) =>
        this.pieces.some((x) => x.color === "w" && x.row === move.row && x.col === move.col),
      );
      const chosen = captureKing ?? capture ?? pickSeededFromArray(candidates, this.runtimeRng);
      if (chosen) {
        this.pieces = this.intlApplyMove(this.pieces, chosen.piece, chosen.move);
        this.moves += 1;
      }
      this.whiteTurn = true;
      this.publishQaState();
      this.redraw();
      this.afterMoveStatus("b");
      return;
    }
    const blacks = this.pieces.filter((p) => p.color === "b");
    const candidates = blacks.flatMap((p) => this.legalMovesFor(p).map((move) => ({ p, move })));
    const capture = candidates.find(({ move }) => this.pieces.some((x) => x.color === "w" && x.row === move.row && x.col === move.col));
    const chosen = capture ?? pickSeededFromArray(candidates, this.runtimeRng);
    if (chosen) {
      const cap = this.pieces.find((x) => x.color === "w" && x.row === chosen.move.row && x.col === chosen.move.col);
      if (cap) this.pieces = this.pieces.filter((x) => x !== cap);
      chosen.p.row = chosen.move.row;
      chosen.p.col = chosen.move.col;
    }
    this.whiteTurn = true;
    this.statusText.setText(hudChessTurnWhiteShort(this.uiLocale));
    this.redraw();
    this.publishQaState();
    if (this.pieces.filter((p) => p.color === "b").length === 0 || this.moves >= this.winMoves) {
      this.finish(true);
    }
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.cameras.main.shake(won ? 300 : 240, won ? 0.007 : 0.009);
    if (this.ruleset !== "xiangqi" && this.ruleset !== "international") {
      this.banner.show({ ...bannerChessFinish(this.uiLocale), ms: 1800 });
    }
    this.time.delayedCall(2000, () => this.onEnd({ score: this.moves * 15, won }));
  }
}
