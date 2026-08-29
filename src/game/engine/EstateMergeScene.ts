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

const ESTATE_ASSETS = {
  valley: "showcase-estate-valley",
  buildings: "showcase-estate-buildings",
} as const;

// These source rectangles deliberately leave breathing room around each hand-painted
// building.  The asset is an original sprite strip, rather than another vector roof.
const BUILDING_CROPS: Record<BuildingLevel, { x: number; y: number; width: number; height: number }> = {
  1: { x: 0, y: 38, width: 390, height: 610 },
  2: { x: 390, y: 28, width: 330, height: 625 },
  3: { x: 710, y: 18, width: 430, height: 660 },
  4: { x: 1120, y: 8, width: 460, height: 690 },
  5: { x: 1535, y: 0, width: 635, height: 720 },
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
  private buildingSprites: Phaser.GameObjects.Image[] = [];
  private valley!: Phaser.GameObjects.Image;
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

  preload() {
    if (!this.textures.exists(ESTATE_ASSETS.valley)) this.load.image(ESTATE_ASSETS.valley, "/game-showcase/estate/estate-valley.png");
    if (!this.textures.exists(ESTATE_ASSETS.buildings)) this.load.image(ESTATE_ASSETS.buildings, "/game-showcase/estate/estate-buildings.png");
  }

  create() {
    for (let i = 0; i < 16; i += 1) this.board[i] = 1;
    this.valley = this.add.image(0, 0, ESTATE_ASSETS.valley).setOrigin(0).setDepth(-10);
    this.boardGraphics = this.add.graphics();
    styleHudText(this.add.text(18, 14, "GRAND ESTATE", { fontSize: "20px", fontStyle: "bold", color: "#fffdf5", stroke: "#31531d", strokeThickness: 4 })).setDepth(30);
    styleHudText(this.add.text(18, 42, "拖动同阶庄园合并，点亮整座河谷领地。", { fontSize: "11px", color: "#fff8db", wordWrap: { width: this.scale.width - 36 }, stroke: "#31531d", strokeThickness: 3 })).setDepth(30);
    this.statusText = styleHudText(this.add.text(18, 66, "", { fontSize: "15px", color: "#fffdf5", stroke: "#31531d", strokeThickness: 3 })).setDepth(30);
    this.orderText = styleHudText(this.add.text(this.scale.width - 18, 66, "", { fontSize: "13px", color: "#fff8db", align: "right", stroke: "#31531d", strokeThickness: 3 }).setOrigin(1, 0)).setDepth(30);
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
    this.valley.setDisplaySize(w, h);
    // A subtle glaze keeps the board readable but lets the real environment carry
    // the scene.  The old scene was entirely circles, rounded rectangles and text.
    g.fillStyle(0x10240d, 0.1).fillRect(0, 0, w, h);
    g.fillStyle(0x17300f, 0.78).fillRoundedRect(ox - 12, oy - 12, cell * 5 + 24, cell * 5 + 24, 18);
    g.lineStyle(2, 0xffedb0, 0.74).strokeRoundedRect(ox - 12, oy - 12, cell * 5 + 24, cell * 5 + 24, 18);
    g.fillStyle(0x263f16, 0.82).fillRoundedRect(8, 7, Math.min(550, w - 16), 86, 14);
    g.fillStyle(0x263f16, 0.82).fillRoundedRect(Math.max(8, w - 230), 52, 222, 43, 12);
    this.buildingTexts.forEach((text) => text.destroy());
    this.buildingTexts = [];
    this.buildingSprites.forEach((sprite) => sprite.destroy());
    this.buildingSprites = [];
    for (let i = 0; i < 25; i += 1) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = ox + col * cell;
      const y = oy + row * cell;
      const selected = this.selectedIndex === i;
      g.fillStyle(selected ? 0xfff1b8 : ((col + row) % 2 ? 0x679330 : 0x568324), selected ? 0.48 : 0.8);
      g.fillRoundedRect(x + 3, y + 3, cell - 6, cell - 6, 10);
      g.lineStyle(selected ? 3 : 1, selected ? 0xffcf4a : 0xe6f7b1, selected ? 1 : 0.38).strokeRoundedRect(x + 3, y + 3, cell - 6, cell - 6, 10);
      const level = this.board[i];
      if (!level) continue;
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      g.fillStyle(0x1e3410, 0.42).fillEllipse(cx + 4, y + cell * 0.75, cell * 0.74, cell * 0.22);
      const crop = BUILDING_CROPS[level as BuildingLevel];
      const sprite = this.add.image(cx, y + cell * 0.48, ESTATE_ASSETS.buildings)
        .setCrop(crop.x, crop.y, crop.width, crop.height)
        .setDisplaySize(cell * 0.91, cell * 0.88)
        .setDepth(15);
      if (selected) sprite.setTint(0xfff1a8);
      this.buildingSprites.push(sprite);
      const label = styleHudText(this.add.text(cx, y + cell - 12, `Lv.${level}`, { fontSize: `${Math.max(9, cell * 0.13)}px`, fontStyle: "bold", color: "#ffffff", backgroundColor: "rgba(26,52,17,.84)", padding: { x: 5, y: 2 }, stroke: "#1b310e", strokeThickness: 2 }).setOrigin(0.5)).setDepth(16);
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
