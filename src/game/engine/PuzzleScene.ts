import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { juiceBurst } from "@/game/engine/gameJuice";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildPuzzleBlueprint, type PuzzleMode } from "@/lib/puzzle-blueprint";
import type { GameSpec } from "@/lib/game-spec";
import { hudReady, hudScore } from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

const COLORS = ["#f472b6", "#a78bfa", "#38bdf8", "#4ade80", "#fbbf24", "#fb7185"];

/** 益智专用运行时：match3 / 找不同 / 记忆翻牌 / 拼图 */
export class PuzzleScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private mode: PuzzleMode = "match3";
  private score = 0;
  private moves = 0;
  private moveLimit = 30;
  private target = 100;
  private finished = false;
  private scoreText!: Phaser.GameObjects.Text;
  private moveText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private cohesive!: CohesivePresentation;

  private grid: number[][] = [];
  private cell = 44;
  private ox = 0;
  private oy = 90;
  private gridGfx!: Phaser.GameObjects.Graphics;

  private diffMarks: boolean[] = [];
  private foundDiff = 0;
  private cards: Array<{ id: number; face: boolean; matched: boolean; x: number; y: number; rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = [];
  private flipped: typeof this.cards = [];
  private jigsawSlots: Phaser.GameObjects.Rectangle[] = [];
  private jigsawDone = 0;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "PuzzleScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  create() {
    const cohesive = buildCohesivePresentation(this.spec);
    setBleepTemperament(cohesive.bleepTemperament);
    this.cohesive = cohesive;
    const bp = this.spec.puzzle ?? buildPuzzleBlueprint({ spec: this.spec });
    this.mode = bp.mode;
    this.target = bp.targetScore;
    this.moveLimit = bp.moveLimit;

    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, Phaser.Display.Color.HexStringToColor(this.spec.theme.backgroundColor).color);

    this.scoreText = styleHudText(
      this.add.text(16, 12, hudScore(this.uiLocale, 0), { fontSize: "18px", color: "#fff" }),
    );
    this.moveText = styleHudText(
      this.add.text(16, 38, `步数 ${this.moves}/${this.moveLimit}`, { fontSize: "15px", color: "#cbd5e1" }),
    );
    this.banner = new HudBanner(this, this.cohesive.banner);
    this.banner.show({ title: hudReady(this.uiLocale), ms: 1200 });
    this.gridGfx = this.add.graphics();

    switch (this.mode) {
      case "spotDifference":
        this.buildSpotDifference(w, h);
        break;
      case "memoryMatch":
        this.buildMemoryMatch(bp.cols, bp.rows, w);
        break;
      case "jigsaw":
        this.buildJigsaw(w, h);
        break;
      default:
        this.buildMatch3(bp.cols, bp.rows, w);
    }
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.banner.show({ title: won ? "益智目标达成！" : "步数用尽", ms: 2000 });
    this.time.delayedCall(2200, () => this.onEnd({ score: this.score, won }));
  }

  private addMove(cost = 1) {
    this.moves += cost;
    this.moveText.setText(`步数 ${this.moves}/${this.moveLimit}`);
    if (this.moves >= this.moveLimit && this.score < this.target) this.finish(false);
  }

  private buildMatch3(cols: number, rows: number, w: number) {
    this.cell = Math.min(48, (w - 40) / cols);
    this.ox = (w - this.cell * cols) / 2;
    this.grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.floor(Math.random() * COLORS.length)),
    );
    this.redrawMatch3(cols, rows);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.finished) return;
      const c = Math.floor((p.x - this.ox) / this.cell);
      const r = Math.floor((p.y - this.oy) / this.cell);
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      const color = this.grid[r]![c]!;
      const group = this.floodMatch3(r, c, color, new Set());
      if (group.size < 2) return;
      for (const key of group) {
        const [rr, cc] = key.split(",").map(Number);
        this.grid[rr]![cc] = -1;
      }
      this.collapseMatch3(cols, rows);
      const gain = group.size * group.size * 3;
      this.score += gain;
      this.scoreText.setText(hudScore(this.uiLocale, this.score));
      juiceBurst(this, p.x, p.y, COLORS[color] ?? "#fff", Math.min(12, group.size));
      playBleep("pickup");
      this.addMove();
      this.redrawMatch3(cols, rows);
      if (this.score >= this.target) this.finish(true);
    });
  }

  private floodMatch3(r: number, c: number, color: number, seen: Set<string>): Set<string> {
    const key = `${r},${c}`;
    if (seen.has(key)) return seen;
    if (this.grid[r]?.[c] !== color) return seen;
    seen.add(key);
    this.floodMatch3(r - 1, c, color, seen);
    this.floodMatch3(r + 1, c, color, seen);
    this.floodMatch3(r, c - 1, color, seen);
    this.floodMatch3(r, c + 1, color, seen);
    return seen;
  }

  private collapseMatch3(cols: number, rows: number) {
    for (let c = 0; c < cols; c += 1) {
      const stack: number[] = [];
      for (let r = rows - 1; r >= 0; r -= 1) {
        const v = this.grid[r]![c]!;
        if (v >= 0) stack.push(v);
      }
      for (let r = rows - 1; r >= 0; r -= 1) {
        this.grid[r]![c] = stack[rows - 1 - r] ?? Math.floor(Math.random() * COLORS.length);
      }
    }
  }

  private redrawMatch3(cols: number, rows: number) {
    this.gridGfx.clear();
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const v = this.grid[r]![c]!;
        if (v < 0) continue;
        this.gridGfx.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS[v]!).color, 1);
        this.gridGfx.fillRoundedRect(this.ox + c * this.cell + 2, this.oy + r * this.cell + 2, this.cell - 4, this.cell - 4, 6);
      }
    }
  }

  private buildSpotDifference(w: number, h: number) {
    const pw = Math.min(280, (w - 60) / 2);
    const ph = 220;
    const y = 100;
    const lx = w / 2 - pw - 12;
    const rx = w / 2 + 12;
    this.add.rectangle(lx + pw / 2, y + ph / 2, pw, ph, 0x6366f1);
    this.add.rectangle(rx + pw / 2, y + ph / 2, pw, ph, 0x6366f1);
    this.diffMarks = [false, false, false, false, false];
    const diffPoints = [
      { x: lx + pw * 0.3, y: y + ph * 0.25 },
      { x: lx + pw * 0.7, y: y + ph * 0.55 },
      { x: lx + pw * 0.45, y: y + ph * 0.78 },
      { x: rx + pw * 0.62, y: y + ph * 0.35 },
      { x: rx + pw * 0.28, y: y + ph * 0.62 },
    ];
    diffPoints.forEach((pt, i) => {
      this.add.circle(pt.x, pt.y, 10, 0xfde047).setVisible(false);
      this.add
        .circle(pt.x, pt.y, 22, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          if (this.diffMarks[i] || this.finished) return;
          this.diffMarks[i] = true;
          this.foundDiff += 1;
          this.score += 20;
          this.scoreText.setText(hudScore(this.uiLocale, this.score));
          this.addMove();
          playBleep("pickup");
          if (this.foundDiff >= 5) this.finish(true);
        });
    });
    this.add.text(w / 2, h - 48, "找出左右两幅插画的 5 处不同", { fontSize: "14px", color: "#e2e8f0" }).setOrigin(0.5);
  }

  private buildMemoryMatch(cols: number, rows: number, w: number) {
    const pairs = (cols * rows) / 2;
    const ids = Array.from({ length: pairs }, (_, i) => i);
    const deck = [...ids, ...ids].sort(() => Math.random() - 0.5);
    this.cell = Math.min(64, (w - 40) / cols);
    this.ox = (w - this.cell * cols) / 2;
    deck.forEach((id, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = this.ox + c * this.cell + this.cell / 2;
      const y = this.oy + r * this.cell + this.cell / 2;
      const rect = this.add
        .rectangle(x, y, this.cell - 8, this.cell - 8, 0x4c1d95)
        .setStrokeStyle(2, 0xc4b5fd)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y, "?", { fontSize: "20px", color: "#fff" }).setOrigin(0.5);
      const card = { id, face: false, matched: false, x, y, rect, label };
      this.cards.push(card);
      rect.on("pointerdown", () => this.flipCard(card));
    });
  }

  private flipCard(card: (typeof this.cards)[number]) {
    if (this.finished || card.face || card.matched || this.flipped.length >= 2) return;
    card.face = true;
    card.label.setText(String(card.id + 1));
      card.rect.setFillStyle(Phaser.Display.Color.HexStringToColor(COLORS[card.id % COLORS.length]!).color);
    this.flipped.push(card);
    if (this.flipped.length === 2) {
      this.addMove();
      const [a, b] = this.flipped;
      if (a!.id === b!.id) {
        a!.matched = b!.matched = true;
        this.score += 15;
        this.flipped = [];
        this.scoreText.setText(hudScore(this.uiLocale, this.score));
        if (this.cards.every((c) => c.matched)) this.finish(true);
      } else {
        this.time.delayedCall(600, () => {
          a!.face = b!.face = false;
          a!.label.setText("?");
          b!.label.setText("?");
          a!.rect.setFillStyle(0x4c1d95);
          b!.rect.setFillStyle(0x4c1d95);
          this.flipped = [];
        });
      }
    }
  }

  private buildJigsaw(w: number, h: number) {
    const size = 90;
    const sx = w / 2 - size * 1.5;
    const sy = h / 2 - size;
    for (let i = 0; i < 9; i += 1) {
      const tx = sx + (i % 3) * size;
      const ty = sy + Math.floor(i / 3) * size;
      const slot = this.add.rectangle(tx + size / 2, ty + size / 2, size - 4, size - 4, 0x334155).setStrokeStyle(2, 0x94a3b8);
      this.jigsawSlots.push(slot);
      const px = 40 + (i % 3) * (size + 8);
      const py = h - 130 + Math.floor(i / 3) * (size + 8);
      const piece = this.add
        .rectangle(px, py, size - 8, size - 8, Phaser.Display.Color.HexStringToColor(COLORS[i % COLORS.length]!).color)
        .setInteractive({ useHandCursor: true, draggable: true });
      piece.on("drag", (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => piece.setPosition(dragX, dragY));
      piece.on("dragend", () => {
        const slotIdx = this.jigsawSlots.findIndex(
          (s) => Phaser.Math.Distance.Between(piece.x, piece.y, s.x, s.y) < size * 0.45,
        );
        if (slotIdx >= 0 && !this.jigsawSlots[slotIdx]!.getData("filled")) {
          piece.setPosition(this.jigsawSlots[slotIdx]!.x, this.jigsawSlots[slotIdx]!.y);
          this.jigsawSlots[slotIdx]!.setData("filled", true);
          this.jigsawDone += 1;
          this.score += 10;
          this.scoreText.setText(hudScore(this.uiLocale, this.score));
          this.addMove(0);
          if (this.jigsawDone >= 9) this.finish(true);
        }
      });
    }
  }
}
