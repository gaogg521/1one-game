import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";
import type { GameSpec } from "@/lib/game-spec";
import { hudReady } from "@/lib/i18n/game-hud-labels";

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

    const w = this.scale.width;
    this.cell = Math.min(52, (w - 60) / 8);
    this.ox = (w - this.cell * 8) / 2;
    this.boardGfx = this.add.graphics();

    this.pieces = [
      { color: "w", type: "K", row: 7, col: 4 },
      { color: "w", type: "P", row: 6, col: 3 },
      { color: "w", type: "P", row: 6, col: 4 },
      { color: "b", type: "K", row: 0, col: 4 },
      { color: "b", type: "P", row: 1, col: 2 },
      { color: "b", type: "P", row: 1, col: 5 },
    ];

    this.statusText = styleHudText(
      this.add.text(16, 12, "白方回合 · 点击棋子再点目标格", { fontSize: "16px", color: "#fff" }),
    );
    this.banner = new HudBanner(this, this.cohesive.banner);
    this.banner.show({ title: hudReady(this.uiLocale), ms: 1200 });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onBoardClick(p));
    this.redraw();
  }

  private pieceGlyph(p: Piece): string {
    const map: Record<string, string> = { wK: "♔", wP: "♙", bK: "♚", bP: "♟" };
    return map[`${p.color}${p.type}`] ?? "?";
  }

  private redraw() {
    this.boardGfx.clear();
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const light = (r + c) % 2 === 0;
        this.boardGfx.fillStyle(light ? 0xd6d3d1 : 0x57534e, 1);
        this.boardGfx.fillRect(this.ox + c * this.cell, this.oy + r * this.cell, this.cell, this.cell);
      }
    }
    this.pieceTexts.forEach((t) => t.destroy());
    this.pieceTexts = [];
    for (const p of this.pieces) {
      const t = this.add
        .text(this.ox + p.col * this.cell + this.cell / 2, this.oy + p.row * this.cell + this.cell / 2, this.pieceGlyph(p), {
          fontSize: `${Math.round(this.cell * 0.62)}px`,
          color: p.color === "w" ? "#fafafa" : "#1c1917",
        })
        .setOrigin(0.5);
      this.pieceTexts.push(t);
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
      this.statusText.setText("已选棋子 · 选择目标格");
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
      this.statusText.setText("黑方思考…");
      this.redraw();
      this.time.delayedCall(500, () => this.blackMove());
    }
  }

  private blackMove() {
    const blacks = this.pieces.filter((p) => p.color === "b");
    const pick = blacks[Math.floor(Math.random() * blacks.length)];
    if (pick) pick.row = Math.min(7, pick.row + 1);
    this.whiteTurn = true;
    this.statusText.setText("白方回合");
    this.redraw();
    if (this.pieces.filter((p) => p.color === "b").length === 0 || this.moves >= 8) {
      this.banner.show({ title: "对局完成", ms: 1800 });
      this.time.delayedCall(2000, () => this.onEnd({ score: this.moves * 15, won: true }));
    }
  }
}
