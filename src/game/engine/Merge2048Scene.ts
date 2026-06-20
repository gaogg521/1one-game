import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import {
  juiceBurst,
  juiceFail,
  juiceWin,
  themeParticleHex,
} from "@/game/engine/gameJuice";
import type { GameSpec } from "@/lib/game-spec";
import {
  buildMerge2048Blueprint,
  type Merge2048Blueprint,
} from "@/lib/merge-2048-blueprint";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { showControlsHint } from "@/game/engine/controls-hint";
import { initQaState, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import type { CohesivePresentation } from "@/lib/cohesive-presentation";

type EndPayload = { score: number; won: boolean };
type Dir = "left" | "right" | "up" | "down";

/**
 * 不同数字方块的视觉颜色（与经典 2048 调色接近，便于玩家直觉识别）。
 * key = 方块数值，value = 0xRRGGBB。
 */
const TILE_COLORS: Record<number, number> = {
  2: 0xeee4da,
  4: 0xede0c8,
  8: 0xf2b179,
  16: 0xf59563,
  32: 0xf67c5f,
  64: 0xf65e3b,
  128: 0xedcf72,
  256: 0xedcc61,
  512: 0xedc850,
  1024: 0xedc53f,
  2048: 0xedc22e,
  4096: 0x3c3a32,
  8192: 0x3c3a32,
};

const TEXT_DARK_TILES = new Set<number>([2, 4]);

function tileColor(value: number): number {
  return TILE_COLORS[value] ?? 0x3c3a32;
}

function textColor(value: number): string {
  return TEXT_DARK_TILES.has(value) ? "#776e65" : "#f9f6f2";
}

/** 确定性伪随机 0..1（与 TetrisScene / PlatformerScene 风格一致） */
function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function hexToInt(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  return Number.isFinite(n) ? n : 0x38bdf8;
}

/**
 * 真 2048 合并场景。
 *
 * - N×N 网格（默认 4×4，可配 5×5 / 6×6）
 * - 玩家按 ← → ↑ ↓ 滑动，所有方块同方向移动；同值方块碰撞 → 合并为 2 倍
 * - 每次有效移动后随机生成 1 个新方块（2 或 4）
 * - 达到 targetTile 通关 / 网格满且无法移动 → 失败
 * - HUD：当前最大块 + 分数 + 移动数（HudFrame）
 */
export class Merge2048Scene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private bp!: Merge2048Blueprint;
  private cohesive!: CohesivePresentation;
  private hud!: HudFrame;

  // ── 游戏状态 ──
  private size = 4;
  /** grid[r][c] = 方块数值，0 表示空格 */
  private grid: number[][] = [];
  private score = 0;
  private moves = 0;
  private maxTile = 0;
  private targetTile = 2048;
  private finished = false;
  private inputLocked = false;

  // ── 渲染 ──
  private cellPx = 80;
  private gap = 10;
  private boardX = 0;
  private boardY = 0;
  private boardGfx!: Phaser.GameObjects.Graphics;
  /** 已渲染的方块对象集合：Map<`${r},${c}`, { rect, text }> */
  private tileViews: Map<string, { rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }> = new Map();

  // ── 输入 ──
  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private swipeStartX = 0;
  private swipeStartY = 0;
  private swipeActive = false;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("Merge2048Scene");
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape ?? null;
  }

  preload() {
    if (this.backgroundUrl) {
      this.load.image("bgTex", this.backgroundUrl);
    }
  }

  create() {
    const viewW = this.scale.width;
    const viewH = this.scale.height;

    // blueprint 优先取 spec.merge2048（若已落库），否则按 prompt 兜底推断
    this.bp = buildMerge2048Blueprint({ spec: this.spec });
    this.size = this.bp.gridSize;
    this.targetTile = this.bp.targetTile;

    // 单元格大小自适应：网格能放进中央区域为准
    const maxBoardW = Math.min(viewW * 0.7, 460);
    const maxBoardH = viewH - 180;
    const cellByW = Math.floor((maxBoardW - (this.size + 1) * this.gap) / this.size);
    const cellByH = Math.floor((maxBoardH - (this.size + 1) * this.gap) / this.size);
    this.cellPx = Math.max(40, Math.min(cellByW, cellByH, 96));

    const boardW = this.size * this.cellPx + (this.size + 1) * this.gap;
    const boardH = boardW;
    this.boardX = Math.floor((viewW - boardW) * 0.5);
    this.boardY = Math.floor((viewH - boardH) * 0.5) + 16;

    this.cohesive = buildSceneCohesion(this.spec);

    // 背景
    this.cameras.main.setBackgroundColor(this.spec.theme.backgroundColor);
    this.addStarfield();
    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      this.add
        .image(viewW / 2, viewH / 2, "bgTex")
        .setDepth(-10)
        .setAlpha(0.35);
    }

    // 网格初始化（全 0）
    this.grid = [];
    for (let r = 0; r < this.size; r += 1) {
      const row: number[] = [];
      for (let c = 0; c < this.size; c += 1) row.push(0);
      this.grid.push(row);
    }

    // 棋盘背景（含格子槽）
    this.boardGfx = this.add.graphics().setDepth(5);
    this.drawBoardBackground();

    // 初始 2 个方块
    const seedInt = Math.floor((this.spec.samplePlayProfile?.seed ?? 0) * 0x100000000) || 1;
    let spawnIdx = 1;
    for (let i = 0; i < 2; i += 1) {
      this.spawnRandomTile(seedInt, spawnIdx);
      spawnIdx += 1;
    }
    this.recomputeMaxTile();
    this.renderTiles(true);

    // HUD 框架（顶部）
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, this.cohesive);
    this.hud.setBottomHint(
      this.uiLocale === "zh-Hans"
        ? "← → ↑ ↓ 滑动合并 · 相同数字合并为 2 倍 · 达成 " + this.targetTile + " 通关"
        : "← → ↑ ↓ Swipe to merge · Same numbers double · Reach " + this.targetTile + " to win",
    );

    // 输入：方向键 + WASD
    const kb = this.input.keyboard!;
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);

    kb.on("keydown-LEFT", () => this.queueMove("left"));
    kb.on("keydown-RIGHT", () => this.queueMove("right"));
    kb.on("keydown-UP", () => this.queueMove("up"));
    kb.on("keydown-DOWN", () => this.queueMove("down"));
    kb.on("keydown-A", () => this.queueMove("left"));
    kb.on("keydown-D", () => this.queueMove("right"));
    kb.on("keydown-W", () => this.queueMove("up"));
    kb.on("keydown-S", () => this.queueMove("down"));

    // 触屏滑动
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.swipeStartX = p.x;
      this.swipeStartY = p.y;
      this.swipeActive = true;
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.swipeActive) return;
      this.swipeActive = false;
      const dx = p.x - this.swipeStartX;
      const dy = p.y - this.swipeStartY;
      const threshold = 24;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.queueMove(dx > 0 ? "right" : "left");
      } else {
        this.queueMove(dy > 0 ? "down" : "up");
      }
    });

    this.refreshHud();

    initQaState({ qaTouches: 0 });
    setPhaserQaState({ playerX: Math.round(this.boardX) });
    schedulePhaserPlayReady(this, 350, { playerX: Math.round(this.boardX) });

    showControlsHint(this, [
      this.uiLocale === "zh-Hans" ? "← → ↑ ↓ 滑动合并" : "← → ↑ ↓ Swipe to merge",
      this.uiLocale === "zh-Hans" ? "相同数字合并为 2 倍" : "Same numbers double",
      this.uiLocale === "zh-Hans"
        ? `达成 ${this.targetTile} 通关`
        : `Reach ${this.targetTile} to win`,
    ]);
  }

  // ── 渲染 ──────────────────────────────────────────────────────────

  private drawBoardBackground(): void {
    const g = this.boardGfx;
    g.clear();
    const totalW = this.size * this.cellPx + (this.size + 1) * this.gap;
    // 外框背景
    g.fillStyle(0xbbada0, 0.92);
    g.fillRoundedRect(this.boardX - 4, this.boardY - 4, totalW + 8, totalW + 8, 10);
    // 各格槽（凹陷感）
    g.fillStyle(0xcdc1b4, 0.85);
    for (let r = 0; r < this.size; r += 1) {
      for (let c = 0; c < this.size; c += 1) {
        const { x, y } = this.cellPos(r, c);
        g.fillRoundedRect(x, y, this.cellPx, this.cellPx, 6);
      }
    }
  }

  /** 计算格子 (r,c) 的左上角像素坐标 */
  private cellPos(r: number, c: number): { x: number; y: number } {
    const x = this.boardX + this.gap + c * (this.cellPx + this.gap);
    const y = this.boardY + this.gap + r * (this.cellPx + this.gap);
    return { x, y };
  }

  /**
   * 渲染当前 grid 状态到方块视图。
   * @param instant true=无动画直接落位（首次/重置）；false=带轻微缩放动画（合并反馈）
   */
  private renderTiles(instant: boolean): void {
    // 清理旧视图
    for (const view of this.tileViews.values()) {
      view.rect.destroy();
      view.text.destroy();
    }
    this.tileViews.clear();

    for (let r = 0; r < this.size; r += 1) {
      for (let c = 0; c < this.size; c += 1) {
        const v = this.grid[r]![c]!;
        if (v <= 0) continue;
        const { x, y } = this.cellPos(r, c);
        const cx = x + this.cellPx / 2;
        const cy = y + this.cellPx / 2;
        const rect = this.add
          .rectangle(cx, cy, this.cellPx - 2, this.cellPx - 2, tileColor(v), 1)
          .setDepth(8);
        const text = this.add
          .text(cx, cy, String(v), {
            fontFamily:
              "'Inter', system-ui, -apple-system, 'Segoe UI', 'PingFang SC', sans-serif",
            fontSize: this.fontSizeFor(v),
            fontStyle: "700",
            color: textColor(v),
          })
          .setOrigin(0.5)
          .setDepth(9);
        this.tileViews.set(`${r},${c}`, { rect, text });

        if (!instant) {
          rect.setScale(0.6);
          text.setScale(0.6);
          this.tweens.add({
            targets: [rect, text],
            scale: 1,
            duration: 140,
            ease: "Back.easeOut",
          });
        }
      }
    }
  }

  private fontSizeFor(value: number): string {
    const digits = String(value).length;
    const base = Math.floor(this.cellPx * 0.42);
    if (digits <= 2) return `${base}px`;
    if (digits === 3) return `${Math.floor(base * 0.85)}px`;
    if (digits === 4) return `${Math.floor(base * 0.72)}px`;
    return `${Math.floor(base * 0.6)}px`;
  }

  // ── 游戏逻辑 ──────────────────────────────────────────────────────

  /** 在空格中随机生成一个新方块（2 概率 90%，4 概率 10%） */
  private spawnRandomTile(seed: number, idx: number): void {
    const empties: Array<{ r: number; c: number }> = [];
    for (let r = 0; r < this.size; r += 1) {
      for (let c = 0; c < this.size; c += 1) {
        if (this.grid[r]![c]! === 0) empties.push({ r, c });
      }
    }
    if (empties.length === 0) return;
    const pickIdx = Math.floor(rnd(seed, idx * 31 + 7) * empties.length);
    const cell = empties[Math.min(pickIdx, empties.length - 1)]!;
    const isFour = rnd(seed, idx * 53 + 13) < 0.1;
    this.grid[cell.r]![cell.c] = isFour ? 4 : 2;
  }

  private recomputeMaxTile(): void {
    let m = 0;
    for (let r = 0; r < this.size; r += 1) {
      for (let c = 0; c < this.size; c += 1) {
        const v = this.grid[r]![c]!;
        if (v > m) m = v;
      }
    }
    this.maxTile = m;
  }

  /**
   * 把一行/一列沿移动方向「压缩 + 合并」。
   * line 是按移动方向排好序的数值数组（首个元素为最远端，即移动目标方向）。
   * 返回压缩后的新数组（长度不变），并累加合并产生的分数。
   */
  private compressLine(line: number[]): { result: number[]; gained: number; merged: boolean } {
    const n = line.length;
    const filtered = line.filter((v) => v !== 0);
    const result: number[] = [];
    let gained = 0;
    let merged = false;
    let i = 0;
    while (i < filtered.length) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        const mergedVal = filtered[i]! * 2;
        result.push(mergedVal);
        gained += mergedVal;
        merged = true;
        i += 2;
      } else {
        result.push(filtered[i]!);
        i += 1;
      }
    }
    while (result.length < n) result.push(0);
    return { result, gained, merged };
  }

  /** 按方向取出一行/一列的数值数组（已按移动方向排序，[0] = 最远端） */
  private extractLine(index: number, dir: Dir): number[] {
    const out: number[] = [];
    if (dir === "left") {
      for (let c = 0; c < this.size; c += 1) out.push(this.grid[index]![c]!);
    } else if (dir === "right") {
      for (let c = this.size - 1; c >= 0; c -= 1) out.push(this.grid[index]![c]!);
    } else if (dir === "up") {
      for (let r = 0; r < this.size; r += 1) out.push(this.grid[r]![index]!);
    } else {
      // down
      for (let r = this.size - 1; r >= 0; r -= 1) out.push(this.grid[r]![index]!);
    }
    return out;
  }

  /** 把压缩后的数组写回 grid（按移动方向） */
  private writeLine(index: number, dir: Dir, line: number[]): void {
    if (dir === "left") {
      for (let c = 0; c < this.size; c += 1) this.grid[index]![c] = line[c]!;
    } else if (dir === "right") {
      for (let c = this.size - 1, i = 0; c >= 0; c -= 1, i += 1) this.grid[index]![c] = line[i]!;
    } else if (dir === "up") {
      for (let r = 0; r < this.size; r += 1) this.grid[r]![index] = line[r]!;
    } else {
      // down
      for (let r = this.size - 1, i = 0; r >= 0; r -= 1, i += 1) this.grid[r]![index] = line[i]!;
    }
  }

  private queueMove(dir: Dir): void {
    if (this.finished || this.inputLocked) return;
    GameAudioSafeBoot();
    this.inputLocked = true;

    // 快照用于判定是否有变化
    const before = this.snapshotGrid();
    let totalGained = 0;
    let anyMerged = false;
    for (let i = 0; i < this.size; i += 1) {
      const line = this.extractLine(i, dir);
      const { result, gained, merged } = this.compressLine(line);
      this.writeLine(i, dir, result);
      totalGained += gained;
      if (merged) anyMerged = true;
    }

    const changed = !this.gridsEqual(before, this.snapshotGrid());
    if (changed) {
      this.moves += 1;
      this.score += totalGained;
      this.recomputeMaxTile();
      if (anyMerged && totalGained > 0) {
        playBleep("pickup");
        juiceBurst(
          this,
          this.boardX + (this.size * this.cellPx) / 2,
          this.boardY + (this.size * this.cellPx) / 2,
          themeParticleHex(this.spec),
          6,
        );
      } else {
        playBleep("fire");
      }
      // 移动后生成新块
      const seedInt = Math.floor((this.spec.samplePlayProfile?.seed ?? 0) * 0x100000000) || 1;
      for (let s = 0; s < this.bp.spawnPerMove; s += 1) {
        this.spawnRandomTile(seedInt, this.moves * 100 + s + 99);
      }
      this.renderTiles(false);
      this.refreshHud();

      // 通关 / 失败判定
      if (this.maxTile >= this.targetTile) {
        this.finish({ score: this.score, won: true });
        return;
      }
      if (this.moves >= this.bp.maxMoves) {
        this.finish({ score: this.score, won: false });
        return;
      }
      if (!this.hasAnyMove()) {
        this.finish({ score: this.score, won: false });
        return;
      }
    } else {
      // 无效移动：轻微反馈，不消耗 moves
      playBleep("hit");
    }

    // 短锁防止连按导致动画堆积
    this.time.delayedCall(90, () => {
      this.inputLocked = false;
    });
  }

  private snapshotGrid(): number[][] {
    return this.grid.map((row) => row.slice());
  }

  private gridsEqual(a: number[][], b: number[][]): boolean {
    for (let r = 0; r < this.size; r += 1) {
      for (let c = 0; c < this.size; c += 1) {
        if (a[r]![c]! !== b[r]![c]!) return false;
      }
    }
    return true;
  }

  /** 检查是否还有任何合法移动（有空格 或 有相邻同值） */
  private hasAnyMove(): boolean {
    for (let r = 0; r < this.size; r += 1) {
      for (let c = 0; c < this.size; c += 1) {
        if (this.grid[r]![c]! === 0) return true;
        const v = this.grid[r]![c]!;
        if (c + 1 < this.size && this.grid[r]![c + 1]! === v) return true;
        if (r + 1 < this.size && this.grid[r + 1]![c]! === v) return true;
      }
    }
    return false;
  }

  private refreshHud(): void {
    const right =
      this.uiLocale === "zh-Hans"
        ? `最大 ${this.maxTile} · 目标 ${this.targetTile}`
        : `Max ${this.maxTile} · Target ${this.targetTile}`;
    this.hud.update({
      score: this.score,
      right,
      actLabel:
        this.uiLocale === "zh-Hans"
          ? `移动 ${this.moves}/${this.bp.maxMoves}`
          : `Moves ${this.moves}/${this.bp.maxMoves}`,
      skill: "",
    });
  }

  private finish(payload: EndPayload): void {
    if (this.finished) return;
    this.finished = true;
    this.hud.update({ dangerLevel: 0 });
    const cx = this.boardX + (this.size * this.cellPx) / 2;
    const cy = this.boardY + (this.size * this.cellPx) / 2;
    this.hud.setBottomHint(
      payload.won
        ? this.uiLocale === "zh-Hans"
          ? `通关 · 最大 ${this.maxTile} · 分数 ${this.score} · 移动 ${this.moves}`
          : `Win · Max ${this.maxTile} · Score ${this.score} · Moves ${this.moves}`
        : this.uiLocale === "zh-Hans"
          ? `失败 · 最大 ${this.maxTile} · 分数 ${this.score} · 移动 ${this.moves}`
          : `Fail · Max ${this.maxTile} · Score ${this.score} · Moves ${this.moves}`,
    );
    if (payload.won) {
      this.cameras.main.shake(300, 0.008);
      juiceWin(this, {
        x: cx,
        y: cy,
        colorHex: themeParticleHex(this.spec),
        text: this.uiLocale === "zh-Hans" ? "通关" : "Win",
        textColorCss: this.cohesive.hud.accent,
      });
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    } else {
      juiceFail(this, {
        x: cx,
        y: cy,
        colorHex: this.spec.theme.hazardColor,
        text: this.uiLocale === "zh-Hans" ? "失败" : "Fail",
        textColorCss: this.cohesive.hud.danger,
      });
      playBleep("hit");
    }
    this.onEnd(payload);
  }

  private addStarfield(): void {
    const tint = hexToInt(
      this.spec.theme.particleTint ?? this.spec.theme.collectibleColor ?? "#38bdf8",
    );
    const W = this.scale.width;
    const H = this.scale.height;
    for (let i = 0; i < 60; i += 1) {
      const x = Phaser.Math.Between(4, W - 4);
      const y = Phaser.Math.Between(4, H - 4);
      const s = Phaser.Math.FloatBetween(1, 2.4);
      const a = Phaser.Math.FloatBetween(0.05, 0.22);
      this.add.rectangle(x, y, s, s, tint, a).setDepth(-12);
    }
  }

  update(): void {
    this.hud.update({});
    setPhaserQaState({ playerX: Math.round(this.boardX) });
  }
}

/**
 * 安全调用 GameAudio boot_interactive（避免在该 Scene 直接耦合 audio 模块）。
 * 如果 GameAudio 未全局可用，则静默跳过。
 */
function GameAudioSafeBoot(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (globalThis as any).GameAudio;
    if (g && typeof g.boot_interactive === "function") {
      g.boot_interactive();
    }
  } catch {
    // 静默：音频非关键路径
  }
}
