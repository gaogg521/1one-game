import Phaser from "phaser";
import type { AppLocale } from "@/i18n/routing";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import { playBleep } from "@/game/audio/webBleeps";
import { schedulePhaserPlayReady, setPhaserQaClickHints } from "@/game/engine/phaser-play-ready";
import { bumpQaTouch, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSpec } from "@/lib/game-spec";

type EndPayload = { score: number; won: boolean };
type BuildingLevel = 1 | 2 | 3 | 4 | 5;

const LEVELS: Record<BuildingLevel, { name: string; icon: string; color: number; roof: number }> = {
  1: { name: "木料堆", icon: "▦", color: 0x9a6a3a, roof: 0xfbbf24 },
  2: { name: "工匠棚", icon: "⌂", color: 0xb45309, roof: 0xf97316 },
  3: { name: "石屋", icon: "▣", color: 0x64748b, roof: 0x334155 },
  4: { name: "庄园宅邸", icon: "♜", color: 0x7c3aed, roof: 0xc4b5fd },
  5: { name: "中央大庄园", icon: "♛", color: 0xf59e0b, roof: 0xfef3c7 },
};

/** 独立庄园合成玩法：真实 5×5 棋盘、拖放移动、同阶合并、资源与最高阶胜利。 */
export class EstateMergeScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (result: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;
  private board: Array<BuildingLevel | 0> = Array(25).fill(0);
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private buildingTexts: Phaser.GameObjects.Text[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private orderText!: Phaser.GameObjects.Text;
  private dragIndex: number | null = null;
  private selectedIndex: number | null = null;
  private coins = 160;
  private energy = 12;
  private merges = 0;
  private score = 0;
  private finished = false;
  private grid = { x: 0, y: 0, cell: 0 };

  constructor(spec: GameSpec, onEnd: (result: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "EstateMergeScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  create() {
    for (let i = 0; i < 16; i += 1) this.board[i] = 1;
    this.boardGraphics = this.add.graphics();
    styleHudText(this.add.text(18, 14, "GRAND ESTATE", { fontSize: "20px", fontStyle: "bold", color: "#fff7ed" })).setDepth(30);
    styleHudText(this.add.text(18, 42, "拖动两个同阶建筑完成合并，从木料堆一路建设中央大庄园。", { fontSize: "11px", color: "#fde68a", wordWrap: { width: this.scale.width - 36 } })).setDepth(30);
    this.statusText = styleHudText(this.add.text(18, 66, "", { fontSize: "15px", color: "#ffffff" })).setDepth(30);
    this.orderText = styleHudText(this.add.text(this.scale.width - 18, 66, "", { fontSize: "13px", color: "#fef3c7", align: "right" }).setOrigin(1, 0)).setDepth(30);
    this.createShopButton();
    this.layoutGrid();
    this.bindBoardInput();
    this.renderBoard();
    setPhaserQaClickHints([{ x: 0.23, y: 0.28 }, { x: 0.37, y: 0.28 }, { x: 0.5, y: 0.9 }]);
    schedulePhaserPlayReady(this, 360, { showcaseRuntime: "estate-merge" });
  }

  private layoutGrid() {
    const w = this.scale.width;
    const h = this.scale.height;
    const cell = Math.min((w - 36) / 5, (h - 190) / 5, 105);
    this.grid = { x: (w - cell * 5) / 2, y: 102 + Math.max(0, (h - 190 - cell * 5) / 2), cell };
  }

  private bindBoardInput() {
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const index = this.indexAt(p.x, p.y);
      if (index === null) return;
      this.dragIndex = index;
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.dragIndex === null) return;
      const target = this.indexAt(p.x, p.y);
      const source = this.dragIndex;
      this.dragIndex = null;
      if (target !== null && target !== source) this.moveOrMerge(source, target);
      else if (target === source && this.selectedIndex === null) this.selectedIndex = source;
      else if (target === source && this.selectedIndex === source) this.selectedIndex = null;
      else if (target === source && this.selectedIndex !== null) this.moveOrMerge(this.selectedIndex, source);
      this.renderBoard();
    });
    this.input.keyboard?.on("keydown-SPACE", () => this.spawnBuilding());
  }

  private createShopButton() {
    const w = this.scale.width;
    const h = this.scale.height;
    const button = this.add.rectangle(w / 2, h - 43, Math.min(300, w - 40), 54, 0xd97706, 0.96).setStrokeStyle(2, 0xfef3c7, 0.8).setDepth(35).setInteractive({ useHandCursor: true });
    styleHudText(this.add.text(w / 2, h - 43, "补充木料  ·  20 金币 / 1 能量  ·  SPACE", { fontSize: "14px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5)).setDepth(36);
    button.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); this.spawnBuilding(); });
  }

  private indexAt(x: number, y: number): number | null {
    const { x: ox, y: oy, cell } = this.grid;
    const col = Math.floor((x - ox) / cell);
    const row = Math.floor((y - oy) / cell);
    return col >= 0 && row >= 0 && col < 5 && row < 5 ? row * 5 + col : null;
  }

  private moveOrMerge(source: number, target: number) {
    if (this.finished || !this.board[source]) return;
    const sourceLevel = this.board[source] as BuildingLevel;
    const targetLevel = this.board[target];
    bumpQaTouch();
    if (targetLevel === 0) {
      this.board[target] = sourceLevel;
      this.board[source] = 0;
      playBleep("pickup");
      this.selectedIndex = null;
      return;
    }
    if (targetLevel !== sourceLevel || sourceLevel >= 5) {
      playBleep("hit");
      this.flash("只有两个同阶建筑才能合并", 0xfb7185);
      this.selectedIndex = null;
      return;
    }
    const upgraded = (sourceLevel + 1) as BuildingLevel;
    this.board[source] = 0;
    this.board[target] = upgraded;
    this.merges += 1;
    const reward = 40 * upgraded;
    this.coins += reward;
    this.energy = Math.min(20, this.energy + 1);
    this.score += reward * 3;
    this.selectedIndex = null;
    playBleep(upgraded >= 4 ? "power" : "pickup");
    this.flash(`${LEVELS[upgraded].name} 完成  +${reward} 金币`, LEVELS[upgraded].roof);
    if (upgraded === 5) this.finish();
  }

  private spawnBuilding() {
    if (this.finished) return;
    const empty = this.board.findIndex((value) => value === 0);
    if (empty < 0) return this.flash("棋盘已满，先合并建筑", 0xfb7185);
    if (this.coins < 20 || this.energy < 1) return this.flash("资源不足，继续完成合并订单", 0xfb7185);
    bumpQaTouch();
    this.coins -= 20;
    this.energy -= 1;
    this.board[empty] = 1;
    playBleep("pickup");
    this.renderBoard();
  }

  private renderBoard() {
    const g = this.boardGraphics;
    const w = this.scale.width;
    const h = this.scale.height;
    const { x: ox, y: oy, cell } = this.grid;
    g.clear();
    g.fillStyle(0x24150c, 1).fillRect(0, 0, w, h);
    g.fillStyle(0x5b341d, 0.45).fillCircle(w * 0.12, h * 0.24, 90);
    g.fillStyle(0x365314, 0.5).fillCircle(w * 0.88, h * 0.31, 120);
    g.fillStyle(0x1f160f, 0.9).fillRoundedRect(ox - 9, oy - 9, cell * 5 + 18, cell * 5 + 18, 14);
    this.buildingTexts.forEach((text) => text.destroy());
    this.buildingTexts = [];
    for (let i = 0; i < 25; i += 1) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = ox + col * cell;
      const y = oy + row * cell;
      const selected = this.selectedIndex === i;
      g.fillStyle(selected ? 0xfef3c7 : ((col + row) % 2 ? 0x4d7c0f : 0x3f6212), selected ? 0.34 : 0.72);
      g.fillRoundedRect(x + 3, y + 3, cell - 6, cell - 6, 8);
      g.lineStyle(selected ? 3 : 1, selected ? 0xfacc15 : 0x86efac, selected ? 1 : 0.25).strokeRoundedRect(x + 3, y + 3, cell - 6, cell - 6, 8);
      const level = this.board[i];
      if (!level) continue;
      const meta = LEVELS[level as BuildingLevel];
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const bw = cell * (0.42 + level * 0.045);
      const bh = cell * (0.28 + level * 0.055);
      g.fillStyle(0x3f2a1c, 0.5).fillEllipse(cx + 4, cy + bh * 0.55, bw * 1.15, bh * 0.38);
      g.fillStyle(meta.color, 1).fillRoundedRect(cx - bw / 2, cy - bh * 0.15, bw, bh, 3);
      g.fillStyle(meta.roof, 1).fillTriangle(cx - bw * 0.62, cy - bh * 0.14, cx, cy - bh * 0.7, cx + bw * 0.62, cy - bh * 0.14);
      g.fillStyle(0xfef3c7, 0.9).fillRect(cx - bw * 0.1, cy + bh * 0.28, bw * 0.2, bh * 0.57);
      const label = styleHudText(this.add.text(cx, y + cell - 12, `Lv.${level}`, { fontSize: `${Math.max(9, cell * 0.13)}px`, fontStyle: "bold", color: "#ffffff", backgroundColor: "rgba(15,23,42,.65)", padding: { x: 4, y: 2 } }).setOrigin(0.5)).setDepth(16);
      this.buildingTexts.push(label);
    }
    const highest = Math.max(...this.board);
    this.statusText.setText(`金币 ${this.coins}   ·   能量 ${this.energy}/20   ·   合并 ${this.merges}   ·   得分 ${this.score}`);
    this.orderText.setText(`主订单：${LEVELS[5].name}\n当前最高：${highest ? LEVELS[highest as BuildingLevel].name : "空地"}`);
    setPhaserQaState({
      showcaseRuntime: "estate-merge", estateBoard: this.board.join(","), estateMerges: this.merges,
      estateHighest: highest, estateCoins: this.coins, estateEnergy: this.energy,
      estateCompleted: this.finished, estateGridX: ox, estateGridY: oy, estateCell: cell,
    });
  }

  private flash(message: string, color: number) {
    const text = styleHudText(this.add.text(this.scale.width / 2, this.scale.height * 0.48, message, { fontSize: "17px", fontStyle: "bold", color: `#${color.toString(16).padStart(6, "0")}`, backgroundColor: "rgba(28,18,10,.9)", padding: { x: 14, y: 8 } }).setOrigin(0.5)).setDepth(60);
    this.tweens.add({ targets: text, y: text.y - 28, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    this.score += 2500;
    this.soundscape?.setSection("victory");
    playBleep("win");
    setPhaserQaState({ estateCompleted: true, estateHighest: 5, estateMerges: this.merges, estateBoard: this.board.join(",") });
    const w = this.scale.width; const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, 0x160d07, 0.82).setDepth(80);
    styleHudText(this.add.text(w / 2, h / 2 - 48, "中央大庄园落成", { fontSize: "34px", fontStyle: "bold", color: "#fde68a" }).setOrigin(0.5)).setDepth(81);
    styleHudText(this.add.text(w / 2, h / 2 + 8, `${this.merges} 次合并 · ${this.coins} 金币 · ${this.score} 分`, { fontSize: "16px", color: "#ffffff" }).setOrigin(0.5)).setDepth(81);
    this.time.delayedCall(950, () => this.onEnd({ score: this.score, won: true }));
  }
}
