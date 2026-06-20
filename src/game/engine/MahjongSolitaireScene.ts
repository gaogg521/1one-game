import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import type { GameSpec } from "@/lib/game-spec";
import {
  buildMahjongSolitaireBlueprint,
  type MahjongSolitaireBlueprint,
} from "@/lib/mahjong-solitaire-blueprint";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { initQaState } from "@/game/engine/phaser-qa-state";

type EndPayload = { score: number; won: boolean };

// ─── 牌面系统 ─────────────────────────────────────────────────────────
/** 简化麻将：3 花色（万/条/筒）× 9 数字 */
type Suit = "man" | "tiao" | "tong";

interface MahjongTile {
  suit: Suit;
  /** 1..9 */
  rank: number;
  /** 唯一 id（同花色同 rank 的牌可配对，但 id 不同） */
  id: string;
}

interface TileView {
  tile: MahjongTile;
  /** 网格列 */
  col: number;
  /** 网格行 */
  row: number;
  /** 层级（0=底层 / 1=上层） */
  layer: number;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  /** 是否已被消除 */
  removed: boolean;
  /** 是否可点击（上层无覆盖 + 下方有支撑） */
  clickable: boolean;
}

const SUIT_LABEL: Record<Suit, string> = {
  man: "万",
  tiao: "条",
  tong: "筒",
};

const SUIT_COLOR: Record<Suit, number> = {
  man: 0x2563eb, // 万=蓝
  tiao: 0x16a34a, // 条=绿
  tong: 0xdc2626, // 筒=红
};

const SUIT_TEXT_COLOR: Record<Suit, string> = {
  man: "#ffffff",
  tiao: "#ffffff",
  tong: "#ffffff",
};

const RANK_LABEL: Record<number, string> = {
  1: "一",
  2: "二",
  3: "三",
  4: "四",
  5: "五",
  6: "六",
  7: "七",
  8: "八",
  9: "九",
};

/**
 * 真麻将接龙场景：
 * - 屏幕中央排列麻将牌网格（万/条/筒 3 花色 × 9 数字）
 * - 玩家点击两张相同牌 → 配对消除
 * - 牌被消除后释放上层叠的牌（可点击）
 * - 全部配对消除 → 通关 / 时间到失败
 * - HUD：剩余对数 + 时间（HudFrame）
 */
