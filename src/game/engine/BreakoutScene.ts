import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import {
  juiceBurst,
  juiceFail,
  juiceHit,
  juicePickup,
  juiceWin,
  themeParticleHex,
} from "@/game/engine/gameJuice";
import type { GameSpec } from "@/lib/game-spec";
import { buildBreakoutBlueprint, type BreakoutBlueprint } from "@/lib/breakout-blueprint";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import type { CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { initQaState, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { showControlsHint } from "@/game/engine/controls-hint";

type EndPayload = { score: number; won: boolean };

/**
 * Breakout（真打砖块）独立 Scene。
 *
 * 玩法：
 * - 底部挡板（鼠标 X / 键盘左右）移动
 * - 弹球从挡板发射，反弹打砖块
 * - 砖块网格：多行多列，不同行不同颜色与分值
 * - 球碰砖块 → 砖块消失 + 加分 + 球反弹
 * - 球碰底部 → 失命，重置球到挡板上
 * - 全部砖块消除 → 通关
 * - 命耗尽 → 失败
 *
 * 物理：自管球反弹（碰墙 / 挡板 / 砖块）。
 */
export class BreakoutScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private blueprint!: BreakoutBlueprint;
  private cohesive!: CohesivePresentation;

  private paddle!: Phaser.GameObjects.Image;
  private ball!: Phaser.GameObjects.Text;
  private ballRadius = 8;
  private ballVel = new Phaser.Math.Vector2(0, 0);
  private ballLaunched = false;

  private bricks: Phaser.GameObjects.Rectangle[] = [];
  private brickW = 0;
  private brickH = 0;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  private score = 0;
  private lives = 3;
  private remaining = 0;
  private finished = false;
  private hud!: HudFrame;

  private paddleSpeed = 520;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("BreakoutScene");
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

    this.blueprint = buildBreakoutBlueprint({ spec: this.spec });
    this.lives = this.spec.gameplay.lives ?? 3;

    const ui = buildSceneCohesion(this.spec);
    this.cohesive = ui;

    // ─── 背景 ───
    const bgCol = parseInt(this.spec.theme.backgroundColor.replace("#", ""), 16);
    if (Number.isFinite(bgCol)) {
      this.cameras.main.setBackgroundColor(bgCol);
    }
    this.addStarfield(viewW, viewH);

    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      this.add.image(viewW / 2, viewH / 2, "bgTex").setDepth(-10).setAlpha(0.85);
    }

    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);

    // ─── 边界墙（视觉 + 物理意义都靠 clamp 实现） ───
    const wallTop = 56;     // 顶部留 HUD
    const wallLeft = 16;
    const wallRight = viewW - 16;

    // ─── 砖块网格 ───
    const rows = this.blueprint.brickRows;
    const cols = this.blueprint.brickCols;
    const gridTop = wallTop + 24;
    const gridW = wallRight - wallLeft;
    const gap = 4;
    this.brickW = (gridW - gap * (cols - 1)) / cols;
    this.brickH = 22;
    this.bricks = [];
    this.remaining = rows * cols;

    // 不同行不同颜色 + 不同分值（顶部分值高，底部分值低）
    const rowColors = [
      0xef4444, // red
      0xf97316, // orange
      0xfacc15, // yellow
      0x4ade80, // green
      0x38bdf8, // sky
      0x818cf8, // indigo
      0xa78bfa, // violet
      0xf472b6, // pink
    ];
    // 砖块纹理（程序化 bevel：高光顶边 + 阴影底边，比纯色矩形更立体）
    const brickTexKey = "texBreakoutBrick";
    if (!this.textures.exists(brickTexKey)) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.generateTexture(brickTexKey, this.brickW, this.brickH);
      g.destroy();
    }
    for (let r = 0; r < rows; r += 1) {
      const color = rowColors[r % rowColors.length] ?? 0x38bdf8;
      const dark = (color & 0xfefefe) >> 1;
      const light = Math.min(0xffffff, color + 0x303030);
      const value = Math.max(1, rows - r); // 顶行分值最高
      // 每行一个纹理（颜色不同）
      const rowTexKey = `texBrickRow${r}`;
      if (!this.textures.exists(rowTexKey)) {
        const g = this.make.graphics({ x: 0, y: 0 });
        g.fillStyle(0x000000, 0.25);
        g.fillRoundedRect(1, 1, this.brickW - 2, this.brickH - 2, 3);
        g.fillStyle(dark, 1);
        g.fillRoundedRect(0, 0, this.brickW - 1, this.brickH - 1, 3);
        g.fillStyle(color, 1);
        g.fillRoundedRect(0, 0, this.brickW - 1, this.brickH - 3, 3);
        g.fillStyle(light, 0.6);
        g.fillRoundedRect(2, 1, this.brickW - 5, 2, 1);
        g.generateTexture(rowTexKey, this.brickW, this.brickH);
        g.destroy();
      }
      for (let c = 0; c < cols; c += 1) {
        const bx = wallLeft + c * (this.brickW + gap) + this.brickW / 2;
        const by = gridTop + r * (this.brickH + gap) + this.brickH / 2;
        const brick = this.add.image(bx, by, rowTexKey).setDepth(5);
        brick.setData("value", value);
        brick.setData("alive", true);
        this.bricks.push(brick as unknown as Phaser.GameObjects.Rectangle);
      }
    }

    // ─── 挡板（程序化精致绘制：圆角 + 高光 + 阴影）───
    const paddleW = this.blueprint.paddleWidth;
    const paddleH = 14;
    const paddleY = viewH - 40;
    const paddleCol = parseInt(this.spec.theme.playerColor.replace("#", ""), 16);
    const paddleTexKey = "texBreakoutPaddle";
    if (!this.textures.exists(paddleTexKey)) {
      const pc = Number.isFinite(paddleCol) ? paddleCol : 0x38bdf8;
      const pd = (pc & 0xfefefe) >> 1;
      const pl = Math.min(0xffffff, pc + 0x404040);
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x000000, 0.3);
      g.fillRoundedRect(2, 4, paddleW, paddleH, 6);
      g.fillStyle(pd, 1);
      g.fillRoundedRect(0, 0, paddleW, paddleH, 6);
      g.fillStyle(pc, 1);
      g.fillRoundedRect(0, 0, paddleW, paddleH - 2, 5);
      g.fillStyle(pl, 0.5);
      g.fillRoundedRect(4, 2, paddleW - 8, 3, 2);
      g.generateTexture(paddleTexKey, paddleW + 4, paddleH + 6);
      g.destroy();
    }
    this.paddle = this.add.image(viewW / 2, paddleY, paddleTexKey).setDepth(20);

    // ─── 弹球（⚪ emoji，比纯白圆更可读）───
    this.ballRadius = 8;
    this.ball = this.add
      .text(viewW / 2, paddleY - this.ballRadius - 6, "⚪", {
        fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
        fontSize: "20px",
      })
      .setOrigin(0.5)
      .setDepth(25);
    this.ballLaunched = false;
    this.ballVel.set(0, 0);

    // ─── 输入 ───
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyLeft = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyRight = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // 鼠标移动控挡板（在游戏区域内）
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (this.finished) return;
      this.paddle.x = Phaser.Math.Clamp(ptr.x, wallLeft + paddleW / 2, wallRight - paddleW / 2);
    });

    // 点击 / 空格发射球
    const launchBall = () => {
      if (this.finished || this.ballLaunched) return;
      this.ballLaunched = true;
      const speed = this.blueprint.ballSpeed;
      // 初始方向略偏上方，避免正中
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      this.ballVel.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
      playBleep("pickup");
    };
    this.input.on("pointerdown", () => launchBall());

    // ─── HUD ───
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, ui);
    this.refreshHud();

    showControlsHint(
      this,
      this.uiLocale === "zh-Hans"
        ? ["← → / A D 移动挡板", "鼠标移动挡板", "空格 / 点击 发射弹球"]
        : ["← → / A D move paddle", "Mouse to move paddle", "Space / Click to launch ball"],
    );

    initQaState({ score: 0, lives: this.lives, remaining: this.remaining });
    setPhaserQaState({ score: this.score, lives: this.lives, remaining: this.remaining });
    schedulePhaserPlayReady(this, 350, { score: this.score, lives: this.lives, remaining: this.remaining });
  }

  private addStarfield(viewW: number, viewH: number) {
    const tint = parseInt((this.spec.theme.particleTint ?? "#6b7f78").replace("#", ""), 16) || 0x38bdf8;
    for (let i = 0; i < 70; i += 1) {
      const x = Phaser.Math.Between(4, viewW - 4);
      const y = Phaser.Math.Between(4, viewH - 4);
      const s = Phaser.Math.FloatBetween(1, 2.4);
      const a = Phaser.Math.FloatBetween(0.06, 0.22);
      this.add.rectangle(x, y, s, s, tint, a).setDepth(-12);
    }
  }

  private refreshHud() {
    const right =
      this.uiLocale === "zh-Hans"
        ? `砖块 ${this.remaining}`
        : `Bricks ${this.remaining}`;
    this.hud.update({
      score: this.score,
      lives: this.lives,
      right,
      actLabel: "",
      skill: this.ballLaunched
        ? (this.uiLocale === "zh-Hans" ? "弹球进行中" : "Ball in play")
        : (this.uiLocale === "zh-Hans" ? "点击 / 空格 发射" : "Click / Space to launch"),
    });
  }

  update(_time: number, deltaMs: number) {
    this.hud.update({});
    if (this.finished) return;

    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const dt = deltaMs / 1000;

    // ─── 挡板键盘控制 ───
    let dir = 0;
    if (this.cursors.left.isDown || this.keyLeft.isDown) dir -= 1;
    if (this.cursors.right.isDown || this.keyRight.isDown) dir += 1;
    if (dir !== 0) {
      const paddleW = this.paddle.width;
      this.paddle.x = Phaser.Math.Clamp(
        this.paddle.x + dir * this.paddleSpeed * dt,
        16 + paddleW / 2,
        viewW - 16 - paddleW / 2,
      );
    }

    // 空格发射
    if (Phaser.Input.Keyboard.JustDown(this.keySpace) && !this.ballLaunched) {
      this.ballLaunched = true;
      const speed = this.blueprint.ballSpeed;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      this.ballVel.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
      playBleep("pickup");
    }

    // ─── 球未发射：贴在挡板上 ───
    if (!this.ballLaunched) {
      this.ball.x = this.paddle.x;
      this.ball.y = this.paddle.y - this.paddle.height / 2 - this.ballRadius - 2;
      return;
    }

    // ─── 球移动（自管位移 + 反弹） ───
    this.ball.x += this.ballVel.x * dt;
    this.ball.y += this.ballVel.y * dt;

    // 左右墙
    if (this.ball.x - this.ballRadius < 16) {
      this.ball.x = 16 + this.ballRadius;
      this.ballVel.x = Math.abs(this.ballVel.x);
      playBleep("hit");
    } else if (this.ball.x + this.ballRadius > viewW - 16) {
      this.ball.x = viewW - 16 - this.ballRadius;
      this.ballVel.x = -Math.abs(this.ballVel.x);
      playBleep("hit");
    }
    // 顶墙
    if (this.ball.y - this.ballRadius < 56) {
      this.ball.y = 56 + this.ballRadius;
      this.ballVel.y = Math.abs(this.ballVel.y);
      playBleep("hit");
    }

    // ─── 挡板碰撞 ───
    const paddleW = this.paddle.width;
    const paddleH = this.paddle.height;
    if (
      this.ballVel.y > 0 &&
      this.ball.y + this.ballRadius >= this.paddle.y - paddleH / 2 &&
      this.ball.y - this.ballRadius <= this.paddle.y + paddleH / 2 &&
      this.ball.x >= this.paddle.x - paddleW / 2 &&
      this.ball.x <= this.paddle.x + paddleW / 2
    ) {
      // 根据击中位置调整反弹角度（边缘斜射）
      const rel = (this.ball.x - this.paddle.x) / (paddleW / 2); // -1..1
      const speed = this.ballVel.length();
      const angle = -Math.PI / 2 + rel * (Math.PI / 3); // ±60°
      this.ballVel.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
      this.ball.y = this.paddle.y - paddleH / 2 - this.ballRadius - 1;
      playBleep("pickup");
      juiceBurst(this, this.ball.x, this.ball.y, this.cohesive.hud.accent2, 6);
    }

    // ─── 砖块碰撞（AABB，找到第一个命中即处理） ───
    for (let i = 0; i < this.bricks.length; i += 1) {
      const brick = this.bricks[i]!;
      if (brick.getData("alive") !== true) continue;
      const bw = brick.width;
      const bh = brick.height;
      const bx0 = brick.x - bw / 2;
      const bx1 = brick.x + bw / 2;
      const by0 = brick.y - bh / 2;
      const by1 = brick.y + bh / 2;
      if (
        this.ball.x + this.ballRadius >= bx0 &&
        this.ball.x - this.ballRadius <= bx1 &&
        this.ball.y + this.ballRadius >= by0 &&
        this.ball.y - this.ballRadius <= by1
      ) {
        // 判断从哪一面进入，决定反弹轴
        const overlapX = Math.min(this.ball.x + this.ballRadius - bx0, bx1 - (this.ball.x - this.ballRadius));
        const overlapY = Math.min(this.ball.y + this.ballRadius - by0, by1 - (this.ball.y - this.ballRadius));
        if (overlapX < overlapY) {
          this.ballVel.x = -this.ballVel.x;
          this.ball.x += this.ballVel.x > 0 ? overlapX : -overlapX;
        } else {
          this.ballVel.y = -this.ballVel.y;
          this.ball.y += this.ballVel.y > 0 ? overlapY : -overlapY;
        }
        // 销毁砖块 + 计分
        const value = (brick.getData("value") as number | undefined) ?? 1;
        brick.setData("alive", false);
        brick.setVisible(false);
        brick.setActive(false);
        this.remaining -= 1;
        this.score += value;
        playBleep("hit");
        juicePickup(this, {
          x: brick.x,
          y: brick.y,
          colorHex: themeParticleHex(this.spec),
          text: `+${value}`,
          textColorCss: this.cohesive.hud.body,
        });
        this.refreshHud();
        setPhaserQaState({ score: this.score, lives: this.lives, remaining: this.remaining });
        break; // 一帧只处理一个砖块碰撞，避免穿透多块
      }
    }

    // ─── 球落底 → 失命 ───
    if (this.ball.y - this.ballRadius > viewH) {
      this.lives -= 1;
      this.fxDamage();
      this.refreshHud();
      setPhaserQaState({ score: this.score, lives: this.lives, remaining: this.remaining });
      if (this.lives <= 0) {
        this.finish({ score: this.score, won: false });
        return;
      }
      // 重置球到挡板上
      this.ballLaunched = false;
      this.ballVel.set(0, 0);
      this.ball.x = this.paddle.x;
      this.ball.y = this.paddle.y - this.paddle.height / 2 - this.ballRadius - 2;
    }

    // ─── 通关 ───
    if (this.remaining <= 0) {
      this.finish({ score: this.score, won: true });
    }
  }

  private fxDamage() {
    juiceHit(this, {
      x: this.ball?.x ?? this.scale.width / 2,
      y: this.ball?.y ?? this.scale.height - 60,
      colorHex: this.spec.theme.hazardColor,
    });
    playBleep("hit");
    this.cameras.main.shake(180, 0.006);
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    this.finished = true;
    this.hud.update({ dangerLevel: 0 });
    const finishText = payload.won
      ? (this.uiLocale === "zh-Hans" ? "通关！" : "Cleared!")
      : (this.uiLocale === "zh-Hans" ? "失败" : "Game Over");
    this.hud.setBottomHint(finishText);
    if (payload.won) {
      this.cameras.main.shake(300, 0.008);
      juiceWin(this, {
        x: this.scale.width / 2,
        y: this.scale.height / 2,
        colorHex: themeParticleHex(this.spec),
        text: this.uiLocale === "zh-Hans" ? "胜利" : "Win",
        textColorCss: this.cohesive.hud.accent,
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
}
