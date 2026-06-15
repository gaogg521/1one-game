import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";
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
import { schedulePhaserPlayReady, setPhaserQaClickHints } from "@/game/engine/phaser-play-ready";
import { juiceFlash } from "@/game/engine/gameJuice";

type EndPayload = { score: number; won: boolean };
type Piece = { color: "w" | "b"; type: "K" | "P"; row: number; col: number };

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
  private cell = 48;
  private ox = 0;
  private oy = 80;
  private boardGfx!: Phaser.GameObjects.Graphics;
  private pieceTexts: Phaser.GameObjects.Text[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private cohesive!: CohesivePresentation;
  private legalGfx!: Phaser.GameObjects.Graphics;
  private winMoves = 8;
  private isometricHints = false;
  private runtimeRng!: () => number;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "ChessScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  create() {
    const cohesive = buildCohesivePresentation(this.spec);
    setBleepTemperament(cohesive.bleepTemperament);
    this.cohesive = cohesive;
    this.runtimeRng = seededRandom(runtimeSeedFromSpec(this.spec));

    const chessPf = this.spec.samplePlayProfile?.chess;
    this.winMoves = chessPf?.winMoves ?? 8;
    this.isometricHints = chessPf?.isometricHints ?? false;

    const w = this.scale.width;
    const h = this.scale.height;
    this.cell = Math.min(52, (w - 60) / 8);
    this.ox = (w - this.cell * 8) / 2;
    this.boardGfx = this.add.graphics();
    this.legalGfx = this.add.graphics().setDepth(3);

    this.pieces = [
      { color: "w", type: "K", row: 7, col: 4 },
      { color: "w", type: "P", row: 6, col: 3 },
      { color: "w", type: "P", row: 6, col: 4 },
      { color: "b", type: "K", row: 0, col: 4 },
      { color: "b", type: "P", row: 1, col: 2 },
      { color: "b", type: "P", row: 1, col: 5 },
    ];

    this.statusText = styleHudText(
      this.add.text(16, 12, hudChessTurnWhite(this.uiLocale), { fontSize: "16px", color: "#fff" }),
    );
    this.banner = new HudBanner(this, this.cohesive.banner);
    this.banner.show({ title: hudReady(this.uiLocale), ms: 1200 });

    if (chessPf?.isometricHints) {
      this.statusText.setText(
        this.uiLocale === "zh-Hans" ? "3D 视角 · 白方先行 · 点击走子" : "3D view · White to move",
      );
    }

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onBoardClick(p));
    this.redraw();
    schedulePhaserPlayReady(this, 400);
    const pawn = this.pieces.find((p) => p.color === "w" && p.type === "P");
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

  private pieceGlyph(p: Piece): string {
    const map: Record<string, string> = { wK: "♔", wP: "♙", bK: "♚", bP: "♟" };
    return map[`${p.color}${p.type}`] ?? "?";
  }

  private redraw() {
    this.boardGfx.clear();
    this.legalGfx.clear();
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const light = (r + c) % 2 === 0;
        const skew = this.isometricHints ? (r - 3.5) * 2 : 0;
        this.boardGfx.fillStyle(light ? 0xd6d3d1 : 0x57534e, 1);
        this.boardGfx.fillRect(this.ox + c * this.cell + skew * 0.15, this.oy + r * this.cell, this.cell, this.cell);
        if (this.isometricHints && light) {
          this.boardGfx.lineStyle(1, 0xfafafa, 0.25);
          this.boardGfx.strokeRect(this.ox + c * this.cell + skew * 0.15, this.oy + r * this.cell, this.cell, this.cell);
        }
      }
    }
    this.pieceTexts.forEach((t) => t.destroy());
    this.pieceTexts = [];
    for (const p of this.pieces) {
      const skew = this.isometricHints ? (p.row - 3.5) * 2 : 0;
      const t = this.add
        .text(
          this.ox + p.col * this.cell + this.cell / 2 + skew * 0.15,
          this.oy + p.row * this.cell + this.cell / 2,
          this.pieceGlyph(p),
          {
          fontSize: `${Math.round(this.cell * 0.62)}px`,
          color: p.color === "w" ? "#fafafa" : "#1c1917",
        })
        .setOrigin(0.5);
      this.pieceTexts.push(t);
    }
    if (this.selected && this.spec.samplePlayProfile?.chess?.showLegalMoves) {
      this.drawLegalMoves(this.selected);
    }
  }

  private drawLegalMoves(p: Piece) {
    const moves: Array<{ row: number; col: number }> = [];
    if (p.type === "P") {
      moves.push({ row: p.row - 1, col: p.col });
      if (p.row === 6) moves.push({ row: p.row - 2, col: p.col });
      for (const dc of [-1, 1]) {
        const cap = this.pieces.find((x) => x.row === p.row - 1 && x.col === p.col + dc && x.color === "b");
        if (cap) moves.push({ row: p.row - 1, col: p.col + dc });
      }
    } else {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          moves.push({ row: p.row + dr, col: p.col + dc });
        }
      }
    }
    for (const m of moves) {
      if (m.row < 0 || m.row > 7 || m.col < 0 || m.col > 7) continue;
      const skew = this.isometricHints ? (m.row - 3.5) * 2 : 0;
      const cx = this.ox + m.col * this.cell + this.cell / 2 + skew * 0.15;
      const cy = this.oy + m.row * this.cell + this.cell / 2;
      this.legalGfx.fillStyle(0x4ade80, 0.35);
      this.legalGfx.fillCircle(cx, cy, this.cell * 0.18);
    }
  }

  private onBoardClick(p: Phaser.Input.Pointer) {
    if (!this.whiteTurn) return;
    const col = Math.floor((p.x - this.ox) / this.cell);
    const row = Math.floor((p.y - this.oy) / this.cell);
    if (col < 0 || col > 7 || row < 0 || row > 7) return;

    const hit = this.pieces.find((x) => x.row === row && x.col === col);
    if (!this.selected && hit?.color === "w") {
      this.selected = hit;
      this.statusText.setText(hudChessPieceSelected(this.uiLocale));
      juiceFlash(this, { r: 74, g: 222, b: 128 }, { durationMs: 120 });
      this.redraw();
      return;
    }
    if (this.selected) {
      const cap = this.pieces.find((x) => x.row === row && x.col === col && x.color === "b");
      if (cap) this.pieces = this.pieces.filter((x) => x !== cap);
      this.selected.row = row;
      this.selected.col = col;
      this.selected = null;
      this.moves += 1;
      playBleep("pickup");
      this.whiteTurn = false;
      this.statusText.setText(hudChessThinkingBlack(this.uiLocale));
      this.redraw();
      juiceFlash(this, { r: 250, g: 250, b: 250 }, { durationMs: 150 });
      this.time.delayedCall(500, () => this.blackMove());
    }
  }

  private blackMove() {
    const blacks = this.pieces.filter((p) => p.color === "b");
    const pick = pickSeededFromArray(blacks, this.runtimeRng);
    if (pick) pick.row = Math.min(7, pick.row + 1);
    this.whiteTurn = true;
    this.statusText.setText(hudChessTurnWhiteShort(this.uiLocale));
    this.redraw();
    if (this.pieces.filter((p) => p.color === "b").length === 0 || this.moves >= this.winMoves) {
      this.banner.show({ ...bannerChessFinish(this.uiLocale), ms: 1800 });
      this.time.delayedCall(2000, () => this.onEnd({ score: this.moves * 15, won: true }));
    }
  }
}