export class MahjongSolitaireScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private bp!: MahjongSolitaireBlueprint;
  private hud!: HudFrame;

  private tiles: TileView[] = [];
  private selectedTile: TileView | null = null;
  private selectedHighlight: Phaser.GameObjects.Rectangle | null = null;

  private remainingPairs = 0;
  private totalPairs = 0;
  private timeLeftMs = 0;
  private finished = false;
  private score = 0;
  private startTime = 0;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super({ key: "MahjongSolitaireScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape ?? null;
  }

  preload() {
    // 纯程序化绘制，无需外部资源
  }

  create() {
    const ui = buildSceneCohesion(this.spec);
    this.bp = buildMahjongSolitaireBlueprint({ spec: this.spec });

    const viewW = this.scale.width;
    const viewH = this.scale.height;

    // 背景
    this.add
      .rectangle(
        viewW / 2,
        viewH / 2,
        viewW,
        viewH,
        Phaser.Display.Color.HexStringToColor(this.spec.theme.backgroundColor).color,
      )
      .setDepth(-2);
    // 桌面木色背板
    this.add.rectangle(viewW / 2, viewH / 2, viewW - 40, viewH - 80, 0x3d2817, 0.85).setDepth(-1);
    // 桌面毛毡
    this.add.rectangle(viewW / 2, viewH / 2 + 10, viewW - 60, viewH - 110, 0x1f6f3f, 0.7).setDepth(-1);

    initQaState({ templateId: this.spec.templateId });
    this.startTime = this.time.now;
    this.timeLeftMs = this.bp.timeLimitMs;
    this.totalPairs = this.bp.targetPairs;
    this.remainingPairs = this.bp.targetPairs;
    this.score = 0;

    this.buildBoard(viewW, viewH);
    this.refreshClickable();
    this.updateTileVisuals();

    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, ui);
    this.hud.setBottomHint(
      this.uiLocale === "zh-Hans"
        ? "点击两张相同牌配对消除 · 全部消除通关"
        : "Click two matching tiles to pair · Clear all to win",
    );

    this.refreshHud();

    setPhaserQaState({ playerX: Math.round(viewW / 2) });
    schedulePhaserPlayReady(this, 350, { playerX: Math.round(viewW / 2) });
  }

  /** 构造麻将牌网格：按 targetPairs 配对生成，分布到 gridCols × gridRows × stackLayers */
  private buildBoard(viewW: number, viewH: number) {
    const cols = this.bp.gridCols;
    const rows = this.bp.gridRows;
    const layers = this.bp.stackLayers;
    const totalSlots = cols * rows * layers;
    const pairs = this.bp.targetPairs;
    const needed = pairs * 2;

    // 防御：若网格槽位不足以容纳所需牌数，缩减对数
    const effectivePairs = Math.min(pairs, Math.floor(totalSlots / 2));
    const effectiveNeeded = effectivePairs * 2;
    this.totalPairs = effectivePairs;
    this.remainingPairs = effectivePairs;

    // 1. 生成牌组：每对两张相同花色 rank
    const tiles: MahjongTile[] = [];
    const variety = Math.min(this.bp.tileVariety, 27); // 3 花 × 9 数字 = 27 种
    const suitPool: Suit[] = ["man", "tiao", "tong"];
    let varietyIdx = 0;
    for (let i = 0; i < effectivePairs; i += 1) {
      const suit = suitPool[varietyIdx % 3]!;
      const rank = (Math.floor(varietyIdx / 3) % 9) + 1;
      const baseId = `${suit}-${rank}-${i}`;
      tiles.push({ suit, rank, id: `${baseId}-a` });
      tiles.push({ suit, rank, id: `${baseId}-b` });
      varietyIdx = (varietyIdx + 1) % variety;
    }

    // 2. 打乱（确定性：用 spec seed）
    const seed = this.spec.samplePlayProfile?.seed ?? 0;
    const seedInt = Math.floor(seed * 0x100000000) || 1;
    const rng = this.makeRng(seedInt);
    for (let i = tiles.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = tiles[i]!;
      tiles[i] = tiles[j]!;
      tiles[j] = tmp;
    }

    // 3. 计算网格几何
    const boardW = viewW - 80;
    const boardH = viewH - 140;
    const tileW = Math.min(54, Math.floor((boardW - (cols - 1) * 4) / cols));
    const tileH = Math.min(68, Math.floor((boardH - (rows - 1) * 4) / rows));
    const gapX = 4;
    const gapY = 4;
    const totalGridW = cols * tileW + (cols - 1) * gapX;
    const totalGridH = rows * tileH + (rows - 1) * gapY;
    const startX = (viewW - totalGridW) / 2 + tileW / 2;
    const startY = (viewH - totalGridH) / 2 + tileH / 2 + 10;

    // 4. 把牌按层填入网格槽位（底层先填满，剩余填上层部分位置）
    let tileCursor = 0;
    for (let layer = 0; layer < layers; layer += 1) {
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          if (tileCursor >= effectiveNeeded) break;
          // 上层只覆盖部分位置（每隔一格放一张，模拟"叠放"）
          if (layer > 0 && (col + row) % 2 !== 0) continue;

          const tile = tiles[tileCursor]!;
          tileCursor += 1;

          const x = startX + col * (tileW + gapX);
          const y = startY + row * (tileH + gapY);
          // 上层向右下偏移，制造层叠视觉
          const ox = layer * 6;
          const oy = layer * -6;

          const rect = this.add
            .rectangle(x + ox, y + oy, tileW, tileH, SUIT_COLOR[tile.suit], 1)
            .setDepth(layer * 10 + 5)
            .setStrokeStyle(2, 0xffffff, 0.9)
            .setInteractive({ useHandCursor: true });

          const labelText = `${RANK_LABEL[tile.rank] ?? tile.rank}${SUIT_LABEL[tile.suit]}`;
          const label = this.add
            .text(x + ox, y + oy, labelText, {
              fontFamily: "Arial, sans-serif",
              fontSize: `${Math.max(11, Math.floor(tileH * 0.32))}px`,
              color: SUIT_TEXT_COLOR[tile.suit],
              fontStyle: "bold",
            })
            .setOrigin(0.5)
            .setDepth(layer * 10 + 6);

          const view: TileView = {
            tile,
            col,
            row,
            layer,
            rect,
            label,
            removed: false,
            clickable: false,
          };

          rect.on("pointerdown", () => this.onTileClick(view));

          this.tiles.push(view);
        }
      }
    }
  }

  /** 简单确定性 RNG（mulberry32） */
  private makeRng(seedInt: number): () => number {
    let a = seedInt >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 计算每张牌是否可点击：未被上层牌覆盖 */
  private refreshClickable() {
    for (const t of this.tiles) {
      if (t.removed) {
        t.clickable = false;
        continue;
      }
      // 检查是否有同 col/row 的上层未消除牌覆盖
      let covered = false;
      for (const other of this.tiles) {
        if (other === t || other.removed) continue;
        if (other.layer > t.layer && other.col === t.col && other.row === t.row) {
          covered = true;
          break;
        }
      }
      t.clickable = !covered;
    }
  }

  /** 视觉刷新：灰显不可点击 / 已消除的隐藏 */
  private updateTileVisuals() {
    for (const t of this.tiles) {
      if (t.removed) {
        t.rect.setVisible(false);
        t.label.setVisible(false);
        continue;
      }
      t.rect.setVisible(true);
      t.label.setVisible(true);
      if (t.clickable) {
        t.rect.setFillStyle(SUIT_COLOR[t.tile.suit], 1);
        t.rect.setStrokeStyle(2, 0xffffff, 0.9);
        t.label.setAlpha(1);
      } else {
        t.rect.setFillStyle(SUIT_COLOR[t.tile.suit], 0.4);
        t.rect.setStrokeStyle(1.5, 0x888888, 0.6);
        t.label.setAlpha(0.45);
      }
    }
  }

  private onTileClick(view: TileView) {
    if (this.finished) return;
    if (view.removed || !view.clickable) return;

    if (this.selectedTile === null) {
      this.selectTile(view);
      return;
    }

    if (this.selectedTile === view) {
      // 取消选中
      this.clearSelection();
      return;
    }

    // 判定配对：相同花色 + 相同 rank
    const a = this.selectedTile.tile;
    const b = view.tile;
    if (a.suit === b.suit && a.rank === b.rank) {
      this.removePair(this.selectedTile, view);
      this.clearSelection();
    } else {
      // 不匹配：切换选中
      playBleep("hit");
      this.clearSelection();
      this.selectTile(view);
    }
  }

  private selectTile(view: TileView) {
    this.selectedTile = view;
    if (this.selectedHighlight) this.selectedHighlight.destroy();
    this.selectedHighlight = this.add
      .rectangle(view.rect.x, view.rect.y, view.rect.width + 8, view.rect.height + 8, 0xfde047, 0)
      .setStrokeStyle(3, 0xfde047, 1)
      .setDepth(1000);
  }

  private clearSelection() {
    this.selectedTile = null;
    if (this.selectedHighlight) {
      this.selectedHighlight.destroy();
      this.selectedHighlight = null;
    }
  }

  private removePair(a: TileView, b: TileView) {
    a.removed = true;
    b.removed = true;
    a.rect.setVisible(false);
    a.label.setVisible(false);
    b.rect.setVisible(false);
    b.label.setVisible(false);

    this.remainingPairs -= 1;
    this.score += 100;

    // 消除反馈
    playBleep("pickup");
    this.cameras.main.flash(120, 253, 224, 71, false);

    this.refreshClickable();
    this.updateTileVisuals();
    this.refreshHud();

    if (this.remainingPairs <= 0) {
      this.finish({ score: this.score, won: true });
    }
  }

  private refreshHud() {
    const right =
      this.uiLocale === "zh-Hans"
        ? `剩余对数 ${this.remainingPairs}/${this.totalPairs}`
        : `Pairs ${this.remainingPairs}/${this.totalPairs}`;
    const timeSec = Math.max(0, Math.ceil(this.timeLeftMs / 1000));
    const timeStr =
      this.uiLocale === "zh-Hans" ? `时间 ${timeSec}s` : `Time ${timeSec}s`;
    this.hud.update({
      score: this.score,
      right: `${right} · ${timeStr}`,
    });
  }

  update() {
    if (this.finished) return;
    const elapsed = this.time.now - this.startTime;
    this.timeLeftMs = Math.max(0, this.bp.timeLimitMs - elapsed);
    this.refreshHud();
    if (this.timeLeftMs <= 0) {
      this.finish({ score: this.score, won: false });
    }
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    this.finished = true;
    this.hud.setBottomHint(
      payload.won
        ? this.uiLocale === "zh-Hans"
          ? "胜利！全部配对消除"
          : "Win! All pairs cleared"
        : this.uiLocale === "zh-Hans"
          ? "时间到 · 再试一次"
          : "Time up · Try again",
    );
    if (payload.won) {
      this.cameras.main.shake(300, 0.008);
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    } else {
      playBleep("hit");
    }
    this.onEnd(payload);
  }
}
