import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import {
  juiceBurst,
  juiceFail,
  juicePickup,
  juiceWin,
  themeParticleHex,
} from "@/game/engine/gameJuice";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { hexToPhaserUint, type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { buildSportsBlueprint, type SportKind, type SportsBlueprint } from "@/lib/sports-blueprint";
import type { GameSpec } from "@/lib/game-spec";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { hudSportsScore, bannerSportsWin } from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

/**
 * 体育运动 Scene（最简可玩 · 投篮/射门抛物线模型）：
 * - 玩家是地面上的发射器，左右移动对准目标
 * - 按住空格蓄力（蓄力越久初速越大），松开抛出球
 * - 球做抛物线运动（Phaser.Arcade.Physics 重力）
 * - 球进入篮筐/球门区域 → 加分
 * - 限时倒计时；达 targetScore 通关 / 时间到失败
 * - HUD 显示分数 / 时间 / 进度（HudFrame）
 *
 * 不同 sport 共用同一抛物线逻辑，仅视觉色调/目标位置略不同。
 */
export class SportsScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private bp: SportsBlueprint = buildSportsBlueprint({});
  private sport: SportKind = "basketball";
  private cohesive!: CohesivePresentation;

  private hud!: HudFrame;

  private player!: Phaser.GameObjects.Container;
  private playerBody!: Phaser.GameObjects.Text;
  private ballGroup!: Phaser.Physics.Arcade.Group;
  private goal!: Phaser.GameObjects.Container;
  /** 目标命中半径（手动距离判定用） */
  private goalRadius = 42;

  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  // 触控方向标志
  private touchLeft = false;
  private touchRight = false;

  private score = 0;
  private lives = 3;
  private targetScore = 15;
  private timeLimitMs = 75000;
  private startAt = 0;
  private finished = false;
  private charging = false;
  private chargeStart = 0;
  /** 蓄力进度条 */
  private chargeBar!: Phaser.GameObjects.Graphics;

  private readonly maxChargeMs = 1200;
  private readonly minPower = 320;
  private readonly maxPower = 720;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super({ key: "SportsScene" });
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

    this.bp = this.spec.sports ?? buildSportsBlueprint({ spec: this.spec });
    this.sport = this.bp.sport;
    this.targetScore = this.bp.targetScore;
    this.timeLimitMs = this.bp.timeLimitMs;
    this.lives = this.spec.gameplay.lives ?? 3;

    const gravity = (this.bp.gravity ?? 9.8) * 100; // 转 px/s² 量级（9.8 → 980）
    this.physics.world.gravity.y = gravity;

    this.cohesive = buildSceneCohesion(this.spec);

    // 颜色：从 spec.theme（hex 字符串）转 Phaser 整数色
    const playerHex = this.spec.theme.collectibleColor ?? this.spec.theme.playerColor;
    const playerColorNum = hexToPhaserUint(playerHex) ?? 0xfbbf24;
    const goalHex = this.spec.theme.playerColor;
    const goalColorNum = hexToPhaserUint(goalHex) ?? 0x38bdf8;
    const bgNum = this.cohesive.platformGround;
    const panelNum = this.cohesive.panelFill;

    // ── 背景 ──
    this.add
      .rectangle(viewW / 2, viewH / 2, viewW, viewH, bgNum, 1)
      .setDepth(-20);
    // 远景网格地平线
    const gridGfx = this.add.graphics().setDepth(-15);
    gridGfx.lineStyle(1, panelNum, 0.25);
    for (let gx = 0; gx <= viewW; gx += 64) gridGfx.lineBetween(gx, viewH - 120, gx, viewH);
    gridGfx.lineBetween(0, viewH - 120, viewW, viewH - 120);
    // 远处山丘剪影
    gridGfx.fillStyle(panelNum, 0.35);
    for (let hx = 0; hx < viewW; hx += 220) {
      gridGfx.fillEllipse(hx + 110, viewH - 120, 260, 90);
    }

    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      this.add.image(viewW / 2, viewH / 2, "bgTex").setDepth(-10).setAlpha(0.5);
    }

    // ── 玩家（运动员）──
    this.playerBody = this.add.text(0, 0, "🏃", {
      fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
      fontSize: "40px",
    }).setOrigin(0.5).setTint(playerColorNum);
    this.add.existing(this.playerBody);
    const arm = this.add.rectangle(0, -22, 6, 22, playerColorNum, 1).setOrigin(0.5, 1);
    this.add.existing(arm);
    this.player = this.add.container(viewW / 2, viewH - 80, [this.playerBody, arm]);
    this.player.setDepth(20);

    // ── 目标（篮筐/球门）──
    this.buildGoal(viewW, viewH, goalColorNum);

    // ── 球组 ──
    this.ballGroup = this.physics.add.group();

    // 命中检测：在 update() 中手动做球↔目标距离判定（目标会移动，
    // 用 StaticBody overlap 不稳，改为每帧 distance check）

    // ── 球纹理（一次性生成）──
    const ballTexKey = "texSportsBall";
    if (!this.textures.exists(ballTexKey)) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(playerColorNum, 1);
      g.fillCircle(10, 10, 10);
      g.lineStyle(2, 0x000000, 0.25);
      g.strokeCircle(10, 10, 10);
      g.generateTexture(ballTexKey, 20, 20);
      g.destroy();
    }

    // ── 输入 ──
    const kb = this.input.keyboard!;
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    kb.on("keydown-SPACE", this.startCharge, this);
    kb.on("keyup-SPACE", this.releaseCharge, this);

    // 蓄力进度条
    this.chargeBar = this.add.graphics().setDepth(120).setScrollFactor(0);

    // ── HUD ──
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, this.cohesive);
    const controlHint = this.uiLocale === "zh-Hans"
      ? "← → / A D 移动 · 空格蓄力投篮 · 进框得分 · 时间到 / 达目标结束"
      : "Move ← →/A D · Hold Space to charge · Release to shoot";
    this.hud.setBottomHint(controlHint);

    this.startAt = this.time.now;
    this.refreshHud();
    this.buildTouchControls(viewW, viewH);

    schedulePhaserPlayReady(this, 300, { score: this.score });
    setPhaserQaState({ score: this.score });
  }

  private buildTouchControls(viewW: number, viewH: number) {
    const by = viewH - 26;
    const bh = 44;
    const zh = this.uiLocale === "zh-Hans";

    // 左移按钮
    const leftBg = this.add.rectangle(44, by, 72, bh, 0x1e3a5f, 0.85)
      .setDepth(30).setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.add.text(44, by, "←", { fontFamily: "system-ui", fontSize: "22px", color: "#93c5fd" })
      .setOrigin(0.5).setDepth(31).setScrollFactor(0);
    leftBg.on("pointerdown", () => { this.touchLeft = true; });
    leftBg.on("pointerup", () => { this.touchLeft = false; });
    leftBg.on("pointerout", () => { this.touchLeft = false; });

    // 右移按钮
    const rightBg = this.add.rectangle(viewW - 44, by, 72, bh, 0x1e3a5f, 0.85)
      .setDepth(30).setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.add.text(viewW - 44, by, "→", { fontFamily: "system-ui", fontSize: "22px", color: "#93c5fd" })
      .setOrigin(0.5).setDepth(31).setScrollFactor(0);
    rightBg.on("pointerdown", () => { this.touchRight = true; });
    rightBg.on("pointerup", () => { this.touchRight = false; });
    rightBg.on("pointerout", () => { this.touchRight = false; });

    // 蓄力投篮按钮（中央）
    const chargeLabel = zh ? "按住蓄力" : "Hold=Charge";
    const chargeBg = this.add.rectangle(viewW / 2, by, 120, bh, 0x065f46, 0.88)
      .setDepth(30).setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.add.text(viewW / 2, by, chargeLabel, { fontFamily: "system-ui", fontSize: "13px", color: "#6ee7b7" })
      .setOrigin(0.5).setDepth(31).setScrollFactor(0);
    chargeBg.on("pointerdown", () => this.startCharge());
    chargeBg.on("pointerup", () => this.releaseCharge());
    chargeBg.on("pointerout", () => this.releaseCharge());
    chargeBg.on("pointerover", () => chargeBg.setFillStyle(0x047857, 0.95));
    chargeBg.on("pointerleave", () => chargeBg.setFillStyle(0x065f46, 0.88));
  }

  private buildGoal(viewW: number, viewH: number, goalColorNum: number) {
    const goalX = viewW / 2;
    const goalY = viewH * 0.32;

    // 篮板 / 球门背板
    const back = this.add.rectangle(0, -36, 110, 8, goalColorNum, 1);
    // 篮筐圈 / 球门横梁
    const rim = this.add.rectangle(0, 0, 96, 6, goalColorNum, 1);
    // 立柱（球门视觉）
    const postL = this.add.rectangle(-48, 28, 6, 56, goalColorNum, 0.85);
    const postR = this.add.rectangle(48, 28, 6, 56, goalColorNum, 0.85);

    this.goal = this.add.container(goalX, goalY, [back, rim, postL, postR]).setDepth(15);

    // 目标轻微飘动（增加难度感）；命中判定改为 update() 中的距离检测
    const driftRange = 80;
    this.tweens.add({
      targets: this.goal,
      x: goalX + driftRange,
      duration: 2600 - this.bp.aiDifficulty * 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private startCharge() {
    if (this.finished) return;
    this.charging = true;
    this.chargeStart = this.time.now;
  }

  private releaseCharge() {
    if (!this.charging || this.finished) return;
    this.charging = false;
    const held = Math.min(this.maxChargeMs, this.time.now - this.chargeStart);
    const t = held / this.maxChargeMs; // 0..1
    const power = this.minPower + (this.maxPower - this.minPower) * t;

    // 用一次性生成的球纹理创建球
    const ball = this.ballGroup.create(this.player.x, this.player.y - 30, "texSportsBall") as Phaser.Physics.Arcade.Image;
    ball.setDepth(18);
    ball.setCollideWorldBounds(true);

    // 抛物线初速：水平略向目标 + 垂直向上
    const dir = Math.sign(this.goal.x - this.player.x) || 1;
    const vx = dir * power * 0.55;
    const vy = -power;
    ball.setVelocity(vx, vy);

    playBleep("pickup");
    this.chargeBar.clear();
  }

  private onGoal(ball: Phaser.Physics.Arcade.Image) {
    const bx = ball.x;
    const by = ball.y;
    ball.destroy();
    this.score += 1;
    juicePickup(this, {
      x: bx,
      y: by,
      colorHex: themeParticleHex(this.spec),
      text: "+1",
      textColorCss: this.cohesive.hud.body,
    });
    juiceBurst(this, bx, by, themeParticleHex(this.spec), 12);
    playBleep("pickup");
    this.refreshHud();
    if (this.score >= this.targetScore) {
      this.finish({ score: this.score, won: true });
    }
  }

  private refreshHud() {
    const remainMs = Math.max(0, this.timeLimitMs - (this.time.now - this.startAt));
    const sec = Math.ceil(remainMs / 1000);
    const right = hudSportsScore(this.uiLocale, Math.min(this.score, this.targetScore), this.targetScore, sec);
    this.hud.update({
      score: this.score,
      lives: this.lives,
      right,
      actLabel: this.sportLabel(),
      skill: this.uiLocale === "zh-Hans" ? "空格 · 蓄力投篮" : "Space · Charge & shoot",
    });
  }

  private sportLabel(): string {
    const map: Record<SportKind, string> = {
      basketball: this.uiLocale === "zh-Hans" ? "篮球" : "Basketball",
      football: this.uiLocale === "zh-Hans" ? "足球" : "Football",
      tennis: this.uiLocale === "zh-Hans" ? "网球" : "Tennis",
      golf: this.uiLocale === "zh-Hans" ? "高尔夫" : "Golf",
      bowling: this.uiLocale === "zh-Hans" ? "保龄球" : "Bowling",
    };
    return map[this.sport];
  }

  private drawChargeBar() {
    this.chargeBar.clear();
    if (!this.charging) return;
    const held = Math.min(this.maxChargeMs, this.time.now - this.chargeStart);
    const t = held / this.maxChargeMs;
    const w = 60;
    const h = 6;
    const x = this.player.x - w / 2;
    const y = this.player.y - 48;
    this.chargeBar.fillStyle(0x000000, 0.5);
    this.chargeBar.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 3);
    const col = t > 0.8 ? 0xff6644 : t > 0.5 ? 0xfbbf24 : 0x4ade80;
    this.chargeBar.fillStyle(col, 1);
    this.chargeBar.fillRoundedRect(x, y, w * t, h, 3);
  }

  update() {
    if (this.finished) return;
    const speed = this.spec.gameplay.playerSpeed ?? 220;
    const dir = ((this.keyRight.isDown || this.keyD.isDown || this.touchRight) ? 1 : 0) - ((this.keyLeft.isDown || this.keyA.isDown || this.touchLeft) ? 1 : 0);
    const nx = Phaser.Math.Clamp(this.player.x + dir * speed * (this.game.loop.delta / 1000), 60, this.scale.width - 60);
    this.player.x = nx;

    // 倒计时
    const remainMs = this.timeLimitMs - (this.time.now - this.startAt);
    if (remainMs <= 0) {
      this.finish({ score: this.score, won: this.score >= this.targetScore });
      return;
    }

    // 球出界清理 + 命中判定（手动距离，目标在动）
    const gx = this.goal.x;
    const gy = this.goal.y;
    const kids = this.ballGroup.getChildren();
    for (let i = 0; i < kids.length; i += 1) {
      const b = kids[i] as Phaser.Physics.Arcade.Image;
      if (!b?.active) continue;
      // 命中判定：球进入目标附近且正在下落（模拟进框）
      const dx = b.x - gx;
      const dy = b.y - gy;
      const body = b.body as Phaser.Physics.Arcade.Body | null;
      const descending = body ? body.velocity.y > -40 : true;
      if (Math.abs(dx) < this.goalRadius && Math.abs(dy) < 26 && descending) {
        this.onGoal(b);
        continue;
      }
      if (b.y > this.scale.height + 40 || b.x < -40 || b.x > this.scale.width + 40) {
        b.destroy();
      }
    }

    this.drawChargeBar();
    this.refreshHud();
    setPhaserQaState({ score: this.score });
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    this.hud.setBottomHint(
      this.uiLocale === "zh-Hans"
        ? (payload.won ? "通关！时间结束" : "时间到，再试一次")
        : (payload.won ? "Win!" : "Time's up, try again"),
    );
    if (payload.won) {
      const winBanner = bannerSportsWin(this.uiLocale);
      juiceWin(this, {
        x: this.player.x,
        y: this.player.y,
        colorHex: themeParticleHex(this.spec),
        text: winBanner.title,
        textColorCss: this.cohesive.hud.accent,
      });
      this.hud.setBottomHint(winBanner.message);
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    } else {
      juiceFail(this, {
        x: this.player.x,
        y: this.player.y,
        colorHex: this.spec.theme.hazardColor,
        text: this.uiLocale === "zh-Hans" ? "失败" : "Fail",
        textColorCss: this.cohesive.hud.danger,
      });
    }
    this.onEnd(payload);
  }
}
