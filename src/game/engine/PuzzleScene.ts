import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { juiceBurst, juiceFlash, juiceFloater, juiceShake, themeParticleHex } from "@/game/engine/gameJuice";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import type { GameSpec } from "@/lib/game-spec";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildPuzzleBlueprint, type PuzzleMode } from "@/lib/puzzle-blueprint";
import { runtimeSeedFromSpec, seededRandom, seededShuffle } from "@/lib/runtime-seed";
import { schedulePhaserPlayReady, setPhaserQaClickHints } from "@/game/engine/phaser-play-ready";
import { initQaState, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import {
  drawMatch3Gem,
  kidsJigsawEmoji,
  memoryCardEmoji,
  paintColorBloomBackdrop,
  paintWhimsyPanelScene,
} from "@/game/engine/puzzle-visual";
import {
  paintPuzzleBoardFrame,
  paintPuzzleThemeBackdrop,
  paintSpotDiffPanels,
} from "@/game/engine/template-theme-visual";
import {
  bannerPuzzleFinish,
  hudPuzzleMatch3Hint,
  hudPuzzleMoves,
  hudPuzzleSpotDiffHint,
  hudReady,
  hudScore,
} from "@/lib/i18n/game-hud-labels";

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
  private cards: Array<{ id: number; face: boolean; matched: boolean; x: number; y: number; rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; faceText: string }> = [];
  private flipped: typeof this.cards = [];
  private jigsawSlots: Phaser.GameObjects.Rectangle[] = [];
  private jigsawDone = 0;
  private jigsawCols = 3;
  private jigsawRows = 3;
  private memoryTimerSec = 0;
  private memoryTimerLeft = 0;
  private memoryTimerWarned = false;
  private timerText!: Phaser.GameObjects.Text;
  private kidsJigsaw = false;
  private starReward = false;
  private jigsawLargeBlocks = false;
  private richMatch3 = false;
  private memoryEmoji = false;
  private runtimeRng!: () => number;

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
    this.runtimeRng = seededRandom(runtimeSeedFromSpec(this.spec));
    const bp = this.spec.puzzle ?? buildPuzzleBlueprint({ spec: this.spec });
    this.mode = bp.mode;
    this.target = bp.targetScore;
    this.moveLimit = bp.moveLimit;
    this.jigsawCols = bp.cols;
    this.jigsawRows = bp.rows;

    const puzzlePf = this.spec.samplePlayProfile?.puzzle;
    if (puzzlePf?.diffCount && this.mode === "spotDifference") {
      this.target = puzzlePf.diffCount;
    }
    if (puzzlePf?.memoryTimerSec && this.mode === "memoryMatch") {
      this.memoryTimerSec = puzzlePf.memoryTimerSec;
      this.memoryTimerLeft = puzzlePf.memoryTimerSec;
    }
    if (puzzlePf?.kidsJigsaw && this.mode === "jigsaw") {
      this.kidsJigsaw = true;
      this.starReward = puzzlePf.starReward ?? true;
      this.jigsawLargeBlocks = puzzlePf.jigsawLargeBlocks ?? true;
    }
    const variantId = this.spec.samplePlayProfile?.variantId;
    this.richMatch3 = variantId === "color-bloom" || (puzzlePf?.match3BloomScale ?? 1) > 1.2;
    this.memoryEmoji = variantId === "memory-match-mania";

    const w = this.scale.width;
    const h = this.scale.height;
    if (variantId === "color-bloom" && this.mode === "match3") {
      paintColorBloomBackdrop(this, this.spec, w, h);
    } else {
      paintPuzzleThemeBackdrop(this, this.spec, w, h, this.mode);
    }

    this.scoreText = styleHudText(
      this.add.text(16, 12, hudScore(this.uiLocale, 0), { fontSize: "18px", color: "#fff" }),
    );
    this.moveText = styleHudText(
      this.add.text(16, 38, hudPuzzleMoves(this.uiLocale, this.moves, this.moveLimit), { fontSize: "15px", color: "#cbd5e1" }),
    );
    if (this.memoryTimerSec > 0) {
      this.timerText = styleHudText(
        this.add.text(w - 16, 12, `${this.memoryTimerLeft}s`, { fontSize: "16px", color: "#fbbf24" }).setOrigin(1, 0),
      );
    }
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
    schedulePhaserPlayReady(this, 400, {
      puzzleScore: 0,
      puzzleMoves: 0,
      foundDiff: 0,
      flippedCards: 0,
      jigsawDone: 0,
    });
    this.publishQaState();
    this.publishQaClickHints(bp.cols, bp.rows, w, h);
  }

  private publishQaClickHints(cols: number, rows: number, w: number, h: number) {
    switch (this.mode) {
      case "match3": {
        const cr = Math.floor(rows / 2);
        const cc = Math.floor(cols / 2);
        const hint = {
          x: (this.ox + (cc + 0.5) * this.cell) / w,
          y: (this.oy + (cr + 0.5) * this.cell) / h,
        };
        setPhaserQaClickHints([hint, hint]);
        break;
      }
      case "spotDifference": {
        break;
      }
      case "memoryMatch": {
        const c = 0;
        const r = 0;
        setPhaserQaClickHints([
          { x: (this.ox + (c + 0.5) * this.cell) / w, y: (this.oy + (r + 0.5) * this.cell) / h },
          { x: (this.ox + (c + 1.5) * this.cell) / w, y: (this.oy + (r + 0.5) * this.cell) / h },
        ]);
        break;
      }
      case "jigsaw": {
        const colsJ = this.jigsawCols;
        const rowsJ = this.jigsawRows;
        const blockScale = this.jigsawLargeBlocks ? 1.18 : 1;
        const size = Math.min(88 * blockScale, Math.min((w - 100) / (colsJ + 1), (h - 220) / (rowsJ + 2)));
        const px = 36 + size / 2;
        const py = h - 150 + size / 2;
        setPhaserQaClickHints([{ x: px / w, y: py / h }, { x: px / w, y: py / h }]);
        break;
      }
      default:
        break;
    }
  }

  update(_time: number, deltaMs: number) {
    this.banner.tick();
    if (this.finished) return;
    if (this.memoryTimerSec <= 0) return;
    this.memoryTimerLeft -= deltaMs / 1000;
    if (this.timerText) {
      const left = Math.max(0, Math.ceil(this.memoryTimerLeft));
      this.timerText.setText(`${left}s`);
      if (left <= 10) {
        this.timerText.setColor("#fb7185");
        if (!this.memoryTimerWarned) {
          this.memoryTimerWarned = true;
          juiceFlash(this, { r: 251, g: 113, b: 133 }, { durationMs: 120 });
          juiceShake(this, { durationMs: 140, intensity: 0.004 });
        }
      }
    }
    if (this.memoryTimerLeft <= 0) {
      this.finish(false);
    }
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.banner.show({ ...bannerPuzzleFinish(this.uiLocale, won), ms: 2000 });
    if (won) {
      juiceShake(this, { durationMs: 220, intensity: 0.012 });
      juiceFlash(this, { r: 140, g: 200, b: 255 }, { durationMs: 140 });
    } else {
      juiceShake(this, { durationMs: 180, intensity: 0.008 });
    }
    this.time.delayedCall(2200, () => this.onEnd({ score: this.score, won }));
  }

  private addMove(cost = 1) {
    this.moves += cost;
    this.moveText.setText(hudPuzzleMoves(this.uiLocale, this.moves, this.moveLimit));
    this.publishQaState();
    if (this.moves >= this.moveLimit && this.score < this.target) this.finish(false);
  }

  private publishQaState() {
    const flippedCards = this.cards.filter((c) => c.face && !c.matched).length;
    setPhaserQaState({
      puzzleScore: this.score,
      puzzleMoves: this.moves,
      foundDiff: this.foundDiff,
      flippedCards,
      jigsawDone: this.jigsawDone,
    });
  }

  private buildMatch3(cols: number, rows: number, w: number) {
    const bloomScale = this.spec.samplePlayProfile?.puzzle?.match3BloomScale ?? 1;
    this.cell = Math.min(48, (w - 40) / cols);
    this.ox = (w - this.cell * cols) / 2;
    paintPuzzleBoardFrame(this, this.spec, this.ox - 4, this.oy - 4, this.cell * cols + 8, this.cell * rows + 8);
    this.grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.floor(this.runtimeRng() * COLORS.length)),
    );
    if (this.spec.samplePlayProfile?.variantId === "color-bloom") {
      const cr = Math.floor(rows / 2);
      const cc = Math.floor(cols / 2);
      const color = this.grid[cr]![cc]!;
      if (cc + 1 < cols) this.grid[cr]![cc + 1] = color;
      if (cr + 1 < rows) this.grid[cr + 1]![cc] = color;
    }
    this.redrawMatch3(cols, rows);
    const h = this.scale.height;
    this.add.text(w / 2, h - 48, hudPuzzleMatch3Hint(this.uiLocale), { fontSize: "14px", color: "#e2e8f0" }).setOrigin(0.5);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.finished) return;
      const c = Math.floor((p.x - this.ox) / this.cell);
      const r = Math.floor((p.y - this.oy) / this.cell);
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      const color = this.grid[r]![c]!;
      const group = this.floodMatch3(r, c, color, new Set());
      if (group.size < 2) {
        juiceFlash(this, { r: 255, g: 255, b: 255 }, { durationMs: 80 });
        juiceFloater(this, p.x, p.y - 10, this.uiLocale === "zh-Hans" ? "再试" : "Try again", "#e2e8f0");
        return;
      }
      for (const key of group) {
        const [rr, cc] = key.split(",").map(Number);
        this.grid[rr]![cc] = -1;
      }
      this.collapseMatch3(cols, rows);
      const gain = group.size * group.size * 3;
      this.score += gain;
      this.scoreText.setText(hudScore(this.uiLocale, this.score));
      this.publishQaState();
      const burstN = Math.min(22, Math.round(group.size * bloomScale));
      juiceBurst(this, p.x, p.y, COLORS[color] ?? "#fff", burstN);
      if (this.richMatch3 && group.size >= 4) {
        juiceFlash(this, { r: 244, g: 114, b: 182 }, { durationMs: 100 });
        juiceShake(this, { durationMs: 120, intensity: 0.005 });
        juiceFloater(this, p.x, p.y - 28, this.uiLocale === "zh-Hans" ? "Bloom!" : "Bloom!", "#f472b6");
      }
      juiceFloater(this, p.x, p.y - 12, `+${gain}`, this.cohesive.hud.accent);
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
        this.grid[r]![c] = stack[rows - 1 - r] ?? Math.floor(this.runtimeRng() * COLORS.length);
      }
    }
  }

  private redrawMatch3(cols: number, rows: number) {
    this.gridGfx.clear();
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const v = this.grid[r]![c]!;
        if (v < 0) continue;
        const x = this.ox + c * this.cell;
        const y = this.oy + r * this.cell;
        if (this.richMatch3) {
          drawMatch3Gem(this.gridGfx, COLORS[v]!, x, y, this.cell, true);
        } else {
          this.gridGfx.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS[v]!).color, 1);
          this.gridGfx.fillRoundedRect(x + 2, y + 2, this.cell - 4, this.cell - 4, 6);
        }
      }
    }
  }

  private buildSpotDifference(w: number, h: number) {
    const pw = Math.min(280, (w - 60) / 2);
    const ph = 220;
    const y = 100;
    const lx = w / 2 - pw - 12;
    const rx = w / 2 + 12;
    const whimsical = this.spec.samplePlayProfile?.puzzle?.whimsicalPanels ?? false;
    const panelA = whimsical ? 0xa78bfa : 0x6366f1;
    const panelB = whimsical ? 0xf472b6 : 0x6366f1;
    paintSpotDiffPanels(this, this.spec, lx, rx, y, pw, ph);
    const panelGfxL = this.add.graphics().setDepth(2);
    const panelGfxR = this.add.graphics().setDepth(2);
    if (whimsical) {
      paintWhimsyPanelScene(panelGfxL, lx, y, pw, ph, runtimeSeedFromSpec(this.spec), "left");
      paintWhimsyPanelScene(panelGfxR, rx, y, pw, ph, runtimeSeedFromSpec(this.spec) + 3, "right");
    } else {
      this.add.rectangle(lx + pw / 2, y + ph / 2, pw, ph, panelA, 0.35);
      this.add.rectangle(rx + pw / 2, y + ph / 2, pw, ph, panelB, 0.35);
    }
    if (whimsical) {
      for (const pt of [
        { x: lx + 12, y: y + 12 },
        { x: lx + pw - 12, y: y + ph - 12 },
        { x: rx + pw - 12, y: y + 12 },
        { x: rx + 12, y: y + ph - 12 },
      ]) {
        juiceBurst(this, pt.x, pt.y, "#fcd34d", 4);
      }
    }
    const diffCount = this.target;
    this.diffMarks = Array.from({ length: diffCount }, () => false);
    const markCircles: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < diffCount; i += 1) {
      const onLeft = i % 2 === 0;
      const baseX = onLeft ? lx : rx;
      const pt = {
        x: baseX + pw * (0.18 + ((i * 13) % 62) / 100),
        y: y + ph * (0.16 + ((i * 11) % 68) / 100),
      };
      if (i === 0) {
        setPhaserQaClickHints([{ x: pt.x / w, y: pt.y / h }]);
      }
      const mark = this.add.circle(pt.x, pt.y, 10, whimsical ? 0xf472b6 : 0xfde047).setVisible(false);
      markCircles.push(mark);
      this.add
        .circle(pt.x, pt.y, 22, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          if (this.diffMarks[i] || this.finished) return;
          this.diffMarks[i] = true;
          mark.setVisible(true);
          mark.setScale(1.8);
          this.foundDiff += 1;
          this.score += 20;
          this.scoreText.setText(hudScore(this.uiLocale, this.score));
          juiceBurst(this, pt.x, pt.y, whimsical ? "#f472b6" : themeParticleHex(this.spec), 14);
          juiceFloater(this, pt.x, pt.y - 16, "+20", this.cohesive.hud.accent);
          juiceShake(this, { durationMs: 90, intensity: 0.004 });
          this.addMove();
          playBleep("pickup");
          this.publishQaState();
          if (this.foundDiff >= diffCount) this.finish(true);
        });
    }
    this.add.text(w / 2, h - 48, hudPuzzleSpotDiffHint(this.uiLocale), { fontSize: "14px", color: "#e2e8f0" }).setOrigin(0.5);
  }

  private buildMemoryMatch(cols: number, rows: number, w: number) {
    const pairs = (cols * rows) / 2;
    const ids = Array.from({ length: pairs }, (_, i) => i);
    const deck = seededShuffle([...ids, ...ids], runtimeSeedFromSpec(this.spec));
    this.cell = Math.min(64, (w - 40) / cols);
    this.ox = (w - this.cell * cols) / 2;
    paintPuzzleBoardFrame(this, this.spec, this.ox - 4, this.oy - 4, this.cell * cols + 8, this.cell * rows + 8);
    const timed = this.memoryTimerSec > 0;
    const h = this.scale.height;
    deck.forEach((id, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = this.ox + c * this.cell + this.cell / 2;
      const y = this.oy + r * this.cell + this.cell / 2;
      if (i === 0) {
        setPhaserQaClickHints([{ x: x / w, y: y / h }]);
      }
      const rect = this.add
        .rectangle(x, y, this.cell - 8, this.cell - 8, timed ? 0x581c87 : 0x4c1d95)
        .setStrokeStyle(2, timed ? 0xf472b6 : 0xc4b5fd)
        .setInteractive({ useHandCursor: true });
      const faceText = this.memoryEmoji ? memoryCardEmoji(id) : String(id + 1);
      const label = this.add
        .text(x, y, "?", { fontSize: this.memoryEmoji ? "26px" : "20px", color: "#fff" })
        .setOrigin(0.5);
      const card = { id, face: false, matched: false, x, y, rect, label, faceText };
      this.cards.push(card);
      rect.on("pointerdown", () => this.flipCard(card));
    });
  }

  private flipCard(card: (typeof this.cards)[number]) {
    if (this.finished || card.face || card.matched || this.flipped.length >= 2) return;
    card.face = true;
    card.label.setText(card.faceText);
      card.rect.setFillStyle(Phaser.Display.Color.HexStringToColor(COLORS[card.id % COLORS.length]!).color);
    this.flipped.push(card);
    this.publishQaState();
    if (this.flipped.length === 2) {
      this.addMove();
      const [a, b] = this.flipped;
      if (a!.id === b!.id) {
        a!.matched = b!.matched = true;
        this.score += 15;
        this.flipped = [];
        this.scoreText.setText(hudScore(this.uiLocale, this.score));
        juiceBurst(this, a!.x, a!.y, COLORS[a!.id % COLORS.length] ?? "#fff", 12);
        juiceFloater(this, a!.x, a!.y - 14, "+15", this.cohesive.hud.accent);
        playBleep("pickup");
        if (this.cards.every((c) => c.matched)) this.finish(true);
      } else {
        juiceShake(this, { durationMs: 100, intensity: 0.003 });
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
    const cols = this.jigsawCols;
    const rows = this.jigsawRows;
    const total = cols * rows;
    const blockScale = this.jigsawLargeBlocks ? 1.18 : 1;
    const size = Math.min(88 * blockScale, Math.min((w - 100) / (cols + 1), (h - 220) / (rows + 2)));
    const sx = w / 2 - (cols * size) / 2;
    const sy = h / 2 - (rows * size) / 2 - 20;
    if (this.kidsJigsaw) {
      const frame = this.add.graphics().setDepth(1);
      frame.lineStyle(4, 0xfcd34d, 0.85);
      frame.strokeRoundedRect(sx - 16, sy - 16, cols * size + 32, rows * size + 32, 12);
      frame.lineStyle(2, 0x38bdf8, 0.6);
      frame.strokeRoundedRect(sx - 8, sy - 8, cols * size + 16, rows * size + 16, 8);
    } else {
      paintPuzzleBoardFrame(this, this.spec, sx - 10, sy - 10, cols * size + 20, rows * size + 20);
    }
    for (let i = 0; i < total; i += 1) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const tx = sx + c * size;
      const ty = sy + r * size;
      const slot = this.add
        .rectangle(tx + size / 2, ty + size / 2, size - 4, size - 4, 0x334155)
        .setStrokeStyle(2, 0x94a3b8);
      this.jigsawSlots.push(slot);
      const px = 36 + (i % cols) * (size + 6);
      const py = h - 150 + Math.floor(i / cols) * (size + 6);
      const piece = this.add
        .rectangle(px, py, size - 8, size - 8, Phaser.Display.Color.HexStringToColor(COLORS[i % COLORS.length]!).color)
        .setInteractive({ useHandCursor: true, draggable: true });
      if (this.kidsJigsaw) {
        this.add
          .text(px, py, kidsJigsawEmoji(i), { fontSize: `${Math.floor(size * 0.38)}px` })
          .setOrigin(0.5)
          .setDepth(3);
      }
      piece.on("pointerdown", () => {
        this.addMove(1);
        if (this.kidsJigsaw) {
          const emptyIdx = this.jigsawSlots.findIndex((s) => !s.getData("filled"));
          if (emptyIdx >= 0) {
            piece.setPosition(this.jigsawSlots[emptyIdx]!.x, this.jigsawSlots[emptyIdx]!.y);
            this.jigsawSlots[emptyIdx]!.setData("filled", true);
            piece.setScale(1.08);
            this.jigsawDone += 1;
            this.score += 10;
            this.scoreText.setText(hudScore(this.uiLocale, this.score));
            this.publishQaState();
            juiceBurst(this, piece.x, piece.y, COLORS[emptyIdx % COLORS.length] ?? "#fff", 18);
            juiceFlash(this, { r: 252, g: 211, b: 77 }, { durationMs: 120 });
            juiceFloater(this, piece.x, piece.y - 12, "+10", this.cohesive.hud.accent);
            playBleep("pickup");
            this.addMove(1);
            if (this.jigsawDone >= total) this.finish(true);
            return;
          }
        }
      });
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
          this.publishQaState();
          juiceBurst(this, piece.x, piece.y, COLORS[slotIdx % COLORS.length] ?? "#fff", 10);
          if (this.starReward) {
            juiceFloater(this, piece.x, piece.y - 18, "⭐", "#fcd34d");
          }
          juiceFloater(this, piece.x, piece.y - 12, "+10", this.cohesive.hud.accent);
          playBleep("pickup");
          this.addMove(1);
          if (this.jigsawDone >= total) this.finish(true);
        }
      });
    }
    if (this.kidsJigsaw) {
      this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (p.y >= h - 200) {
          this.addMove(1);
          this.publishQaState();
        }
      });
    }
  }
}
