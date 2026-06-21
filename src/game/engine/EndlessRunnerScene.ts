import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import {
  juiceBurst,
  juiceFail,
  juiceFlash,
  juiceHit,
  juicePickup,
  juiceWin,
  themeParticleHex,
} from "@/game/engine/gameJuice";
import type { GameSpec } from "@/lib/game-spec";
import { buildEndlessRunnerBlueprint, type EndlessRunnerBlueprint } from "@/lib/endless-runner-blueprint";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { phaserUintToCssHex, type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { runtimeSeedFromSpec } from "@/lib/runtime-seed";
import { initQaState, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { hudEndlessRunnerScore, bannerEndlessRunnerWin } from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

/** 确定性伪随机 0..1 */
function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 无尽跑酷 Scene（神庙逃亡 / Subway Surfers 风格 3 道跑酷）。
 *
 * 玩法核心：
 * - 3 条道（左 / 中 / 右），玩家角色在屏幕左侧固定 x
 * - 道路向左滚动（背景 + 障碍 + 金币向左移动）
 * - 输入：←→ 切道 / ↑ 跳 / ↓ 滑铲
 * - 障碍：路障（撞到扣血）/ 高栏（必须滑铲）/ 低栏（必须跳）
 * - 金币 +10 分；连吃 combo 加成
 * - 速度每 500 分 +10%；撞 3 次失败；达到 targetScore 通关
 *
 * 视觉：伪 3D 透视，远端窄近端宽（梯形透视）。
 */
export class EndlessRunnerScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private bp!: EndlessRunnerBlueprint;

  // 玩家状态
  private player!: Phaser.GameObjects.Container;
  private playerLane = 1; // 0=左 1=中 2=右
  private playerY = 0; // 当前 y 偏移（跳/滑铲）
  private playerVy = 0; // 垂直速度
  private isJumping = false;
  private isSliding = false;
  private slideUntil = 0;

  // 滚动
  private scrollSpeed = 480; // 像素/秒
  private baseSpeed = 480;
  private scrollOffset = 0; // 用于路面纹理循环

  // 实体
  private obstacles: Array<{
    obj: Phaser.GameObjects.Container;
    kind: "barrier" | "high" | "low";
    lane: number;
    passed: boolean;
  }> = [];
  private coins: Array<{ obj: Phaser.GameObjects.Text; lane: number; collected: boolean }> = [];

  // 计分 / 生命
  private score = 0;
  private lives = 3;
  private combo = 0;
  private comboResetAt = 0;
  private distance = 0;

  // 生成
  private nextSpawnX = 0;
  private nextCoinX = 0;

  // 视图
  private viewW = 0;
  private viewH = 0;
  private playerScreenX = 0; // 玩家固定屏幕 x
  private laneWidth = 0; // 单道宽度（近端）
  private roadTopY = 0; // 道路远端 y
  private roadBotY = 0; // 道路近端 y
  private laneTopWidth = 0; // 远端单道宽
  private laneBotWidth = 0; // 近端单道宽

  // 背景
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private roadGraphics!: Phaser.GameObjects.Graphics;
  private scrollGraphics!: Phaser.GameObjects.Graphics;

  // 输入
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  // HUD
  private hud!: HudFrame;
  private cohesive!: CohesivePresentation;
  private finished = false;
  private invulnUntil = 0;
  private winScore = 3000;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("EndlessRunnerScene");
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

    this.bp = this.spec.endlessRunner ?? buildEndlessRunnerBlueprint({ spec: this.spec });
    // 兜底钳制（schema 范围外则回到合理值）
    this.bp = {
      lanes: Phaser.Math.Clamp(this.bp.lanes, 2, 5),
      targetScore: Phaser.Math.Clamp(this.bp.targetScore, 500, 10000),
      speed: Phaser.Math.Clamp(this.bp.speed, 300, 900),
      obstacleDensity: Phaser.Math.Clamp(this.bp.obstacleDensity, 0.1, 0.8),
    };
    this.baseSpeed = this.bp.speed;
    this.scrollSpeed = this.baseSpeed;
    this.winScore = this.bp.targetScore;
    this.lives = this.spec.gameplay.lives ?? 3;

    // 视图布局：道路占屏幕下 65%
    this.roadTopY = this.viewH * 0.32;
    this.roadBotY = this.viewH - 40;
    this.playerScreenX = this.viewW * 0.28;
    // 近端 3 道总宽 = 视图宽 70%；远端 3 道总宽 = 视图宽 30%（透视）
    this.laneBotWidth = (this.viewW * 0.7) / this.bp.lanes;
    this.laneTopWidth = (this.viewW * 0.3) / this.bp.lanes;
    this.laneWidth = this.laneBotWidth;

    this.cohesive = buildSceneCohesion(this.spec);

    // 背景层（天空渐变 + 远景剪影）
    this.bgGraphics = this.add.graphics().setDepth(-20);
    this.paintBackdrop();

    // 文生图背景（贴在天空层）
    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      this.add
        .image(this.viewW / 2, this.roadTopY * 0.5, "bgTex")
        .setDepth(-15)
        .setAlpha(0.55);
    }

    // 道路静态层（梯形透视框 + 道线）
    this.roadGraphics = this.add.graphics().setDepth(-10);
    this.paintRoadFrame();

    // 道路滚动纹理层（路面条纹 / 装饰，每帧重画）
    this.scrollGraphics = this.add.graphics().setDepth(-5);

    // 玩家容器（角色 + 阴影）
    this.player = this.buildPlayer();
    this.setPlayerLane(this.playerLane, true);

    // 输入
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // 移动端：点击屏幕左/右半切道，上滑跳，下滑滑铲
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (this.finished) return;
      if (ptr.x < this.viewW * 0.5) this.tryLaneShift(-1);
      else this.tryLaneShift(1);
    });

    // HUD
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, this.cohesive);
    this.hud.setBottomHint(
      this.uiLocale === "zh-Hans"
        ? "←→ 切道 · ↑/空格 跳 · ↓ 滑铲"
        : "←→ switch lane · ↑/Space jump · ↓ slide",
    );

    // 初始生成
    this.nextSpawnX = this.viewW + 100;
    this.nextCoinX = this.viewW + 60;

    initQaState({ playerX: Math.round(this.playerScreenX) });
    setPhaserQaState({ playerX: Math.round(this.playerScreenX) });
    schedulePhaserPlayReady(this, 350, { playerX: Math.round(this.playerScreenX) });

    this.refreshHud();
  }

  // ─── 视觉绘制 ────────────────────────────────────────────────────────

  private paintBackdrop() {
    const g = this.bgGraphics;
    const skyTop = parseInt(this.spec.theme.backgroundColor.replace("#", ""), 16);
    const skyBot = phaserUintToCssHex(0x1e293b).replace("#", "");
    const skyBotInt = parseInt(skyBot, 16);
    // 天空渐变
    for (let y = 0; y < this.roadTopY; y += 4) {
      const t = y / this.roadTopY;
      const r = Math.round(((skyTop >> 16) & 0xff) * (1 - t) + ((skyBotInt >> 16) & 0xff) * t);
      const gg = Math.round(((skyTop >> 8) & 0xff) * (1 - t) + ((skyBotInt >> 8) & 0xff) * t);
      const b = Math.round((skyTop & 0xff) * (1 - t) + (skyBotInt & 0xff) * t);
      g.fillStyle((r << 16) | (gg << 8) | b, 1);
      g.fillRect(0, y, this.viewW, 4);
    }
    // 远景剪影（山/建筑）
    const silhouette = phaserUintToCssHex(0x0f172a).replace("#", "");
    const silInt = parseInt(silhouette, 16);
    g.fillStyle(silInt, 0.5);
    for (let i = 0; i < 6; i += 1) {
      const cx = (i / 6) * this.viewW + 40;
      const cw = this.viewW / 6 + 20;
      const ch = 30 + (i % 3) * 22;
      g.fillEllipse(cx, this.roadTopY + 4, cw, ch * 2);
    }
  }

  private paintRoadFrame() {
    const g = this.roadGraphics;
    const roadColor = parseInt("2d3a4f", 16);
    const laneLineColor = parseInt("fde047", 16);

    // 梯形道路主体
    const topW = this.laneTopWidth * this.bp.lanes;
    const botW = this.laneBotWidth * this.bp.lanes;
    const cx = this.viewW / 2;
    g.fillStyle(roadColor, 0.95);
    g.beginPath();
    g.moveTo(cx - topW / 2, this.roadTopY);
    g.lineTo(cx + topW / 2, this.roadTopY);
    g.lineTo(cx + botW / 2, this.roadBotY);
    g.lineTo(cx - botW / 2, this.roadBotY);
    g.closePath();
    g.fillPath();

    // 道线（每条道两侧）
    g.lineStyle(2, laneLineColor, 0.7);
    for (let i = 1; i < this.bp.lanes; i += 1) {
      const ratio = i / this.bp.lanes;
      const topX = cx - topW / 2 + topW * ratio;
      const botX = cx - botW / 2 + botW * ratio;
      g.lineBetween(topX, this.roadTopY, botX, this.roadBotY);
    }
    // 道路两侧边线（更粗）
    g.lineStyle(3, 0xffffff, 0.85);
    g.lineBetween(cx - topW / 2, this.roadTopY, cx - botW / 2, this.roadBotY);
    g.lineBetween(cx + topW / 2, this.roadTopY, cx + botW / 2, this.roadBotY);
  }

  /** 路面滚动纹理（条纹向左移动，远端稀疏近端密集） */
  private paintScrollTexture() {
    const g = this.scrollGraphics;
    g.clear();
    const stripeColor = parseInt("475569", 16);
    const stripeSpacing = 80;
    const offset = this.scrollOffset % stripeSpacing;

    // 透视条纹：从远端到近端，y 越大条纹越宽越亮
    for (let z = 0; z < 24; z += 1) {
      // z: 0=远 1=近，映射到 y
      const tBase = z / 24;
      const yBase = this.roadTopY + tBase * (this.roadBotY - this.roadTopY);
      const yNext = this.roadTopY + ((z + 1) / 24) * (this.roadBotY - this.roadTopY);
      // 滚动偏移：近端移动快，远端移动慢（透视）
      const scrollT = tBase; // 0..1
      const stripeOffset = (offset * (0.2 + scrollT * 0.8)) % (yNext - yBase);
      const y = yBase + stripeOffset;
      if (y > yNext - 4) continue;
      const t = (y - this.roadTopY) / (this.roadBotY - this.roadTopY);
      const cx = this.viewW / 2;
      const halfW = (this.laneTopWidth * this.bp.lanes) / 2 + t * ((this.laneBotWidth * this.bp.lanes) - (this.laneTopWidth * this.bp.lanes)) / 2;
      const alpha = 0.15 + t * 0.25;
      const thick = 1 + t * 2;
      g.fillStyle(stripeColor, alpha);
      g.fillRect(cx - halfW, y, halfW * 2, thick);
    }
  }

  // ─── 玩家 ────────────────────────────────────────────────────────────

  private buildPlayer(): Phaser.GameObjects.Container {
    const playerColor = parseInt(this.spec.theme.playerColor.replace("#", ""), 16);
    const container = this.add.container(this.playerScreenX, this.roadBotY - 60).setDepth(50);

    // 阴影（椭圆，固定在地面）
    const shadow = this.add.ellipse(0, 50, 50, 14, 0x000000, 0.35).setDepth(49);
    container.add(shadow);
    container.setData("shadow", shadow);

    // 跑者：用 emoji 代替矩形+圆头几何形
    const body = this.add
      .text(0, -10, "🏃", {
        fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
        fontSize: "56px",
      })
      .setOrigin(0.5)
      .setTint(playerColor)
      .setDepth(50);
    container.add(body);
    container.setData("body", body);

    return container;
  }

  /** 计算某道在指定 y（地面层）的屏幕 x 坐标 */
  private laneScreenX(lane: number): number {
    // 玩家固定在近端地面层，所以用近端道宽
    const cx = this.viewW / 2;
    const botW = this.laneBotWidth * this.bp.lanes;
    const laneCenter = (lane + 0.5) / this.bp.lanes;
    return cx - botW / 2 + botW * laneCenter;
  }

  private setPlayerLane(lane: number, instant = false) {
    this.playerLane = Phaser.Math.Clamp(lane, 0, this.bp.lanes - 1);
    const targetX = this.laneScreenX(this.playerLane);
    if (instant) {
      this.player.x = targetX;
    } else {
      this.tweens.add({
        targets: this.player,
        x: targetX,
        duration: 130,
        ease: "Cubic.Out",
      });
    }
  }

  private tryLaneShift(dir: number) {
    if (this.finished) return;
    const next = this.playerLane + dir;
    if (next < 0 || next >= this.bp.lanes) return;
    this.setPlayerLane(next);
    playBleep("pickup");
  }

  private tryJump() {
    if (this.finished) return;
    if (this.isJumping || this.isSliding) return;
    this.isJumping = true;
    this.playerVy = -560;
    playBleep("pickup");
  }

  private trySlide() {
    if (this.finished) return;
    if (this.isSliding) return;
    this.isSliding = true;
    this.slideUntil = this.time.now + 600;
    // 视觉：身体压扁
    const body = this.player.getData("body") as Phaser.GameObjects.Graphics;
    if (body) {
      this.tweens.add({
        targets: body,
        scaleY: 0.5,
        scaleX: 1.25,
        duration: 80,
        yoyo: true,
        ease: "Cubic.Out",
      });
    }
    playBleep("pickup");
  }

  // ─── 生成 ────────────────────────────────────────────────────────────

  private spawnObstacle() {
    const seed = runtimeSeedFromSpec(this.spec);
    const lane = Math.floor(rnd(seed, this.score + this.obstacles.length) * this.bp.lanes);
    const kindRoll = rnd(seed, this.score * 7 + this.obstacles.length * 13 + 3);
    const kind: "barrier" | "high" | "low" = kindRoll < 0.4 ? "barrier" : kindRoll < 0.7 ? "high" : "low";
    const hazardCol = parseInt(this.spec.theme.hazardColor.replace("#", ""), 16);

    const container = this.add.container(0, 0).setDepth(40);
    // 障碍用 emoji：路障🚧/高栏🚷/低栏♿，比纯矩形更可读
    const emoji = kind === "barrier" ? "🚧" : kind === "high" ? "🚷" : "♿";
    const body = this.add
      .text(0, -20, emoji, {
        fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
        fontSize: "48px",
      })
      .setOrigin(0.5)
      .setTint(hazardCol)
      .setDepth(40);
    container.add(body);
    // 初始 screenX：屏幕右端外
    const initScreenX = this.viewW + 60;
    container.setData("screenX", initScreenX);
    this.obstacles.push({ obj: container, kind, lane, passed: false });
  }

  private spawnCoin() {
    const seed = runtimeSeedFromSpec(this.spec);
    const lane = Math.floor(rnd(seed, this.score + this.coins.length + 99) * this.bp.lanes);
    const collectCol = parseInt(
      (this.spec.theme.collectibleColor ?? "#fcd34d").replace("#", ""),
      16,
    );
    const coin = this.add.text(0, 0, "🪙", {
      fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
      fontSize: "28px",
    }).setOrigin(0.5).setDepth(35);
    // 旋转闪烁动画
    this.tweens.add({
      targets: coin,
      scaleX: { from: 1, to: 0.3 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    const initScreenX = this.viewW + 40;
    coin.setData("screenX", initScreenX);
    this.coins.push({ obj: coin, lane, collected: false });
  }

  // ─── 更新循环 ────────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    this.hud.update({});
    if (this.finished) return;
    const dt = delta / 1000;

    // 输入
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left!) || Phaser.Input.Keyboard.JustDown(this.keyA)) {
      this.tryLaneShift(-1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right!) || Phaser.Input.Keyboard.JustDown(this.keyD)) {
      this.tryLaneShift(1);
    }
    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
      Phaser.Input.Keyboard.JustDown(this.keyW) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace)
    ) {
      this.tryJump();
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down!) || Phaser.Input.Keyboard.JustDown(this.keyS)) {
      this.trySlide();
    }

    // 速度递增：每 500 分 +10%
    const speedTier = Math.floor(this.score / 500);
    this.scrollSpeed = this.baseSpeed * (1 + speedTier * 0.1);

    // 滚动
    const dx = this.scrollSpeed * dt;
    this.scrollOffset += dx;
    this.distance += dx * 0.1;
    this.paintScrollTexture();

    // 玩家垂直运动（跳/滑铲）
    if (this.isJumping) {
      this.playerVy += 1600 * dt; // 重力
      this.playerY += this.playerVy * dt;
      if (this.playerY >= 0) {
        this.playerY = 0;
        this.playerVy = 0;
        this.isJumping = false;
      }
    }
    if (this.isSliding && this.time.now >= this.slideUntil) {
      this.isSliding = false;
    }
    this.player.y = this.roadBotY - 60 + this.playerY;

    // 阴影随跳跃高度淡化
    const shadow = this.player.getData("shadow") as Phaser.GameObjects.Ellipse | undefined;
    if (shadow) {
      shadow.alpha = 0.35 * (1 - Math.min(1, -this.playerY / 200));
      shadow.scaleX = 1 - Math.min(0.4, -this.playerY / 400);
    }

    // 生成节奏（按密度）
    const spawnGap = 280 + (1 - this.bp.obstacleDensity) * 360;
    if (this.scrollOffset >= this.nextSpawnX) {
      this.nextSpawnX = this.scrollOffset + spawnGap;
      this.spawnObstacle();
    }
    const coinGap = 140 + (1 - this.bp.obstacleDensity) * 80;
    if (this.scrollOffset >= this.nextCoinX) {
      this.nextCoinX = this.scrollOffset + coinGap;
      // 60% 概率出金币
      if (Math.random() < 0.6) this.spawnCoin();
    }

    this.updateObstacles(dx);
    this.updateCoins(dx);

    // combo 超时重置
    if (this.combo > 0 && this.time.now >= this.comboResetAt) {
      this.combo = 0;
    }

    setPhaserQaState({ playerX: Math.round(this.playerScreenX) });
  }

  /**
   * 计算实体在透视下的渲染位置。
   * - screenX：实体当前屏幕 x（每帧向左减 dx）
   * - t = (screenX - playerScreenX) / viewW，0=玩家处（近端），1=远端
   * - y：近端 roadBotY，远端 roadTopY
   * - x：近端用 laneScreenX（近端道宽），远端向中心收拢
   * - scale：近端 1.0，远端 0.4
   */
  private applyPerspective(
    obj: Phaser.GameObjects.Container | Phaser.GameObjects.Text,
    screenX: number,
    lane: number,
    yLift = 0,
  ): void {
    const playerScreenX = this.playerScreenX;
    const t = Phaser.Math.Clamp((screenX - playerScreenX) / this.viewW, 0, 1);
    const screenY = this.roadTopY + t * (this.roadBotY - this.roadTopY);
    const scale = 1.0 - t * 0.6;
    // 透视道宽：远端窄近端宽
    const laneW = this.laneTopWidth + t * (this.laneBotWidth - this.laneTopWidth);
    const laneCenterOffset = (lane - (this.bp.lanes - 1) / 2) * laneW;
    const farX = this.viewW / 2 + laneCenterOffset;
    const nearX = this.laneScreenX(lane);
    obj.x = Phaser.Math.Linear(farX, nearX, 1 - t);
    obj.y = screenY - yLift;
    obj.setScale(scale);
  }

  private updateObstacles(dx: number) {
    const playerScreenX = this.playerScreenX;

    for (let i = this.obstacles.length - 1; i >= 0; i -= 1) {
      const ob = this.obstacles[i]!;
      const newX = (ob.obj.getData("screenX") as number) - dx;
      ob.obj.setData("screenX", newX);

      this.applyPerspective(ob.obj, newX, ob.lane, 25);

      // 碰撞检测：障碍接近玩家 x 时
      if (!ob.passed && Math.abs(newX - playerScreenX) < 28) {
        if (ob.lane === this.playerLane) {
          let avoided = false;
          if (ob.kind === "high" && this.isSliding) avoided = true;
          if (ob.kind === "low" && this.isJumping && this.playerY < -20) avoided = true;
          // 路障无法避，只能切道
          if (!avoided) {
            this.onHitObstacle(ob);
          }
        }
        ob.passed = true;
      }

      // 越过玩家后销毁
      if (newX < -80) {
        ob.obj.destroy();
        this.obstacles.splice(i, 1);
      }
    }
  }

  private updateCoins(dx: number) {
    const playerScreenX = this.playerScreenX;

    for (let i = this.coins.length - 1; i >= 0; i -= 1) {
      const co = this.coins[i]!;
      const newX = (co.obj.getData("screenX") as number) - dx;
      co.obj.setData("screenX", newX);

      // 金币悬空 30px
      this.applyPerspective(co.obj, newX, co.lane, 30);

      // 拾取检测
      if (!co.collected && Math.abs(newX - playerScreenX) < 24 && co.lane === this.playerLane) {
        co.collected = true;
        this.onCollectCoin(co);
        co.obj.destroy();
        this.coins.splice(i, 1);
        continue;
      }

      if (newX < -60) {
        co.obj.destroy();
        this.coins.splice(i, 1);
      }
    }
  }

  // ─── 事件 ────────────────────────────────────────────────────────────

  private onCollectCoin(co: { obj: Phaser.GameObjects.Text; lane: number }) {
    this.combo += 1;
    this.comboResetAt = this.time.now + 1500;
    const comboBonus = Math.min(this.combo, 5);
    const gained = 10 + comboBonus * 2;
    this.score += gained;
    juicePickup(this, {
      x: co.obj.x,
      y: co.obj.y,
      colorHex: themeParticleHex(this.spec),
      text: `+${gained}${this.combo > 1 ? ` x${this.combo}` : ""}`,
      textColorCss: this.cohesive.hud.body,
    });
    juiceBurst(this, co.obj.x, co.obj.y, (this.spec.theme.collectibleColor ?? "#fcd34d"), 6);
    playBleep("pickup");
    this.refreshHud();
    if (this.score >= this.winScore) {
      this.finish({ score: this.score, won: true });
    }
  }

  private onHitObstacle(ob: { obj: Phaser.GameObjects.Container; kind: string }) {
    if (this.time.now < this.invulnUntil) return;
    this.lives -= 1;
    this.combo = 0;
    this.invulnUntil = this.time.now + 1200;
    juiceHit(this, {
      x: ob.obj.x,
      y: ob.obj.y,
      colorHex: this.spec.theme.hazardColor,
      large: this.lives <= 1,
    });
    juiceFlash(this, { r: 220, g: 60, b: 60 }, { durationMs: 120 });
    this.cameras.main.shake(200, 0.008);
    playBleep("hit");
    this.soundscape?.triggerEvent("danger");
    this.refreshHud();
    if (this.lives <= 0) {
      this.finish({ score: this.score, won: false });
    }
  }

  private refreshHud() {
    this.hud.update({
      score: this.score,
      lives: this.lives,
      right: hudEndlessRunnerScore(this.uiLocale, Math.min(this.score, this.winScore), this.winScore, this.lives),
      dangerLevel: this.lives <= 1 ? 1 : 0,
    });
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    this.finished = true;
    this.hud.update({ dangerLevel: 0 });
    this.hud.setBottomHint(
      this.uiLocale === "zh-Hans"
        ? payload.won ? "通关！按 Esc 返回" : "失败！按 Esc 返回"
        : payload.won ? "Cleared! Press Esc to return" : "Failed! Press Esc to return",
    );
    if (payload.won) {
      const win = bannerEndlessRunnerWin(this.uiLocale);
      this.cameras.main.shake(300, 0.008);
      juiceWin(this, {
        x: this.player.x,
        y: this.player.y,
        colorHex: themeParticleHex(this.spec),
        text: win.title,
        textColorCss: this.cohesive.hud.accent,
      });
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
