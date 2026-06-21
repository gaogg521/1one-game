import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import {
  juiceFail,
  juicePickup,
  juiceWin,
  themeParticleHex,
} from "@/game/engine/gameJuice";
import type { GameSpec } from "@/lib/game-spec";
import { buildTetrisBlueprint, type TetrisBlueprint } from "@/lib/tetris-blueprint";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { showControlsHint } from "@/game/engine/controls-hint";
import { initQaState, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import type { CohesivePresentation } from "@/lib/cohesive-presentation";
import { hudTetrisScore, bannerTetrisWin } from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

// ── Tetromino 定义 ────────────────────────────────────────────────────
// 7 种标准方块：I / O / T / S / Z / J / L
// 每种 4 个旋转状态（旋转矩阵预计算）；颜色取经典调色。
type TetrominoKind = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

interface TetrominoDef {
  kind: TetrominoKind;
  color: number; // 0xRRGGBB
  // 每个 rotation 是 4 个 {dr, dc} 偏移（相对 spawn anchor）
  rotations: Array<Array<{ r: number; c: number }>>;
}

// 颜色（经典）
const COLOR_I = 0x22d3ee; // 青
const COLOR_O = 0xfacc15; // 黄
const COLOR_T = 0xa855f7; // 紫
const COLOR_S = 0x4ade80; // 绿
const COLOR_Z = 0xf87171; // 红
const COLOR_J = 0x3b82f6; // 蓝
const COLOR_L = 0xfb923c; // 橙

const TETROMINOES: Record<TetrominoKind, TetrominoDef> = {
  I: {
    kind: "I",
    color: COLOR_I,
    rotations: [
      [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }],
      [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 1 }, { r: 3, c: 1 }],
      [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }],
      [{ r: 0, c: 2 }, { r: 1, c: 2 }, { r: 2, c: 2 }, { r: 3, c: 2 }],
    ],
  },
  O: {
    kind: "O",
    color: COLOR_O,
    rotations: [
      [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
      [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
      [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
      [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
    ],
  },
  T: {
    kind: "T",
    color: COLOR_T,
    rotations: [
      [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
      [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 1 }],
      [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 1 }],
      [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 }],
    ],
  },
  S: {
    kind: "S",
    color: COLOR_S,
    rotations: [
      [{ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
      [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 2 }],
      [{ r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 0 }, { r: 2, c: 1 }],
      [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 }],
    ],
  },
  Z: {
    kind: "Z",
    color: COLOR_Z,
    rotations: [
      [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
      [{ r: 0, c: 2 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 1 }],
      [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 }, { r: 2, c: 2 }],
      [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 0 }],
    ],
  },
  J: {
    kind: "J",
    color: COLOR_J,
    rotations: [
      [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
      [{ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 1 }, { r: 2, c: 1 }],
      [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 2 }],
      [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 0 }, { r: 2, c: 1 }],
    ],
  },
  L: {
    kind: "L",
    color: COLOR_L,
    rotations: [
      [{ r: 0, c: 2 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
      [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 1 }, { r: 2, c: 2 }],
      [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 0 }],
      [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 1 }],
    ],
  },
};

const KIND_ORDER: TetrominoKind[] = ["I", "O", "T", "S", "Z", "J", "L"];

interface ActivePiece {
  kind: TetrominoKind;
  rot: number; // 0..3
  row: number; // 顶部锚点行
  col: number; // 顶部锚点列
}

/** 7-bag 随机器：保证每 7 个方块覆盖全部 7 形，避免长时间不出 I */
class SevenBag {
  private bag: TetrominoKind[] = [];
  private rng: () => number;

  constructor(rng: () => number) {
    this.rng = rng;
  }

  next(): TetrominoKind {
    if (this.bag.length === 0) {
      this.bag = [...KIND_ORDER];
      // Fisher-Yates 洗牌
      for (let i = this.bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.rng() * (i + 1));
        const tmp = this.bag[i]!;
        this.bag[i] = this.bag[j]!;
        this.bag[j] = tmp;
      }
    }
    return this.bag.pop()!;
  }
}

/** 确定性伪随机 0..1（与 PlatformerScene 风格一致） */
function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function hexToInt(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  return Number.isFinite(n) ? n : 0x38bdf8;
}

