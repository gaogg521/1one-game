import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import { juiceBurst, juiceWin, juiceFail } from "@/game/engine/gameJuice";
import type { GameSpec } from "@/lib/game-spec";
import { buildRhythmBlueprint, type RhythmBlueprint } from "@/lib/rhythm-blueprint";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { runtimeSeedFromSpec } from "@/lib/runtime-seed";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { hudRhythmScore, hudRhythmProgress, bannerRhythmWin } from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

interface FallingNote {
  lane: number;
  y: number;
  spawnedAt: number;
  /** 是否已被命中 */
  hit: boolean;
  /** 是否已记为 miss */
  missed: boolean;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text | null;
}

/** 确定性伪随机 0..1 */
function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const LANE_KEYS = [
  Phaser.Input.Keyboard.KeyCodes.D,
  Phaser.Input.Keyboard.KeyCodes.F,
  Phaser.Input.Keyboard.KeyCodes.J,
  Phaser.Input.Keyboard.KeyCodes.K,
];
const LANE_KEY_LABELS = ["D", "F", "J", "K"];

export class RhythmScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private bp!: RhythmBlueprint;
  private intensity = 0.6;

  private hud!: HudFrame;

  private finished = false;

  // 视图
  private viewW = 0;
  private viewH = 0;
  /** 轨道区域左右边界 */
  private trackLeft = 0;
  private trackRight = 0;
  /** 单条轨道宽度 */
  private laneWidth = 0;
  /** 轨道数（固定 4：D/F/J/K） */
  private lanes = 4;
  /** 判定线 y 坐标 */
  private judgeY = 0;
  /** 节点顶部出生 y */
  private spawnY = 0;

  // 游戏状态
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private notesSpawned = 0;
  private notesHit = 0;
  private notesMissed = 0;
  private winScore = 0;
  /** 最多允许 miss 数 */
  private maxMiss = 0;

  // 节点
  private readonly notes: FallingNote[] = [];
  /** 下落速度（像素/秒） */
  private fallSpeed = 240;
  /** 节点生成间隔（毫秒） */
  private spawnIntervalMs = 600;
  private nextSpawnAt = 0;

  // 输入
  private laneKeys: Phaser.Input.Keyboard.Key[] = [];
  /** 轨道高亮按下时显示的判定线闪光 */
  private laneFlash: Phaser.GameObjects.Rectangle[] = [];

  // 命中反馈文本
  private readonly hitTexts: Phaser.GameObjects.Text[] = [];

  // 判定线
  private judgeLine!: Phaser.GameObjects.Rectangle;
  // 背景轨道
  private trackBg!: Phaser.GameObjects.Rectangle;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("RhythmScene");
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
    this.viewW = this.scale.width;
    this.viewH = this.scale.height;
    this.intensity = this.spec.director?.intensity ?? 0.6;

    // 推断蓝图
    this.bp = this.spec.rhythm ?? buildRhythmBlueprint({ spec: this.spec });

    // 轨道布局：固定 4 条轨道（D/F/J/K），居中
    const trackW = Math.min(560, this.viewW - 80);
    this.trackLeft = (this.viewW - trackW) / 2;
    this.trackRight = this.trackLeft + trackW;
    this.laneWidth = trackW / this.lanes;

    // 判定线在底部偏上
    this.judgeY = this.viewH - 120;
    this.spawnY = -40;

    // 下落速度：根据 bpm 与 speedMult 推断
    // 每 beat 一拍；轨道长度（judgeY - spawnY）应在 (60/bpm)*speedMult 秒内走完
    const beatSec = 60 / this.bp.bpm;
    const travel = Math.max(1, this.judgeY - this.spawnY);
    const speedMult = this.bp.speedMult ?? 1.0;
    this.fallSpeed = Math.max(180, travel / (beatSec * 2 * speedMult));

    // 节点生成间隔：每拍可能生成 0..lanes 个
    this.spawnIntervalMs = Math.max(200, beatSec * 1000);

    // 胜负阈值：达到 totalNotes 的命中分数目标 / miss 上限
    this.winScore = this.spec.gameplay.winScore ?? Math.round(this.bp.totalNotes * 0.6 * 100);
    this.maxMiss = Math.round(this.bp.totalNotes * 0.4);

    // 背景轨道
    this.trackBg = this.add
      .rectangle(
        (this.trackLeft + this.trackRight) / 2,
        this.viewH / 2,
        this.trackRight - this.trackLeft,
        this.viewH,
        0x0b1220,
        0.55,
      )
      .setDepth(-5);

    // 单条轨道分隔线 + 高亮条
    for (let i = 0; i < this.lanes; i += 1) {
      const lx = this.trackLeft + i * this.laneWidth;
      // 分隔线
      this.add
        .rectangle(lx + this.laneWidth / 2, this.viewH / 2, 2, this.viewH, 0xffffff, 0.08)
        .setDepth(-4);
      // 按键提示
      const keyLabel = LANE_KEY_LABELS[i] ?? String(i + 1);
      this.add
        .text(lx + this.laneWidth / 2, this.judgeY + 40, keyLabel, {
          fontFamily: "monospace",
          fontSize: "20px",
          color: "#cbd5e1",
        })
        .setOrigin(0.5)
        .setDepth(5);
      // 按下闪光（初始不可见）
      const flash = this.add
        .rectangle(lx + this.laneWidth / 2, this.judgeY, this.laneWidth - 4, 60, 0xffffff, 0)
        .setDepth(3);
      this.laneFlash.push(flash);
    }

    // 判定线
    this.judgeLine = this.add
      .rectangle(
        (this.trackLeft + this.trackRight) / 2,
        this.judgeY,
        this.trackRight - this.trackLeft,
        4,
        0xfde047,
        0.9,
      )
      .setDepth(4);

    // 输入
    const kb = this.input.keyboard!;
    for (let i = 0; i < this.lanes; i += 1) {
      this.laneKeys.push(kb.addKey(LANE_KEYS[i]!));
    }

    // 触控点击区：整条轨道可点击，判定同键盘
    for (let i = 0; i < this.lanes; i += 1) {
      const lx = this.trackLeft + i * this.laneWidth;
      const touchZone = this.add
        .rectangle(lx + this.laneWidth / 2, this.viewH / 2, this.laneWidth - 2, this.viewH, 0xffffff, 0)
        .setDepth(6)
        .setInteractive({ useHandCursor: false });
      const idx = i;
      touchZone.on("pointerdown", () => this.handleLanePress(idx));
    }

    // HUD
    const ui = buildSceneCohesion(this.spec);
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, ui);
    this.hud.setBottomHint(
      this.uiLocale === "zh-Hans"
        ? "D / F / J / K 命中下落节点 · Perfect +100 / Good +50"
        : "D / F / J / K to hit falling notes · Perfect +100 / Good +50",
    );

    this.refreshHud();
    this.nextSpawnAt = this.time.now + 600;

    schedulePhaserPlayReady(this, 350, {});
  }

  update() {
    this.hud.update({});
    if (this.finished) return;

    // 按键检测（每帧 JustDown 轮询）
    for (let i = 0; i < this.laneKeys.length; i += 1) {
      const key = this.laneKeys[i]!;
      if (Phaser.Input.Keyboard.JustDown(key)) {
        this.handleLanePress(i);
      }
    }

    // 生成节点
    this.trySpawnNotes();

    // 移动节点 + 检测 miss
    const dt = this.game.loop.delta / 1000;
    const hitWindow = this.bp.hitWindowMs;
    for (let i = this.notes.length - 1; i >= 0; i -= 1) {
      const n = this.notes[i]!;
      if (n.hit || n.missed) continue;
      n.y += this.fallSpeed * dt;
      n.rect.setY(n.y);
      if (n.label) n.label.setY(n.y);
      // 超过判定线下方一个 hitWindow → miss
      const travelPastMs = ((n.y - this.judgeY) / this.fallSpeed) * 1000;
      if (travelPastMs > hitWindow) {
        n.missed = true;
        this.notesMissed += 1;
        this.combo = 0;
        this.showHitFeedback("Miss", n.lane, "#ef4444");
        n.rect.setAlpha(0.18);
        this.refreshHud();
        if (this.notesMissed >= this.maxMiss) {
          this.finish({ score: this.score, won: false });
          return;
        }
      }
    }

    // 清理已处理节点（飞出屏幕）
    for (let i = this.notes.length - 1; i >= 0; i -= 1) {
      const n = this.notes[i]!;
      if (n.y > this.viewH + 60 || (n.hit && this.time.now > n.spawnedAt + 200)) {
        n.rect.destroy();
        if (n.label) n.label.destroy();
        this.notes.splice(i, 1);
      }
    }

    // 全部生成且场上无节点 → 收尾
    if (this.notesSpawned >= this.bp.totalNotes && this.notes.length === 0) {
      const won = this.score >= this.winScore;
      this.finish({ score: this.score, won });
    }
  }

  private trySpawnNotes() {
    const now = this.time.now;
    if (now < this.nextSpawnAt) return;
    if (this.notesSpawned >= this.bp.totalNotes) return;

    // 按 patternDensity 决定本拍是否生成；生成时随机选 1 条轨道
    if (rnd(runtimeSeedFromSpec(this.spec), this.notesSpawned) > this.bp.patternDensity) {
      this.nextSpawnAt = now + this.spawnIntervalMs;
      return;
    }

    const lane = Math.floor(rnd(runtimeSeedFromSpec(this.spec), this.notesSpawned * 7 + 3) * this.lanes);
    this.spawnNote(lane);
    this.notesSpawned += 1;
    this.nextSpawnAt = now + this.spawnIntervalMs;
  }

  private spawnNote(lane: number) {
    const lx = this.trackLeft + lane * this.laneWidth + this.laneWidth / 2;
    const color = this.laneColor(lane);
    const rect = this.add
      .rectangle(lx, this.spawnY, this.laneWidth - 12, 28, color, 0.95)
      .setDepth(2)
      .setStrokeStyle(2, 0xffffff, 0.4);
    const label = this.add
      .text(lx, this.spawnY, LANE_KEY_LABELS[lane] ?? "?", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#0b1220",
      })
      .setOrigin(0.5)
      .setDepth(3);
    this.notes.push({
      lane,
      y: this.spawnY,
      spawnedAt: this.time.now,
      hit: false,
      missed: false,
      rect,
      label,
    });
  }

  private laneColor(lane: number): number {
    const palette = [0x38bdf8, 0x4ade80, 0xfbbf24, 0xf472b6, 0xa78bfa, 0xf87171];
    return palette[lane % palette.length]!;
  }

  /** 玩家按键：监听在 create() 之后由 update 内手动 JustDown 检测 */
  private handleLanePress(lane: number) {
    if (this.finished) return;
    // 闪光
    const flash = this.laneFlash[lane];
    if (flash) {
      flash.setAlpha(0.45);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 180,
        ease: "Quad.Out",
      });
    }
    // 寻找该轨道最接近判定线且未处理的节点
    let best: FallingNote | null = null;
    let bestDelta = Infinity;
    for (const n of this.notes) {
      if (n.hit || n.missed) continue;
      if (n.lane !== lane) continue;
      const deltaMs = Math.abs(((n.y - this.judgeY) / this.fallSpeed) * 1000);
      if (deltaMs < bestDelta) {
        bestDelta = deltaMs;
        best = n;
      }
    }
    if (!best || bestDelta > this.bp.hitWindowMs) {
      // 空按：不扣分，但断连击
      this.combo = 0;
      this.refreshHud();
      return;
    }
    // 判定等级
    let grade: "Perfect" | "Good";
    let gain: number;
    if (bestDelta < this.bp.hitWindowMs * 0.4) {
      grade = "Perfect";
      gain = 100;
    } else {
      grade = "Good";
      gain = 50;
    }
    best.hit = true;
    this.notesHit += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    // 连击奖励：每 10 连击 +20
    const comboBonus = Math.floor(this.combo / 10) * 20;
    this.score += gain + comboBonus;
    this.showHitFeedback(grade, lane, grade === "Perfect" ? "#fde047" : "#4ade80");
    // 命中爆散
    const lx = this.trackLeft + lane * this.laneWidth + this.laneWidth / 2;
    juiceBurst(this, lx, this.judgeY, this.spec.theme.collectibleColor ?? "#38bdf8", 8);
    playBleep("pickup");
    this.refreshHud();
    if (this.score >= this.winScore) {
      this.finish({ score: this.score, won: true });
    }
  }

  private showHitFeedback(text: string, lane: number, colorCss: string) {
    const lx = this.trackLeft + lane * this.laneWidth + this.laneWidth / 2;
    const t = this.add
      .text(lx, this.judgeY - 30, text, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: colorCss,
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.tweens.add({
      targets: t,
      y: t.y - 30,
      alpha: 0,
      duration: 500,
      ease: "Quad.Out",
      onComplete: () => t.destroy(),
    });
    this.hitTexts.push(t);
  }

  private refreshHud() {
    this.hud.update({
      score: this.score,
      lives: Math.max(0, this.maxMiss - this.notesMissed),
      right: hudRhythmProgress(this.uiLocale, this.notesHit, this.bp.totalNotes, this.notesMissed),
      actLabel: hudRhythmScore(this.uiLocale, this.score, this.combo),
    });
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    this.finished = true;
    this.hud.setBottomHint(
      payload.won
        ? bannerRhythmWin(this.uiLocale).message
        : this.uiLocale === "zh-Hans"
          ? "失败 · 再试一次"
          : "Failed · Try again",
    );
    if (payload.won) {
      juiceWin(this, {
        x: this.viewW / 2,
        y: this.viewH / 2,
        colorHex: this.spec.theme.collectibleColor ?? "#fde047",
        text: bannerRhythmWin(this.uiLocale).title,
        textColorCss: "#fde047",
      });
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    } else {
      juiceFail(this, {
        x: this.viewW / 2,
        y: this.viewH / 2,
        colorHex: this.spec.theme.hazardColor,
        text: this.uiLocale === "zh-Hans" ? "失败" : "Fail",
        textColorCss: "#ef4444",
      });
    }
    this.onEnd(payload);
  }
}
