import Phaser from "phaser";
import type { AppLocale } from "@/i18n/routing";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import { playBleep } from "@/game/audio/webBleeps";
import { schedulePhaserPlayReady, setPhaserQaClickHints } from "@/game/engine/phaser-play-ready";
import { bumpQaTouch, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSpec } from "@/lib/game-spec";

type EndPayload = { score: number; won: boolean };
type GridPos = { x: number; y: number };

const COLS = 24;
const ROWS = 17;
const TARGET_COVERAGE = 20;

/** 独立圈地玩法：离开安全区留下脆弱轨迹，闭环后真正填充领地。 */
export class TerritoryLoopScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (result: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;
  private owned = new Set<string>();
  private trail = new Set<string>();
  private player: GridPos = { x: 13, y: 8 };
  private trailOrigin: GridPos | null = null;
  private enemies: GridPos[] = [{ x: 3, y: 3 }, { x: 20, y: 13 }];
  private board!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private score = 0;
  private lives = 3;
  private closures = 0;
  private finished = false;
  private seconds = 90;
  private swipeStart: GridPos | null = null;
  private graceSteps = 100;

  constructor(spec: GameSpec, onEnd: (result: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "TerritoryLoopScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  create() {
    for (let y = 7; y <= 10; y += 1) for (let x = 10; x <= 13; x += 1) this.owned.add(`${x},${y}`);
    this.board = this.add.graphics();
    this.hud = styleHudText(this.add.text(16, 14, "", { fontSize: "15px", color: "#ffffff" })).setDepth(20);
    styleHudText(this.add.text(16, 42, "离开青色领地绘制轨迹，返回安全区即可闭环占领；敌人碰到轨迹会损失生命。", { fontSize: "11px", color: "#a5f3fc", wordWrap: { width: this.scale.width - 32 } })).setDepth(20);
    styleHudText(this.add.text(this.scale.width - 16, 14, "NEON TERRITORY", { fontSize: "17px", fontStyle: "bold", color: "#67e8f9" }).setOrigin(1, 0)).setDepth(20);
    this.createDpad();
    this.bindInputs();
    this.time.addEvent({ delay: 520, loop: true, callback: () => this.moveEnemies() });
    this.time.addEvent({ delay: 1000, loop: true, callback: () => {
      if (this.finished) return;
      this.seconds -= 1;
      if (this.seconds <= 0) this.finish(false);
      this.renderBoard();
    } });
    this.renderBoard();
    setPhaserQaClickHints([{ x: 0.14, y: 0.93 }]);
    schedulePhaserPlayReady(this, 360, { showcaseRuntime: "territory-loop" });
  }

  private bindInputs() {
    const keyboard = this.input.keyboard!;
    keyboard.on("keydown-UP", () => this.step(0, -1));
    keyboard.on("keydown-W", () => this.step(0, -1));
    keyboard.on("keydown-DOWN", () => this.step(0, 1));
    keyboard.on("keydown-S", () => this.step(0, 1));
    keyboard.on("keydown-LEFT", () => this.step(-1, 0));
    keyboard.on("keydown-A", () => this.step(-1, 0));
    keyboard.on("keydown-RIGHT", () => this.step(1, 0));
    keyboard.on("keydown-D", () => this.step(1, 0));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => { this.swipeStart = { x: p.x, y: p.y }; });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.swipeStart) return;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      this.swipeStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) this.step(dx > 0 ? 1 : -1, 0);
      else this.step(0, dy > 0 ? 1 : -1);
    });
  }

  private createDpad() {
    const h = this.scale.height;
    const add = (x: number, y: number, label: string, dx: number, dy: number) => {
      const button = this.add.rectangle(x, y, 50, 42, 0x172554, 0.9).setStrokeStyle(1, 0x67e8f9, 0.8).setDepth(24).setInteractive({ useHandCursor: true });
      styleHudText(this.add.text(x, y, label, { fontSize: "18px", color: "#ffffff" }).setOrigin(0.5)).setDepth(25);
      button.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); this.step(dx, dy); });
    };
    add(78, h - 78, "↑", 0, -1);
    add(28, h - 34, "←", -1, 0);
    add(78, h - 34, "↓", 0, 1);
    add(128, h - 34, "→", 1, 0);
  }

  private step(dx: number, dy: number) {
    if (this.finished) return;
    const next = { x: Phaser.Math.Clamp(this.player.x + dx, 0, COLS - 1), y: Phaser.Math.Clamp(this.player.y + dy, 0, ROWS - 1) };
    if (next.x === this.player.x && next.y === this.player.y) return;
    bumpQaTouch();
    this.graceSteps = Math.max(0, this.graceSteps - 1);
    const nextKey = `${next.x},${next.y}`;
    const wasOwned = this.owned.has(`${this.player.x},${this.player.y}`);
    const isOwned = this.owned.has(nextKey);
    if (!isOwned && this.trail.has(nextKey)) return this.crashTrail();
    if (wasOwned && !isOwned && !this.trailOrigin) this.trailOrigin = { ...this.player };
    this.player = next;
    if (!isOwned) {
      this.trail.add(nextKey);
      playBleep("pickup");
    } else if (this.trail.size && this.trailOrigin) {
      this.closeLoop();
    }
    if (this.graceSteps === 0 && this.enemies.some((enemy) => enemy.x === this.player.x && enemy.y === this.player.y)) this.crashTrail();
    this.renderBoard();
  }

  private closeLoop() {
    const points = [...this.trail].map((key) => key.split(",").map(Number) as [number, number]);
    points.push([this.trailOrigin!.x, this.trailOrigin!.y], [this.player.x, this.player.y]);
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    let gained = 0;
    for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
      const key = `${x},${y}`;
      if (!this.owned.has(key)) { this.owned.add(key); gained += 1; }
    }
    this.trail.clear();
    this.trailOrigin = null;
    this.closures += 1;
    this.score += gained * 90 + 250;
    playBleep("power");
    this.flash(`闭环成功 +${gained} 格`, 0x22d3ee);
    if (this.coverage() >= TARGET_COVERAGE) this.finish(true);
  }

  private moveEnemies() {
    if (this.finished) return;
    this.enemies = this.enemies.map((enemy, index) => {
      const choices = index % 2 === 0
        ? [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]
        : [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }];
      const choice = choices[(this.seconds + index) % choices.length];
      return { x: Phaser.Math.Clamp(enemy.x + choice.x, 0, COLS - 1), y: Phaser.Math.Clamp(enemy.y + choice.y, 0, ROWS - 1) };
    });
    if (this.graceSteps === 0 && this.enemies.some((enemy) => this.trail.has(`${enemy.x},${enemy.y}`))) this.crashTrail();
    this.renderBoard();
  }

  private crashTrail() {
    if (!this.trail.size && this.owned.has(`${this.player.x},${this.player.y}`)) return;
    this.lives -= 1;
    this.score = Math.max(0, this.score - 200);
    this.trail.clear();
    this.trailOrigin = null;
    this.player = { x: 13, y: 8 };
    playBleep("death");
    this.flash(`轨迹被切断，剩余 ${this.lives} 条命`, 0xfb7185);
    if (this.lives <= 0) this.finish(false);
  }

  private coverage() {
    return Math.round((this.owned.size / (COLS * ROWS)) * 1000) / 10;
  }

  private renderBoard() {
    const g = this.board;
    const w = this.scale.width;
    const h = this.scale.height;
    const top = 76;
    const bottom = h - 124;
    const cell = Math.min((w - 24) / COLS, (bottom - top) / ROWS);
    const ox = (w - cell * COLS) / 2;
    const oy = top + (bottom - top - cell * ROWS) / 2;
    g.clear().fillStyle(0x020617, 1).fillRect(0, 0, w, h);
    g.fillStyle(0x071426, 1).fillRoundedRect(ox - 6, oy - 6, cell * COLS + 12, cell * ROWS + 12, 10);
    for (let y = 0; y < ROWS; y += 1) for (let x = 0; x < COLS; x += 1) {
      const key = `${x},${y}`;
      const owned = this.owned.has(key);
      const trail = this.trail.has(key);
      g.fillStyle(trail ? 0xfacc15 : owned ? 0x0891b2 : ((x + y) % 2 ? 0x0f1b31 : 0x101f38), trail ? 1 : owned ? 0.92 : 1);
      g.fillRect(ox + x * cell + 0.6, oy + y * cell + 0.6, cell - 1.2, cell - 1.2);
    }
    for (const enemy of this.enemies) {
      g.fillStyle(0xfb7185, 1).fillCircle(ox + (enemy.x + 0.5) * cell, oy + (enemy.y + 0.5) * cell, cell * 0.38);
      g.lineStyle(2, 0xffffff, 0.75).strokeCircle(ox + (enemy.x + 0.5) * cell, oy + (enemy.y + 0.5) * cell, cell * 0.38);
    }
    g.fillStyle(0xffffff, 1).fillCircle(ox + (this.player.x + 0.5) * cell, oy + (this.player.y + 0.5) * cell, cell * 0.43);
    g.fillStyle(0x22d3ee, 1).fillCircle(ox + (this.player.x + 0.5) * cell, oy + (this.player.y + 0.5) * cell, cell * 0.24);
    this.hud.setText(`领地 ${this.coverage().toFixed(1)}% / ${TARGET_COVERAGE}%   ·   闭环 ${this.closures}   ·   ♥ ${this.lives}   ·   ${this.seconds}s   ·   ${this.score} 分`);
    setPhaserQaState({
      showcaseRuntime: "territory-loop", territoryCoverage: this.coverage(), territoryClosures: this.closures,
      territoryLives: this.lives, territoryTrail: this.trail.size, territoryX: this.player.x, territoryY: this.player.y,
      territoryCompleted: this.finished && this.coverage() >= TARGET_COVERAGE,
    });
  }

  private flash(message: string, color: number) {
    const text = styleHudText(this.add.text(this.scale.width / 2, this.scale.height * 0.7, message, { fontSize: "18px", fontStyle: "bold", color: `#${color.toString(16).padStart(6, "0")}`, backgroundColor: "rgba(2,6,23,.88)", padding: { x: 14, y: 8 } }).setOrigin(0.5)).setDepth(50);
    this.tweens.add({ targets: text, y: text.y - 25, alpha: 0, duration: 850, onComplete: () => text.destroy() });
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.soundscape?.setSection(won ? "victory" : "defeat");
    playBleep(won ? "win" : "death");
    setPhaserQaState({ territoryCompleted: won, territoryCoverage: this.coverage(), territoryClosures: this.closures });
    const w = this.scale.width; const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, 0x020617, 0.82).setDepth(80);
    styleHudText(this.add.text(w / 2, h / 2 - 34, won ? "领地达成" : "轨迹失守", { fontSize: "36px", fontStyle: "bold", color: won ? "#67e8f9" : "#fb7185" }).setOrigin(0.5)).setDepth(81);
    styleHudText(this.add.text(w / 2, h / 2 + 18, `${this.coverage().toFixed(1)}% · ${this.closures} 次闭环 · ${this.score} 分`, { fontSize: "16px", color: "#ffffff" }).setOrigin(0.5)).setDepth(81);
    this.time.delayedCall(900, () => this.onEnd({ score: this.score, won }));
  }
}