/** 真俄罗斯方块：7 形 Tetromino + 旋转 + 行消除 + 提速。 */
export class TetrisScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private bp!: TetrisBlueprint;
  private cohesive!: CohesivePresentation;
  private hud!: HudFrame;

  // ── 游戏状态 ──
  private cols = 10;
  private rows = 20;
  /** grid[r][c] = 颜色 0xRRGGBB 或 0（空） */
  private grid: number[][] = [];
  private active: ActivePiece | null = null;
  private nextKind: TetrominoKind | null = null;
  private bag!: SevenBag;

  private score = 0;
  private lines = 0;
  private linesSinceSpeedup = 0;
  private speedMs = 800;
  private speedStepMs = 80;
  private targetLines = 30;

  private finished = false;
  private paused = false;

  // ── 渲染 ──
  private cellPx = 26;
  private boardX = 0;
  private boardY = 0;
  private boardGfx!: Phaser.GameObjects.Graphics;
  private nextGfx!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private linesText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private nextLabel!: Phaser.GameObjects.Text;
  private pauseOverlay: Phaser.GameObjects.Rectangle | null = null;

  // ── 计时 ──
  private dropAccumMs = 0;

  // ── 输入 ──
  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyP!: Phaser.Input.Keyboard.Key;
  private leftRepeatAt = 0;
  private rightRepeatAt = 0;
  private softDropHeld = false;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("TetrisScene");
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

    this.bp = this.spec.tetris
      ? {
          gridWidth: this.spec.tetris.gridWidth,
          gridHeight: this.spec.tetris.gridHeight,
          targetLines: this.spec.tetris.targetLines,
          startSpeedMs: this.spec.tetris.startSpeedMs,
          speedStepMs: this.spec.tetris.speedStepMs ?? 80,
        }
      : buildTetrisBlueprint({ spec: this.spec });
    this.cols = this.bp.gridWidth;
    this.rows = this.bp.gridHeight;
    this.targetLines = this.bp.targetLines;
    this.speedMs = this.bp.startSpeedMs;
    this.speedStepMs = this.bp.speedStepMs;

    // 单元格大小自适应：以网格能放进中间区域为准
    const maxBoardW = Math.min(viewW * 0.45, 360);
    const maxBoardH = viewH - 140;
    const cellByW = Math.floor(maxBoardW / this.cols);
    const cellByH = Math.floor(maxBoardH / this.rows);
    this.cellPx = Math.max(16, Math.min(cellByW, cellByH));

    const boardW = this.cols * this.cellPx;
    const boardH = this.rows * this.cellPx;
    this.boardX = Math.floor((viewW - boardW) * 0.5) - 60;
    this.boardY = Math.floor((viewH - boardH) * 0.5) + 10;

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

    // 网格初始化
    this.grid = [];
    for (let r = 0; r < this.rows; r += 1) {
      const row: number[] = [];
      for (let c = 0; c < this.cols; c += 1) row.push(0);
      this.grid.push(row);
    }

    const seedInt = Math.floor((this.spec.samplePlayProfile?.seed ?? 0) * 0x100000000) || 1;
    this.bag = new SevenBag(() => rnd(seedInt, Math.floor(Math.random() * 1e6)));
    this.nextKind = this.bag.next();
    this.spawnPiece();

    // 渲染对象
    this.boardGfx = this.add.graphics().setDepth(10);
    this.nextGfx = this.add.graphics().setDepth(10);

    const sideX = this.boardX + boardW + 24;
    this.nextLabel = this.add
      .text(sideX, this.boardY, this.uiLocale === "zh-Hans" ? "下一个" : "Next", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: this.cohesive.hud.body,
      })
      .setDepth(12);

    this.scoreText = this.add
      .text(sideX, this.boardY + 110, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: this.cohesive.hud.body,
      })
      .setDepth(12);

    this.linesText = this.add
      .text(sideX, this.boardY + 150, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: this.cohesive.hud.body,
      })
      .setDepth(12);

    this.speedText = this.add
      .text(sideX, this.boardY + 190, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: this.cohesive.hud.body,
      })
      .setDepth(12);

    // HUD 框架（顶部）
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, this.cohesive);
    this.hud.setBottomHint(
      this.uiLocale === "zh-Hans"
        ? "← → 移动 · ↑ 旋转 · ↓ 软降 · 空格 硬降 · P 暂停"
        : "← → Move · ↑ Rotate · ↓ Soft drop · Space Hard drop · P Pause",
    );

    // 输入
    const kb = this.input.keyboard!;
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyP = kb.addKey(Phaser.Input.Keyboard.KeyCodes.P);

    kb.on("keydown-LEFT", () => this.tryMove(-1));
    kb.on("keydown-RIGHT", () => this.tryMove(1));
    kb.on("keydown-UP", () => this.tryRotate());
    kb.on("keydown-SPACE", () => this.hardDrop());
    kb.on("keydown-P", () => this.togglePause());

    this.refreshSidePanel();
    this.refreshHud();

    // 触控按钮（移动设备 / 鼠标备用）
    this.buildTouchButtons(viewW, viewH);

    initQaState({ qaTouches: 0 });
    setPhaserQaState({ playerX: Math.round(this.boardX) });
    schedulePhaserPlayReady(this, 350, { playerX: Math.round(this.boardX) });

    showControlsHint(this, [
      this.uiLocale === "zh-Hans" ? "← → 移动  ↑ 旋转" : "← → Move  ↑ Rotate",
      this.uiLocale === "zh-Hans" ? "↓ 软降  空格 硬降" : "↓ Soft  Space Hard",
      this.uiLocale === "zh-Hans" ? `消行 ${this.targetLines} 通关` : `Clear ${this.targetLines} lines`,
    ]);
  }

  private buildTouchButtons(viewW: number, viewH: number) {
    const btns = [
      { label: "←", action: () => this.tryMove(-1) },
      { label: "→", action: () => this.tryMove(1) },
      { label: "↻", action: () => this.tryRotate() },
      { label: "⬇⬇", action: () => this.hardDrop() },
      { label: "⏸", action: () => this.togglePause() },
    ];
    const bw = 56, bh = 42, gap = 8;
    const total = btns.length * bw + (btns.length - 1) * gap;
    let bx = (viewW - total) / 2;
    const by = viewH - 28;
    for (const btn of btns) {
      const bg = this.add.rectangle(bx + bw / 2, by, bw - 2, bh - 2, 0x1e293b, 0.88)
        .setDepth(30).setScrollFactor(0).setInteractive({ useHandCursor: true });
      const txt = this.add.text(bx + bw / 2, by, btn.label, {
        fontFamily: "system-ui, sans-serif", fontSize: "17px", color: "#e2e8f0",
      }).setOrigin(0.5).setDepth(31).setScrollFactor(0);
      bg.on("pointerdown", () => { btn.action(); txt.setColor("#facc15"); });
      bg.on("pointerup", () => txt.setColor("#e2e8f0"));
      bg.on("pointerout", () => txt.setColor("#e2e8f0"));
      bg.on("pointerover", () => bg.setFillStyle(0x334155, 0.95));
      bg.on("pointerleave", () => bg.setFillStyle(0x1e293b, 0.88));
      bx += bw + gap;
    }
  }

  // ── 方块逻辑 ──────────────────────────────────────────────────────

  private pieceCells(p: ActivePiece): Array<{ r: number; c: number }> {
    const def = TETROMINOES[p.kind];
    const rot = def.rotations[p.rot]!;
    return rot.map((cell) => ({ r: p.row + cell.r, c: p.col + cell.c }));
  }

  private fits(p: ActivePiece): boolean {
    const cells = this.pieceCells(p);
    for (const { r, c } of cells) {
      if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
      if (this.grid[r]![c]! !== 0) return false;
    }
    return true;
  }

  private spawnPiece(): boolean {
    const kind = this.nextKind ?? this.bag.next();
    this.nextKind = this.bag.next();
    const def = TETROMINOES[kind];
    // I 在第 0 行 spawn；其他用第 0 行（行 0 上方留 0 行）
    const spawnCol = kind === "O" ? Math.floor(this.cols / 2) - 1 : Math.floor(this.cols / 2) - 2;
    const piece: ActivePiece = { kind, rot: 0, row: 0, col: Math.max(0, spawnCol) };
    if (!this.fits(piece)) {
      this.active = piece; // 视觉显示堆顶
      return false;
    }
    this.active = piece;
    // 立刻检查是否能再下落（spawn 直接顶死 = 失败由 update 推进判断）
    void def;
    return true;
  }

  private tryMove(dir: 1 | -1): boolean {
    if (this.finished || this.paused || !this.active) return false;
    const moved: ActivePiece = { ...this.active, col: this.active.col + dir };
    if (this.fits(moved)) {
      this.active = moved;
      return true;
    }
    return false;
  }

  /** 旋转：简单 wall-kick（尝试原位、左、右、上偏移） */
  private tryRotate(): boolean {
    if (this.finished || this.paused || !this.active) return false;
    if (this.active.kind === "O") return false; // O 不旋转
    const newRot = (this.active.rot + 1) % 4;
    const kicks = [
      { dr: 0, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
      { dr: 0, dc: -2 },
      { dr: 0, dc: 2 },
      { dr: -1, dc: 0 },
    ];
    for (const k of kicks) {
      const candidate: ActivePiece = {
        ...this.active,
        rot: newRot,
        row: this.active.row + k.dr,
        col: this.active.col + k.dc,
      };
      if (this.fits(candidate)) {
        this.active = candidate;
        playBleep("fire");
        return true;
      }
    }
    return false;
  }

  private softDrop(): boolean {
    if (this.finished || this.paused || !this.active) return false;
    const down: ActivePiece = { ...this.active, row: this.active.row + 1 };
    if (this.fits(down)) {
      this.active = down;
      this.score += 1; // 软降奖励 1 分
      return true;
    }
    // 落地
    this.lockPiece();
    return false;
  }

  private hardDrop(): void {
    if (this.finished || this.paused || !this.active) return;
    let dropped = 0;
    while (true) {
      const down: ActivePiece = { ...this.active!, row: this.active!.row + 1 };
      if (!this.fits(down)) break;
      this.active = down;
      dropped += 1;
    }
    this.score += dropped * 2; // 硬降奖励 2 分/格
    playBleep("fire");
    this.lockPiece();
  }

  private lockPiece(): void {
    if (!this.active) return;
    const def = TETROMINOES[this.active.kind];
    const cells = this.pieceCells(this.active);
    for (const { r, c } of cells) {
      if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
        this.grid[r]![c] = def.color;
      }
    }
    playBleep("hit");
    this.active = null;

    this.clearLines();

    // 失败检查：spawn 后立刻无法放置
    const ok = this.spawnPiece();
    if (!ok) {
      this.finish({ score: this.score, won: false });
      return;
    }
    // 失败兜底：新方块在顶部行有任何 cell 与已固定重叠也判负
    if (!this.fits(this.active!)) {
      this.finish({ score: this.score, won: false });
    }
  }

  private clearLines(): void {
    const cleared: number[] = [];
    for (let r = 0; r < this.rows; r += 1) {
      let full = true;
      for (let c = 0; c < this.cols; c += 1) {
        if (this.grid[r]![c]! === 0) {
          full = false;
          break;
        }
      }
      if (full) cleared.push(r);
    }
    if (cleared.length === 0) {
      this.refreshSidePanel();
      this.refreshHud();
      return;
    }

    // 从下往上移除
    for (const r of cleared) {
      this.grid.splice(r, 1);
      const empty: number[] = [];
      for (let c = 0; c < this.cols; c += 1) empty.push(0);
      this.grid.unshift(empty);
    }

    const n = cleared.length;
    // 计分：1=100 / 2=300 / 3=500 / 4=800
    const table = [0, 100, 300, 500, 800];
    this.score += table[n] ?? 800;
    this.lines += n;
    this.linesSinceSpeedup += n;

    // 每 10 行提速
    while (this.linesSinceSpeedup >= 10) {
      this.linesSinceSpeedup -= 10;
      this.speedMs = Math.max(120, this.speedMs - this.speedStepMs);
    }

    playBleep("pickup");
    juicePickup(this, {
      x: this.boardX + (this.cols * this.cellPx) / 2,
      y: this.boardY + (cleared[0]! + cleared.length / 2) * this.cellPx,
      colorHex: themeParticleHex(this.spec),
      text: n === 4 ? "Tetris!" : `+${table[n]}`,
      textColorCss: this.cohesive.hud.accent,
    });

    this.refreshSidePanel();
    this.refreshHud();

    if (this.lines >= this.targetLines) {
      this.finish({ score: this.score, won: true });
    }
  }

  // ── 渲染 ──────────────────────────────────────────────────────────

  private drawBoard(): void {
    const g = this.boardGfx;
    g.clear();

    // 网格背板
    const bw = this.cols * this.cellPx;
    const bh = this.rows * this.cellPx;
    g.fillStyle(0x0f172a, 0.55);
    g.fillRect(this.boardX - 4, this.boardY - 4, bw + 8, bh + 8);

    // 网格线
    g.lineStyle(1, 0x334155, 0.35);
    for (let c = 0; c <= this.cols; c += 1) {
      g.lineBetween(
        this.boardX + c * this.cellPx,
        this.boardY,
        this.boardX + c * this.cellPx,
        this.boardY + bh,
      );
    }
    for (let r = 0; r <= this.rows; r += 1) {
      g.lineBetween(
        this.boardX,
        this.boardY + r * this.cellPx,
        this.boardX + bw,
        this.boardY + r * this.cellPx,
      );
    }

    // 已固定格子
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        const col = this.grid[r]![c]!;
        if (col !== 0) this.drawCell(g, r, c, col, false);
      }
    }

    // 当前方块 + ghost（落点投影）
    if (this.active) {
      // ghost
      let ghostRow = this.active.row;
      while (true) {
        const down: ActivePiece = { ...this.active, row: ghostRow + 1 };
        if (!this.fits(down)) break;
        ghostRow += 1;
      }
      const ghostCells = this.pieceCells({ ...this.active, row: ghostRow });
      const activeCells = this.pieceCells(this.active);
      const activeSet = new Set(activeCells.map((p) => `${p.r},${p.c}`));
      for (const { r, c } of ghostCells) {
        if (activeSet.has(`${r},${c}`)) continue;
        this.drawCellGhost(g, r, c, TETROMINOES[this.active.kind].color);
      }
      // active
      for (const { r, c } of activeCells) {
        if (r < 0) continue;
        this.drawCell(g, r, c, TETROMINOES[this.active.kind].color, true);
      }
    }
  }

  private drawCell(g: Phaser.GameObjects.Graphics, r: number, c: number, color: number, active: boolean): void {
    const x = this.boardX + c * this.cellPx;
    const y = this.boardY + r * this.cellPx;
    const s = this.cellPx;
    const pad = 1;
    const bevel = Math.max(3, Math.floor(s * 0.16));
    const light = Math.min(0xffffff, color + 0x404040);
    const dark = (color & 0xfefefe) >> 1;
    const darker = (dark & 0xfefefe) >> 1;
    // 主体
    g.fillStyle(color, active ? 1 : 0.92);
    g.fillRoundedRect(x + pad, y + pad, s - pad * 2, s - pad * 2, 3);
    // 顶/左高光斜面
    g.fillStyle(light, 0.5);
    g.fillRect(x + pad + 2, y + pad + 2, s - pad * 2 - 4, bevel);
    g.fillRect(x + pad + 2, y + pad + 2, bevel, s - pad * 2 - 4);
    // 右/下暗边斜面
    g.fillStyle(dark, 0.6);
    g.fillRect(x + pad + 2, y + s - pad - bevel - 2, s - pad * 2 - 4, bevel);
    g.fillRect(x + s - pad - bevel - 2, y + pad + 2, bevel, s - pad * 2 - 4);
    // 内描边
    g.lineStyle(1, darker, 0.7);
    g.strokeRoundedRect(x + pad, y + pad, s - pad * 2, s - pad * 2, 3);
  }

  private drawCellGhost(g: Phaser.GameObjects.Graphics, r: number, c: number, color: number): void {
    const x = this.boardX + c * this.cellPx;
    const y = this.boardY + r * this.cellPx;
    const s = this.cellPx;
    g.lineStyle(1, color, 0.45);
    g.strokeRect(x + 2, y + 2, s - 4, s - 4);
  }

  private drawNext(): void {
    const g = this.nextGfx;
    g.clear();
    if (!this.nextKind) return;
    const def = TETROMINOES[this.nextKind];
    const cells = def.rotations[0]!;
    const sideX = this.boardX + this.cols * this.cellPx + 24;
    const startY = this.boardY + 24;
    const s = Math.max(14, Math.floor(this.cellPx * 0.85));
    // 居中 4x4 预览框
    const boxX = sideX;
    const boxY = startY;
    g.fillStyle(0x0f172a, 0.45);
    g.fillRect(boxX - 4, boxY - 4, s * 4 + 8, s * 4 + 8);
    for (const cell of cells) {
      const x = boxX + cell.c * s;
      const y = boxY + cell.r * s;
      g.fillStyle(def.color, 1);
      g.fillRect(x + 1, y + 1, s - 2, s - 2);
      g.fillStyle(0xffffff, 0.18);
      g.fillRect(x + 1, y + 1, s - 2, Math.max(2, Math.floor(s * 0.22)));
    }
  }

  private refreshSidePanel(): void {
    const zh = this.uiLocale === "zh-Hans";
    this.scoreText.setText(`${zh ? "分数" : "Score"}: ${this.score}`);
    this.linesText.setText(`${zh ? "消行" : "Lines"}: ${this.lines} / ${this.targetLines}`);
    this.speedText.setText(`${zh ? "速度" : "Speed"}: ${this.speedMs}ms`);
    this.drawNext();
  }

  private refreshHud(): void {
    this.hud.update({
      score: this.score,
      right: hudTetrisScore(this.uiLocale, this.score, this.lines, this.targetLines),
    });
  }

  // ── 暂停 ──
  private togglePause(): void {
    if (this.finished) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.pauseOverlay = this.add
        .rectangle(
          this.scale.width / 2,
          this.scale.height / 2,
          this.scale.width,
          this.scale.height,
          0x000000,
          0.55,
        )
        .setDepth(220)
        .setScrollFactor(0);
      const txt = this.add
        .text(
          this.scale.width / 2,
          this.scale.height / 2,
          this.uiLocale === "zh-Hans" ? "已暂停 · 按 P 继续" : "Paused · Press P",
          {
            fontFamily: "system-ui, sans-serif",
            fontSize: "22px",
            color: "#fde047",
          },
        )
        .setOrigin(0.5)
        .setDepth(221)
        .setScrollFactor(0);
      this.pauseOverlay.setData("label", txt);
    } else if (this.pauseOverlay) {
      const lbl = this.pauseOverlay.getData("label") as Phaser.GameObjects.Text | undefined;
      lbl?.destroy();
      this.pauseOverlay.destroy();
      this.pauseOverlay = null;
    }
  }

  private addStarfield(): void {
    const tint = hexToInt(this.spec.theme.particleTint ?? this.spec.theme.collectibleColor ?? "#38bdf8");
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

  private finish(payload: EndPayload): void {
    if (this.finished) return;
    this.finished = true;
    this.hud.update({ dangerLevel: 0 });
    const cx = this.boardX + (this.cols * this.cellPx) / 2;
    const cy = this.boardY + (this.rows * this.cellPx) / 2;
    this.hud.setBottomHint(
      payload.won
        ? `${bannerTetrisWin(this.uiLocale).message} · ${hudTetrisScore(this.uiLocale, this.score, this.lines, this.targetLines)}`
        : this.uiLocale === "zh-Hans"
          ? `失败 · 消行 ${this.lines} · 分数 ${this.score}`
          : `Fail · Lines ${this.lines} · Score ${this.score}`,
    );
    if (payload.won) {
      juiceWin(this, {
        x: cx,
        y: cy,
        colorHex: themeParticleHex(this.spec),
        text: bannerTetrisWin(this.uiLocale).title,
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
      this.soundscape?.triggerEvent("danger");
    }
    this.onEnd(payload);
  }

  // ── 主循环 ────────────────────────────────────────────────────────

  update(_time: number, deltaMs: number): void {
    this.hud.update({});
    if (this.finished || this.paused) {
      this.drawBoard();
      return;
    }

    // 左右长按重复（DAS 风格：首次立即，之后每 90ms 一次）
    const now = this.time.now;
    if (this.keyLeft.isDown) {
      if (this.leftRepeatAt === 0) this.leftRepeatAt = now + 170;
      if (now >= this.leftRepeatAt) {
        this.tryMove(-1);
        this.leftRepeatAt = now + 70;
      }
    } else {
      this.leftRepeatAt = 0;
    }
    if (this.keyRight.isDown) {
      if (this.rightRepeatAt === 0) this.rightRepeatAt = now + 170;
      if (now >= this.rightRepeatAt) {
        this.tryMove(1);
        this.rightRepeatAt = now + 70;
      }
    } else {
      this.rightRepeatAt = 0;
    }

    // 软降按住：每帧加快下落
    const softHeld = this.keyDown.isDown;
    if (softHeld !== this.softDropHeld) {
      this.softDropHeld = softHeld;
    }
    const stepMs = softHeld ? Math.min(60, this.speedMs) : this.speedMs;

    this.dropAccumMs += deltaMs;
    if (this.dropAccumMs >= stepMs) {
      this.dropAccumMs = 0;
      if (this.active) {
        const down: ActivePiece = { ...this.active, row: this.active.row + 1 };
        if (this.fits(down)) {
          this.active = down;
          if (softHeld) this.score += 1; // 软降按住奖励
        } else {
          this.lockPiece();
        }
      }
    }

    setPhaserQaState({ playerX: Math.round(this.boardX) });
    this.drawBoard();
    this.refreshSidePanel();
    this.refreshHud();
  }
}
