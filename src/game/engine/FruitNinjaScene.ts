import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import { juiceFail, juiceHit, juicePickup, juiceWin, themeParticleHex } from "@/game/engine/gameJuice";
import type { GameSpec } from "@/lib/game-spec";
import { buildFruitNinjaBlueprint, type FruitNinjaBlueprint } from "@/lib/fruit-ninja-blueprint";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import type { CohesivePresentation } from "@/lib/cohesive-presentation";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { hudFruitNinjaScore, bannerFruitNinjaWin } from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

type FruitKind = "fruit" | "bomb";

interface FruitDef {
  emoji: string;
  color: number;
}

const FRUIT_DEFS: FruitDef[] = [
  { emoji: "🍉", color: 0x22c55e }, // watermelon
  { emoji: "🍊", color: 0xf97316 }, // orange
  { emoji: "🍎", color: 0xef4444 }, // apple
  { emoji: "🍇", color: 0x8b5cf6 }, // grape
  { emoji: "🍓", color: 0xec4899 }, // strawberry
  { emoji: "🥝", color: 0x84cc16 }, // kiwi
  { emoji: "🍌", color: 0xfacc15 }, // banana
  { emoji: "🍑", color: 0xfb7185 }, // peach
];

const BOMB_EMOJI = "💣";

interface FruitEntry {
  spr: Phaser.GameObjects.Text;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  radius: number;
  kind: FruitKind;
  color: number;
  sliced: boolean;
  /** 切割冷却：防止同一次划线反复触发 */
  sliceCooldownUntil: number;
}

interface SliceHalf {
  spr: Phaser.GameObjects.Text;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  life: number;
  color: number;
}

interface SplashBit {
  spr: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  life: number;
  color: number;
}

/**
 * 真水果忍者：划屏切水果玩法。
 * - 水果/炸弹从屏幕底部抛物线抛出，旋转飞行，落出底部消失
 * - 鼠标拖拽划线，轨迹经过水果→切成两半 + 飞溅粒子
 * - 切 1 水果 +10；连续切（combo）触发加成
 * - 切到炸弹→扣 1 命 + 屏震 + 红屏闪
 * - 达到 targetScore 通关；时间到 / 命 0 失败
 */
