import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import { juiceBurst, juiceFail, juiceFlash, juiceWin, themeParticleHex } from "@/game/engine/gameJuice";
import type { GameSpec } from "@/lib/game-spec";
import { buildHorrorBlueprint, type HorrorBlueprint } from "@/lib/horror-blueprint";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { showControlsHint } from "@/game/engine/controls-hint";
import { setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { hudHorrorState, bannerHorrorWin } from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

/** 单个摄像头视图的运行时状态 */
type CameraView = {
  index: number;
  /** 视图中心坐标（屏幕坐标，已 setScrollFactor(0)） */
  cx: number;
  cy: number;
  /** 视图半宽 / 半高 */
  hw: number;
  hh: number;
  /** 该摄像头内是否存在未处理的怪物 */
  monsterPresent: boolean;
  /** 怪物出现时间戳（time.now），用于计算玩家反应窗口 */
  monsterAt: number;
  /** 怪物到玩家判负的延迟（毫秒），超时未关门 → 跳脸判负 */
  monsterGraceMs: number;
  /** 当前门是否处于关闭态（消耗电力） */
  doorClosed: boolean;
  /** 门关闭到期时间戳 */
  doorUntil: number;
  /** 程序化绘制：监控底图 + 扫描线 */
  bg: Phaser.GameObjects.Rectangle;
  scanGfx: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  /** 怪物圆球（按需显隐） */
  monster: Phaser.GameObjects.Arc;
  /** 门关闭时的红色覆盖条 */
  doorBar: Phaser.GameObjects.Rectangle;
};

const REACTION_GRACE_MS = 5200; // 怪物出现后玩家有 5.2s 反应窗口
const DOOR_HOLD_MS = 1400; // 单次关门持续阻挡 1.4s
const POWER_PER_DOOR = 6; // 关一次门耗电
const POWER_PER_SWITCH = 1; // 切摄像头耗电
const POWER_DRAIN_PER_SEC = 1.2; // 监控室被动耗电（每秒）
const NIGHT_DURATION_MS = 60000; // 每夜 60 秒

export class HorrorScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private bp!: HorrorBlueprint;
  private hud!: HudFrame;

  private views: CameraView[] = [];
  private activeCam = 0;

  private night = 1;
  private nightEndAt = 0;
  private nextSpawnAt = 0;

  private power = 100;
  private powerMax = 100;
  private doorReadyAt = 0;

  private finished = false;
  private score = 0; // 撑过的夜晚数 × 100 + 剩余电力

  private key1!: Phaser.Input.Keyboard.Key;
  private key2!: Phaser.Input.Keyboard.Key;
  private key3!: Phaser.Input.Keyboard.Key;
  private key4!: Phaser.Input.Keyboard.Key;
  private key5!: Phaser.Input.Keyboard.Key;
  private key6!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  private monitorGfx!: Phaser.GameObjects.Graphics;
  private jumpscareGfx!: Phaser.GameObjects.Graphics;
  private jumpscaring = false;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("HorrorScene");
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

    this.bp = this.spec.horror ?? buildHorrorBlueprint({ spec: this.spec });
    this.powerMax = this.bp.powerMax;
    this.power = this.powerMax;

    const ui = buildSceneCohesion(this.spec);
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);

    // 暗黑监控室底色
    this.cameras.main.setBackgroundColor("#0a0d12");
    // 静态噪点
    const noiseGfx = this.add.graphics().setDepth(-5);
    for (let i = 0; i < 220; i += 1) {
      const x = Phaser.Math.Between(0, viewW);
      const y = Phaser.Math.Between(0, viewH);
      noiseGfx.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.02, 0.08));
      noiseGfx.fillPoint(x, y);
    }

    // 文生图背景（若存在）作为监控室墙画，压暗
    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      this.add
        .image(viewW / 2, viewH / 2, "bgTex")
        .setDepth(-8)
        .setAlpha(0.18)
        .setTint(0x223344);
    }

    this.monitorGfx = this.add.graphics().setDepth(2);
    this.jumpscareGfx = this.add.graphics().setDepth(400).setAlpha(0);

    // 摄像头视图网格布局：1-2 个摄像头时单行；3-4 时 2×2；5-6 时 2×3
    const cols = this.bp.cameras <= 2 ? this.bp.cameras : this.bp.cameras <= 4 ? 2 : 3;
    const rows = Math.ceil(this.bp.cameras / cols);
    const gridTop = 70;
    const gridBottom = viewH - 70;
    const gridLeft = 24;
    const gridRight = viewW - 24;
    const cellW = (gridRight - gridLeft) / cols;
    const cellH = (gridBottom - gridTop) / rows;

    for (let i = 0; i < this.bp.cameras; i += 1) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const cx = gridLeft + cellW * (c + 0.5);
      const cy = gridTop + cellH * (r + 0.5);
      const hw = cellW * 0.46;
      const hh = cellH * 0.46;

      const bg = this.add.rectangle(cx, cy, hw * 2, hh * 2, 0x0e1318, 0.92).setDepth(1);
      const scanGfx = this.add.graphics().setDepth(2);
      this.drawScanlines(scanGfx, cx, cy, hw, hh);

      const label = this.add
        .text(cx - hw + 8, cy - hh + 6, `CAM ${i + 1}`, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#7dd3fc",
        })
        .setDepth(3);

      const monster = this.add
        .circle(cx, cy, Math.min(hw, hh) * 0.32, 0xdc2626, 0.9)
        .setDepth(3)
        .setVisible(false);

      const doorBar = this.add
        .rectangle(cx, cy + hh - 8, hw * 2 - 8, 10, 0xef4444, 0)
        .setDepth(4);

      this.views.push({
        index: i,
        cx,
        cy,
        hw,
        hh,
        monsterPresent: false,
        monsterAt: 0,
        monsterGraceMs: REACTION_GRACE_MS,
        doorClosed: false,
        doorUntil: 0,
        bg,
        scanGfx,
        label,
        monster,
        doorBar,
      });

      // 怪物未出现时也加一点环境动效：标签微闪
      this.tweens.add({
        targets: label,
        alpha: { from: 0.7, to: 1 },
        duration: 900 + i * 120,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // 高亮当前摄像头
    this.highlightActiveCam();

    this.key1 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.key2 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.key3 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    this.key4 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);
    this.key5 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE);
    this.key6 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SIX);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, ui);

    this.night = 1;
    this.nightEndAt = this.time.now + NIGHT_DURATION_MS;
    this.nextSpawnAt = this.time.now + this.bp.monsterSpawnIntervalMs;

    this.refreshHud();
    setPhaserQaState({ night: this.night, power: Math.round(this.power) });
    schedulePhaserPlayReady(this, 300, { night: this.night });

    const hintLines: string[] =
      this.uiLocale === "zh-Hans"
        ? ["1-6 切换摄像头", "空格 关门（阻挡当前摄像头怪物）", "撑过 3 夜 = 胜利"]
        : ["1-6 switch camera", "Space close door (block monster)", "Survive 3 nights to win"];
    showControlsHint(this, hintLines);
  }

  private drawScanlines(g: Phaser.GameObjects.Graphics, cx: number, cy: number, hw: number, hh: number) {
    g.clear();
    // 边框
    g.lineStyle(2, 0x1e293b, 0.9);
    g.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
    // 扫描线
    g.lineStyle(1, 0x334155, 0.18);
    for (let y = cy - hh + 4; y < cy + hh; y += 4) {
      g.lineBetween(cx - hw + 1, y, cx + hw - 1, y);
    }
  }

  private highlightActiveCam() {
    for (let i = 0; i < this.views.length; i += 1) {
      const v = this.views[i]!;
      const active = i === this.activeCam;
      v.bg.setFillStyle(active ? 0x16202b : 0x0e1318, 0.92);
      v.bg.setStrokeStyle(active ? 2 : 0, 0x38bdf8, active ? 0.9 : 0);
      v.label.setColor(active ? "#bae6fd" : "#7dd3fc");
    }
  }

  private switchCam(target: number) {
    if (this.finished) return;
    if (target < 0 || target >= this.views.length) return;
    if (target === this.activeCam) return;
    this.activeCam = target;
    this.power = Math.max(0, this.power - POWER_PER_SWITCH);
    this.highlightActiveCam();
    playBleep("pickup");
    this.refreshHud();
  }

  private tryCloseDoor() {
    if (this.finished) return;
    if (this.time.now < this.doorReadyAt) return;
    const v = this.views[this.activeCam];
    if (!v) return;
    this.doorReadyAt = this.time.now + this.bp.doorCooldownMs;
    this.power = Math.max(0, this.power - POWER_PER_DOOR);
    v.doorClosed = true;
    v.doorUntil = this.time.now + DOOR_HOLD_MS;
    v.doorBar.setAlpha(0.85);
    playBleep("hit");
    // 若当前摄像头有怪物，关门即清除（阻挡成功）
    if (v.monsterPresent) {
      this.killMonster(v, true);
    }
    this.refreshHud();
  }

  private killMonster(v: CameraView, blocked: boolean) {
    v.monsterPresent = false;
    v.monster.setVisible(false);
    if (blocked) {
      juiceBurst(this, v.cx, v.cy, "#38bdf8", 10);
    }
  }

  private spawnMonster() {
    if (this.finished) return;
    // 选一个当前没有怪物的摄像头
    const free = this.views.filter((v) => !v.monsterPresent);
    if (free.length === 0) return;
    const v = Phaser.Utils.Array.GetRandom(free);
    v.monsterPresent = true;
    v.monsterAt = this.time.now;
    v.monster.setVisible(true);
    v.monster.setAlpha(0.85);
    // 怪物入场缓动
    v.monster.setScale(0.2);
    this.tweens.add({
      targets: v.monster,
      scale: 1,
      alpha: 0.95,
      duration: 350,
      ease: "Back.easeOut",
    });
    // 怪物呼吸闪烁
    this.tweens.add({
      targets: v.monster,
      alpha: { from: 0.6, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    playBleep("hit");
  }

  private refreshHud() {
    const cdLeft = Math.max(0, this.doorReadyAt - this.time.now);
    const cdStr =
      cdLeft <= 0
        ? this.uiLocale === "zh-Hans"
          ? "门就绪"
          : "Door ready"
        : this.uiLocale === "zh-Hans"
          ? `门 ${cdLeft.toFixed(1)}s`
          : `Door ${cdLeft.toFixed(1)}s`;
    const nightLabel = hudHorrorState(
      this.uiLocale,
      this.night,
      this.bp.nights,
      Math.round(this.power),
      this.activeCam + 1,
    );
    const timeLeft = Math.max(0, this.nightEndAt - this.time.now);
    const right =
      this.uiLocale === "zh-Hans"
        ? `剩余 ${(timeLeft / 1000).toFixed(1)}s`
        : `${(timeLeft / 1000).toFixed(1)}s left`;
    this.hud.update({
      score: Math.round(this.power),
      lives: this.night,
      right,
      actLabel: nightLabel,
      skill: `空格 · ${cdStr}`,
    });
  }

  private triggerJumpscare() {
    if (this.finished || this.jumpscaring) return;
    this.jumpscaring = true;
    playBleep("hit");
    juiceFlash(this, { r: 220, g: 20, b: 20 }, { durationMs: 400 });
    this.cameras.main.shake(600, 0.02);
    const g = this.jumpscareGfx;
    g.clear();
    g.fillStyle(0xdc2626, 0.85);
    g.fillRect(0, 0, this.scale.width, this.scale.height);
    g.fillStyle(0x000000, 0.9);
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    // 简易骷髅脸：两个眼眶 + 嘴
    g.fillCircle(cx - 60, cy - 30, 40);
    g.fillCircle(cx + 60, cy - 30, 40);
    g.fillRect(cx - 80, cy + 30, 160, 50);
    g.fillStyle(0xff0000, 1);
    g.fillCircle(cx - 60, cy - 30, 14);
    g.fillCircle(cx + 60, cy - 30, 14);
    this.tweens.add({
      targets: g,
      alpha: { from: 0, to: 1 },
      duration: 120,
      yoyo: true,
      hold: 600,
      onComplete: () => {
        this.finish({ score: this.score, won: false });
      },
    });
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    this.finished = true;
    this.hud.update({ dangerLevel: 0 });
    const finalScore = this.night * 100 + Math.round(this.power);
    if (payload.won) {
      const winBanner = bannerHorrorWin(this.uiLocale);
      this.hud.setBottomHint(winBanner.message);
      juiceWin(this, {
        x: this.scale.width / 2,
        y: this.scale.height / 2,
        colorHex: themeParticleHex(this.spec),
        text: winBanner.title,
        textColorCss: "#bae6fd",
      });
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    } else {
      this.hud.setBottomHint(
        this.uiLocale === "zh-Hans" ? "被怪物抓住 · 再试一次" : "Caught · Try again",
      );
      juiceFail(this, {
        x: this.scale.width / 2,
        y: this.scale.height / 2,
        colorHex: this.spec.theme.hazardColor,
        text: this.uiLocale === "zh-Hans" ? "失败" : "Fail",
        textColorCss: "#fca5a5",
      });
    }
    this.onEnd({ score: finalScore, won: payload.won });
  }

  update(_time: number, delta: number) {
    this.hud.update({});
    if (this.finished) return;

    const now = this.time.now;

    // 被动耗电
    this.power = Math.max(0, this.power - (POWER_DRAIN_PER_SEC * delta) / 1000);

    // 怪物生成
    if (now >= this.nextSpawnAt) {
      this.spawnMonster();
      // 每夜越往后，生成节奏略快
      const accel = Math.max(0.65, 1 - (this.night - 1) * 0.12);
      this.nextSpawnAt = now + this.bp.monsterSpawnIntervalMs * accel;
    }

    // 检查每个摄像头：怪物超时未关门 → 跳脸判负
    for (const v of this.views) {
      if (v.monsterPresent && now - v.monsterAt > v.monsterGraceMs) {
        // 玩家未在该摄像头关门 → 失败
        this.triggerJumpscare();
        return;
      }
      // 门关闭到期
      if (v.doorClosed && now >= v.doorUntil) {
        v.doorClosed = false;
        v.doorBar.setAlpha(0);
      }
    }

    // 电力耗尽 → 失败
    if (this.power <= 0) {
      this.power = 0;
      this.triggerJumpscare();
      return;
    }

    // 夜晚结束 → 下一夜 / 胜利
    if (now >= this.nightEndAt) {
      if (this.night >= this.bp.nights) {
        this.score = this.night * 100 + Math.round(this.power);
        this.finish({ score: this.score, won: true });
        return;
      }
      this.night += 1;
      this.nightEndAt = now + NIGHT_DURATION_MS;
      // 清空所有摄像头怪物，给玩家喘息
      for (const v of this.views) {
        if (v.monsterPresent) this.killMonster(v, false);
        v.doorClosed = false;
        v.doorBar.setAlpha(0);
      }
      this.hud.flashBanner({
        title:
          this.uiLocale === "zh-Hans"
            ? `第 ${this.night} 夜开始`
            : `Night ${this.night} begins`,
        ms: 1600,
      });
      playBleep("pickup");
    }

    // 输入
    if (Phaser.Input.Keyboard.JustDown(this.key1)) this.switchCam(0);
    if (Phaser.Input.Keyboard.JustDown(this.key2)) this.switchCam(1);
    if (Phaser.Input.Keyboard.JustDown(this.key3)) this.switchCam(2);
    if (Phaser.Input.Keyboard.JustDown(this.key4)) this.switchCam(3);
    if (this.bp.cameras >= 5 && Phaser.Input.Keyboard.JustDown(this.key5)) this.switchCam(4);
    if (this.bp.cameras >= 6 && Phaser.Input.Keyboard.JustDown(this.key6)) this.switchCam(5);
    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) this.tryCloseDoor();

    // 危险等级：场上怪物越多越红
    const danger = Math.min(1, this.views.filter((v) => v.monsterPresent).length / 3);
    this.hud.update({ dangerLevel: danger });

    setPhaserQaState({ night: this.night, power: Math.round(this.power) });
    this.refreshHud();
  }
}