export class FruitNinjaScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private blueprint!: FruitNinjaBlueprint;
  private cohesive!: CohesivePresentation;
  private hud!: HudFrame;

  private fruits: FruitEntry[] = [];
  private halves: SliceHalf[] = [];
  private splashes: SplashBit[] = [];

  private trailGfx!: Phaser.GameObjects.Graphics;
  private trail: Array<{ x: number; y: number; t: number }> = [];

  private score = 0;
  private lives = 3;
  private maxLives = 3;
  private finished = false;

  private timeLimitMs = 75000;
  private startTime = 0;
  private timeLeftMs = 0;

  private nextSpawnAt = 0;
  private spawnIntervalMs = 1000;
  private bombChance = 0.2;
  private targetScore = 75;

  /** combo：在 comboWindowMs 内连续切水果累计；超时归零 */
  private comboCount = 0;
  private comboWindowMs = 700;
  private comboExpireAt = 0;

  private hurtFlashUntil = 0;
  private redFlashGfx!: Phaser.GameObjects.Graphics;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("FruitNinjaScene");
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

    this.blueprint = buildFruitNinjaBlueprint({ spec: this.spec });
    this.targetScore = this.blueprint.targetScore;
    this.timeLimitMs = this.blueprint.timeLimitMs;
    this.spawnIntervalMs = this.blueprint.spawnIntervalMs;
    this.bombChance = this.blueprint.bombChance;
    this.maxLives = this.spec.gameplay.lives ?? 3;
    this.lives = this.maxLives;
    this.startTime = this.time.now;
    this.timeLeftMs = this.timeLimitMs;

    this.cohesive = buildSceneCohesion(this.spec);

    // 背景层
    this.drawBackdrop(viewW, viewH);
    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      this.add
        .image(viewW / 2, viewH / 2, "bgTex")
        .setDepth(-10)
        .setAlpha(0.5);
    }

    this.trailGfx = this.add.graphics().setDepth(60);
    this.redFlashGfx = this.add.graphics().setDepth(199).setScrollFactor(0);

    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, this.cohesive);

    // 输入：记录指针轨迹（鼠标 / 触摸都走 activePointer）
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (this.finished) return;
      if (!ptr.isDown) return;
      this.pushTrail(ptr.x, ptr.y);
      this.checkSlice(ptr.x, ptr.y);
    });
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (this.finished) return;
      this.pushTrail(ptr.x, ptr.y);
    });

    this.nextSpawnAt = this.time.now + 400;

    this.refreshHud();

    schedulePhaserPlayReady(this, 350, {});

    this.hud.flashBanner({
      title: this.uiLocale === "zh-Hans" ? "划屏切水果！" : "Slice the fruit!",
      message: this.uiLocale === "zh-Hans"
        ? `目标 ${this.targetScore} 分 · 避开炸弹`
        : `Target ${this.targetScore} · Avoid bombs`,
      ms: 1800,
    });
  }

  private drawBackdrop(viewW: number, viewH: number) {
    const bg = parseInt((this.spec.theme.backgroundColor ?? "#0f172a").replace("#", ""), 16);
    this.add.rectangle(viewW / 2, viewH / 2, viewW, viewH, bg, 1).setDepth(-20);
    // 远景柔光圆斑
    const tint = parseInt(
      (this.spec.theme.particleTint ?? this.spec.theme.collectibleColor ?? "#38bdf8").replace("#", ""),
      16,
    );
    for (let i = 0; i < 6; i += 1) {
      const x = Phaser.Math.Between(40, viewW - 40);
      const y = Phaser.Math.Between(40, viewH - 40);
      const r = Phaser.Math.Between(80, 180);
      this.add.circle(x, y, r, tint, 0.04).setDepth(-15);
    }
  }

  private pushTrail(x: number, y: number) {
    this.trail.push({ x, y, t: this.time.now });
    // 保留 ~220ms 轨迹
    const cutoff = this.time.now - 220;
    while (this.trail.length > 0 && this.trail[0]!.t < cutoff) this.trail.shift();
    if (this.trail.length > 40) this.trail.shift();
  }

  /** 划线轨迹经过水果→切片。基于最近一段线段与水果圆心距离判定。 */
  private checkSlice(currentX: number, currentY: number) {
    if (this.trail.length < 2) return;
    const prev = this.trail[this.trail.length - 2]!;
    const x1 = prev.x;
    const y1 = prev.y;
    const x2 = currentX;
    const y2 = currentY;
    const segLen = Math.hypot(x2 - x1, y2 - y1);
    // 划动太慢不视为有效切割（避免悬停误判）
    if (segLen < 6) return;

    for (const f of this.fruits) {
      if (!f.spr.active || f.sliced) continue;
      if (this.time.now < f.sliceCooldownUntil) continue;
      // 点到线段距离
      const d = pointToSegmentDist(f.spr.x, f.spr.y, x1, y1, x2, y2);
      if (d <= f.radius + 6) {
        this.sliceFruit(f, x2, y2);
        f.sliceCooldownUntil = this.time.now + 400;
      }
    }
  }

  private sliceFruit(f: FruitEntry, sliceX: number, sliceY: number) {
    f.sliced = true;
    if (f.kind === "bomb") {
      this.onBombSlice(f);
      return;
    }
    // 切成两半
    const dirAngle = Math.atan2(sliceY - f.spr.y, sliceX - f.spr.x) + Math.PI / 2;
    const splitSpeed = 180;
    this.spawnHalf(f, dirAngle, splitSpeed);
    this.spawnHalf(f, dirAngle + Math.PI, splitSpeed);
    // 飞溅粒子
    this.spawnSplash(f.spr.x, f.spr.y, f.color, 12);
    // 隐藏原始水果
    f.spr.setActive(false).setVisible(false);

    // 计分 + combo
    const now = this.time.now;
    if (now > this.comboExpireAt) {
      this.comboCount = 0;
    }
    this.comboCount += 1;
    this.comboExpireAt = now + this.comboWindowMs;
    const baseGain = 10;
    const comboBonus = this.comboCount >= 3 ? (this.comboCount - 2) * 5 : 0;
    const gain = baseGain + comboBonus;
    this.score += gain;

    juicePickup(this, {
      x: f.spr.x,
      y: f.spr.y,
      colorHex: themeParticleHex(this.spec),
      text: comboBonus > 0 ? `+${gain} x${this.comboCount}` : `+${gain}`,
      textColorCss: this.cohesive.hud.accent,
    });
    playBleep("pickup");
    if (this.comboCount >= 3) {
      this.soundscape?.triggerKillStinger();
    }

    this.refreshHud();
    if (this.score >= this.targetScore) {
      this.finish({ score: this.score, won: true });
    }
  }

  private onBombSlice(f: FruitEntry) {
    f.spr.setActive(false).setVisible(false);
    this.spawnSplash(f.spr.x, f.spr.y, 0xef4444, 18);
    juiceHit(this, {
      x: f.spr.x,
      y: f.spr.y,
      colorHex: this.spec.theme.hazardColor,
      large: true,
    });
    playBleep("hit");
    this.cameras.main.shake(280, 0.012);
    this.hurtFlashUntil = this.time.now + 320;
    this.lives -= 1;
    this.comboCount = 0;
    this.refreshHud();
    if (this.lives <= 0) {
      this.finish({ score: this.score, won: false });
      return;
    }
    this.soundscape?.setTension(1 - (this.lives - 1) / Math.max(1, this.maxLives - 1));
    if (this.lives === 1) {
      this.soundscape?.triggerEvent("danger");
      this.hud.update({ dangerLevel: 1 });
    }
  }

  private spawnHalf(f: FruitEntry, dirAngle: number, speed: number) {
    // 半片：用同款 emoji 但加斜向裂痕感（scale 0.7 + 偏移 + 旋转）
    const half = this.add.text(f.spr.x, f.spr.y, f.spr.text, {
      fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
      fontSize: `${Math.round(f.radius * 1.4)}px`,
    }).setOrigin(0.5).setScale(0.7).setDepth(20);
    half.setStroke("#000000", 1);
    const vx = Math.cos(dirAngle) * speed + f.vx * 0.4;
    const vy = Math.sin(dirAngle) * speed + f.vy * 0.4;
    this.halves.push({
      spr: half,
      vx,
      vy,
      rot: f.rot,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      life: 1400,
      color: f.color,
    });
  }

  private spawnSplash(x: number, y: number, color: number, count: number) {
    for (let i = 0; i < count; i += 1) {
      const bit = this.add.circle(x, y, Phaser.Math.Between(2, 5), color, 0.9).setDepth(25);
      const ang = Math.random() * Math.PI * 2;
      const sp = Phaser.Math.Between(80, 260);
      this.splashes.push({
        spr: bit,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 60,
        life: 600,
        color,
      });
    }
  }

  private spawnFruitOrBomb() {
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const isBomb = Math.random() < this.bombChance;
    const radius = isBomb ? 26 : Phaser.Math.Between(22, 34);
    const def = isBomb ? null : FRUIT_DEFS[Phaser.Math.Between(0, FRUIT_DEFS.length - 1)]!;
    const color = isBomb ? 0x1f2937 : def!.color;
    const emoji = isBomb ? BOMB_EMOJI : def!.emoji;

    const x = Phaser.Math.Between(80, viewW - 80);
    const y = viewH + radius + 10;
    const spr = this.add.text(x, y, emoji, {
      fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
      fontSize: `${Math.round(radius * 1.8)}px`,
    }).setOrigin(0.5).setDepth(20);
    if (isBomb) {
      spr.setTint(0xff6666);
    }

    // 抛物线：向上初速度 + 横向偏向中心，重力在 update 里施加
    const targetPeakY = Phaser.Math.Between(80, viewH * 0.35);
    // vy 由"上升到 peakY 所需初速度"反推：v^2 = 2*g*(y0-peakY)
    const g = 900;
    const rise = y - targetPeakY;
    const vy = -Math.sqrt(Math.max(40, 2 * g * rise));
    // 横向：朝屏幕中心偏移，避免水果飞出两侧
    const towardCenter = (viewW / 2 - x) * 0.0025;
    const vx = Phaser.Math.Between(-60, 60) + towardCenter * 60;

    this.fruits.push({
      spr,
      vx,
      vy,
      rot: 0,
      rotSpeed: (Math.random() - 0.5) * 0.18,
      radius,
      kind: isBomb ? "bomb" : "fruit",
      color,
      sliced: false,
      sliceCooldownUntil: 0,
    });

    if (isBomb) {
      // 炸弹引线小火星：脉动
      this.tweens.add({
        targets: spr,
        scale: { from: 1, to: 1.12 },
        duration: 220,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private refreshHud() {
    const hudText = hudFruitNinjaScore(
      this.uiLocale,
      this.score,
      this.targetScore,
      this.lives,
      Math.ceil(this.timeLeftMs / 1000),
    );
    this.hud.update({
      score: this.score,
      lives: this.lives,
      right: hudText,
      actLabel: hudText,
      skill: this.uiLocale === "zh-Hans" ? "鼠标拖拽切水果" : "Drag to slice",
    });
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    this.finished = true;
    this.hud.update({ dangerLevel: 0 });
    this.hud.setBottomHint(this.uiLocale === "zh-Hans"
      ? (payload.won ? "通关！" : "挑战结束")
      : (payload.won ? "Cleared!" : "Game over"));
    if (payload.won) {
      const winBanner = bannerFruitNinjaWin(this.uiLocale);
      this.cameras.main.shake(300, 0.008);
      juiceWin(this, {
        x: this.scale.width / 2,
        y: this.scale.height / 2,
        colorHex: themeParticleHex(this.spec),
        text: winBanner.title,
        textColorCss: this.cohesive.hud.accent,
      });
      this.hud.flashBanner({
        title: winBanner.title,
        message: winBanner.message,
        ms: 1800,
      });
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    } else {
      juiceFail(this, {
        x: this.scale.width / 2,
        y: this.scale.height / 2,
        colorHex: this.spec.theme.hazardColor,
        text: this.uiLocale === "zh-Hans" ? "失败" : "Fail",
        textColorCss: this.cohesive.hud.danger,
      });
    }
    this.onEnd(payload);
  }

  update(_time: number, deltaMs: number) {
    if (this.finished) return;
    const dt = deltaMs / 1000;
    const now = this.time.now;
    const viewW = this.scale.width;
    const viewH = this.scale.height;

    // 时间倒计时
    this.timeLeftMs = Math.max(0, this.timeLimitMs - (now - this.startTime));
    // 每秒刷新一次 HUD 的时间字段（避免每帧 set text）
    if (Math.floor((now - this.startTime) / 1000) !== Math.floor((now - this.startTime - deltaMs) / 1000)) {
      this.refreshHud();
    }
    if (this.timeLeftMs <= 0) {
      this.finish({ score: this.score, won: this.score >= this.targetScore });
      return;
    }

    // combo 超时归零
    if (this.comboCount > 0 && now > this.comboExpireAt) {
      this.comboCount = 0;
    }

    // 抛出
    if (now >= this.nextSpawnAt) {
      // 后期稍微加速抛出（避免枯燥）
      const progress = 1 - this.timeLeftMs / this.timeLimitMs;
      const accel = 1 - progress * 0.25;
      this.spawnFruitOrBomb();
      this.nextSpawnAt = now + this.spawnIntervalMs * accel;
    }

    // 水果物理
    const g = 900;
    for (const f of this.fruits) {
      if (!f.spr.active) continue;
      f.vy += g * dt;
      f.spr.x += f.vx * dt;
      f.spr.y += f.vy * dt;
      f.rot += f.rotSpeed;
      // 圆形本身旋转无视觉差异，用小幅 scale 抖动模拟旋转感
      f.spr.setRotation(f.rot);
      // 落出底部→销毁（炸弹未切到也算"漏掉"，不扣命）
      if (f.spr.y > viewH + f.radius + 40 || f.spr.x < -60 || f.spr.x > viewW + 60) {
        f.spr.setActive(false).setVisible(false);
      }
    }
    // 清理失效水果
    this.fruits = this.fruits.filter((f) => f.spr.active);
    for (const f of this.fruits) {
      if (f.sliced && f.spr.active) f.spr.setActive(false).setVisible(false);
    }

    // 半片物理
    for (const h of this.halves) {
      if (!h.spr.active) continue;
      h.vy += g * dt;
      h.spr.x += h.vx * dt;
      h.spr.y += h.vy * dt;
      h.rot += h.rotSpeed;
      h.spr.setRotation(h.rot);
      h.life -= deltaMs;
      if (h.life <= 0 || h.spr.y > viewH + 60) {
        h.spr.setActive(false).setVisible(false);
      }
    }
    this.halves = this.halves.filter((h) => h.spr.active);

    // 飞溅粒子物理
    for (const s of this.splashes) {
      if (!s.spr.active) continue;
      s.vy += g * 0.6 * dt;
      s.spr.x += s.vx * dt;
      s.spr.y += s.vy * dt;
      s.life -= deltaMs;
      s.spr.setAlpha(Math.max(0, s.life / 600));
      if (s.life <= 0) {
        s.spr.setActive(false).setVisible(false);
      }
    }
    this.splashes = this.splashes.filter((s) => s.spr.active);

    // 鼠标轨迹渲染（渐变线：越新越亮）
    this.trailGfx.clear();
    if (this.trail.length >= 2) {
      for (let i = 0; i < this.trail.length - 1; i += 1) {
        const a = this.trail[i]!;
        const b = this.trail[i + 1]!;
        const ageRatio = (now - a.t) / 220;
        const alpha = Math.max(0, 1 - ageRatio) * 0.85;
        const width = 2 + (i / this.trail.length) * 8;
        this.trailGfx.lineStyle(width, 0xffffff, alpha);
        this.trailGfx.lineBetween(a.x, a.y, b.x, b.y);
      }
      // 刀光头部高亮
      const head = this.trail[this.trail.length - 1]!;
      this.trailGfx.fillStyle(0xffffff, 0.9);
      this.trailGfx.fillCircle(head.x, head.y, 5);
    }
    // 若指针已抬起，逐渐缩短轨迹
    if (!this.input.activePointer.isDown && this.trail.length > 0) {
      const cutoff = now - 120;
      while (this.trail.length > 0 && this.trail[0]!.t < cutoff) this.trail.shift();
    }

    // 红屏闪（炸弹受伤）
    this.redFlashGfx.clear();
    if (now < this.hurtFlashUntil) {
      const t = (this.hurtFlashUntil - now) / 320;
      this.redFlashGfx.fillStyle(0xff0000, 0.32 * t);
      this.redFlashGfx.fillRect(0, 0, viewW, viewH);
    }
  }
}

/** 点到线段距离（用于切割命中判定） */
function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

