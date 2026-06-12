import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import type { GameSpec } from "@/lib/game-spec";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";
import { HudBanner } from "@/game/engine/HudBanner";
import { juiceBurst, juiceFlash, juiceFloater, juiceShake, themeParticleHex } from "@/game/engine/gameJuice";
import {
  addMinecraftBackdrop,
  ensureMinecraftEntityTextures,
  ensureMinecraftPlayerTexture,
  isMinecraftLikeSpec,
} from "@/game/engine/minecraft-visuals";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { gameEventTitle, platformerFinalSprint, playSceneBossBanner } from "@/lib/i18n/game-event-labels";
import {
  bannerActStage,
  bannerBossDefeated,
  bannerBreathingEnd,
  bannerEliteAssault,
  bannerEventEnd,
  bannerFinalBarrageEnd,
  bannerGoalComplete,
  bannerGoalFailed,
  bannerGoldenWindowEnd,
  bannerLastStand,
  bannerLastStandEnd,
  bannerSurvivorGrit,
  hudActChapter,
  hudCooldown,
  hudDodgeStreak,
  hudFinalWaveSec,
  hudGoalShift,
  hudLives,
  hudProgress,
  hudReady,
  hudScore,
  playFinishText,
  survivorLastStandReason,
  survivorFinalChapterReason,
  bossPhaseLabel,
  floaterCombo,
  floaterGolden,
  floaterRisk,
  floaterNearMiss,
  floaterBossKill,
  hudControlsPlayCollector,
  hudControlsPlayAvoider,
  hudControlsShiftSuffix,
  playStageMessage,
} from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };
type DirectorEvent = NonNullable<NonNullable<GameSpec["director"]>["events"]>[number];

export class PlayScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;

  private readonly onEnd: (r: EndPayload) => void;

  private readonly soundscape: GameSoundscape | null;

  private player!: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;

  private hazards!: Phaser.Physics.Arcade.Group;

  private collectibles!: Phaser.Physics.Arcade.Group;

  private powerups!: Phaser.Physics.Arcade.Group;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private keyW!: Phaser.Input.Keyboard.Key;

  private keyA!: Phaser.Input.Keyboard.Key;

  private keyS!: Phaser.Input.Keyboard.Key;

  private keyD!: Phaser.Input.Keyboard.Key;

  private keyShift!: Phaser.Input.Keyboard.Key;

  private score = 0;

  private lives = 3;

  private scoreText!: Phaser.GameObjects.Text;

  private livesText!: Phaser.GameObjects.Text | null;

  private progressText!: Phaser.GameObjects.Text;

  private hintText!: Phaser.GameObjects.Text;

  private actText!: Phaser.GameObjects.Text;

  private skillText!: Phaser.GameObjects.Text;

  private skillCdText!: Phaser.GameObjects.Text;

  private shieldRing!: Phaser.GameObjects.Graphics;

  private banner!: HudBanner;

  private cohesive!: CohesivePresentation;

  private dangerVignette: Phaser.GameObjects.Graphics | null = null;

  private spawnTimer!: Phaser.Time.TimerEvent;

  private powerupTimer!: Phaser.Time.TimerEvent;

  private finished = false;

  private invulnUntil = 0;

  private pad = 40;

  private winScore = 40;

  private intensity = 0.58;

  private actIndex = 0;

  private lastActUpdate = 0;

  private scoreMult = 1;

  private shieldCharges = 0;

  private magnetUntil = 0;

  private skillReadyAt = 0;

  private slowUntil = 0;

  private lastWorldTimeScale = 1;

  private eventIndex = 0;

  private eventUntil = 0;

  private eventType: string | null = null;

  private eventStrength = 0;

  private coinRainUntil = 0;

  private miniBossUntil = 0;

  private goalShiftUntil = 0;

  private goalShiftNeed = 0;

  private goalShiftHave = 0;

  private goalShiftSucceeded = false;

  private goalText!: Phaser.GameObjects.Text;

  /** survivor：连续成功躲避（障碍落出屏）未受伤 */
  private survivorDodgeStreak = 0;

  /** collector：短时间内连续拾取形成 combo，受伤清零 */
  private collectorCombo = 0;

  private lastCollectorPickupAt = 0;

  /** survivor：最后一波倒计时窗口（默认自动触发一次） */
  private survivorLastStandUntil = 0;

  private survivorLastStandStarted = false;

  private survivorLastStandRewarded = false;

  /** avoider：近距离擦弹连击 */
  private avoiderNearMissChain = 0;

  private avoiderLastNearMissAt = 0;

  /** avoider：终局密集弹幕倒计时 */
  private avoiderFinalBarrageUntil = 0;

  /** collector：黄金收集物窗口 */
  private goldenPickupUntil = 0;

  /** survivor：喘息窗口（低压段） */
  private breathingRoomUntil = 0;

  // ── Boss 系统 ──
  private bossActive = false;
  private bossSprite: Phaser.Physics.Arcade.Image | null = null;
  private bossHp = 0;
  private bossMaxHp = 0;
  private bossPhase = 0;
  private bossHealthBar: Phaser.GameObjects.Graphics | null = null;
  private bossHealthBarBg: Phaser.GameObjects.Graphics | null = null;
  private bossAttackUntil = 0;
  private bossAttackTimer: Phaser.Time.TimerEvent | null = null;
  private bossRageUntil = 0;
  private bossInvulnUntil = 0;
  private bossOrbs!: Phaser.Physics.Arcade.Group;
  /** 敌兵类型：0=normal 1=fast 2=heavy */
  private hazardType = 0;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("PlayScene");
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape ?? null;
  }

  preload() {
    if (this.backgroundUrl) {
      this.load.image("bgTex", this.backgroundUrl);
    }
    // 尝试加载文生图 sprite（不存在时静默回退几何体）
    if (this.projectId) {
      const base = `/game-sprites/${this.projectId}`;
      this.load.image("texPlayer", `${base}/player.png`);
      this.load.image("texHazard", `${base}/hazard.png`);
      this.load.image("texGem", `${base}/gem.png`);
      this.load.image("texPower", `${base}/power.png`);
      this.load.image("texBoss", `${base}/boss.png`);
    }
  }

  create() {
    const { width, height } = this.scale;
    this.pad = this.spec.gameplay.arenaPadding ?? 40;
    this.winScore = this.spec.gameplay.winScore ?? 40;
    this.lives = this.spec.gameplay.lives ?? 3;
    this.intensity = this.spec.director?.intensity ?? 0.58;

    const ui = buildCohesivePresentation(this.spec);
    setBleepTemperament(ui.bleepTemperament);
    this.cohesive = ui;

    const blockyWorld = isMinecraftLikeSpec(this.spec);
    if (blockyWorld) {
      addMinecraftBackdrop(this);
    } else {
      this.addStarfield();
    }

    // 文生图背景（异步生成，不存在时静默回退）
    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      this.add.image(width / 2, height / 2, "bgTex").setDepth(-10).setAlpha(0.12);
    }

    this.add
      .text(width / 2, 22, this.spec.title, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "21px",
        color: ui.hud.title,
      })
      .setOrigin(0.5)
      .setDepth(20);

    if (this.spec.labels.subtitle) {
      this.add
        .text(width / 2, 48, this.spec.labels.subtitle, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "12px",
          color: ui.hud.subtitle,
        })
        .setOrigin(0.5)
        .setDepth(20);
    }

    this.scoreText = this.add
      .text(18, 14, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "17px",
        color: ui.hud.body,
      })
      .setDepth(25);

    this.progressText = this.add
      .text(width - 18, 14, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: ui.hud.accent2,
      })
      .setOrigin(1, 0)
      .setDepth(25);

    this.actText = this.add
      .text(width / 2, 68, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: ui.hud.muted,
      })
      .setOrigin(0.5, 0)
      .setDepth(25);

    const showLives =
      this.spec.templateId === "survivor" || this.spec.templateId === "collector";
    this.livesText = showLives
      ? this.add
          .text(18, 44, hudLives(this.uiLocale, this.lives), {
            fontFamily: "system-ui, sans-serif",
            fontSize: "14px",
            color: ui.hud.danger,
          })
          .setDepth(25)
      : null;

    const controls =
      this.spec.templateId === "collector"
        ? hudControlsPlayCollector(
            this.uiLocale,
            this.spec.labels.collectible ?? "collectible",
            this.spec.labels.hazard,
          )
        : hudControlsPlayAvoider(this.uiLocale, this.spec.labels.hazard);

    this.hintText = this.add
      .text(width / 2, height - 20, `${controls}${hudControlsShiftSuffix(this.uiLocale)}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: ui.hud.hint,
      })
      .setOrigin(0.5)
      .setDepth(25);

    const shiftCol = (c: number, d: number) => {
      const r = Phaser.Math.Clamp(((c >> 16) & 0xff) + d, 0, 255);
      const g2 = Phaser.Math.Clamp(((c >> 8) & 0xff) + d, 0, 255);
      const b = Phaser.Math.Clamp((c & 0xff) + d, 0, 255);
      return (r << 16) | (g2 << 8) | b;
    };

    if (blockyWorld) {
      ensureMinecraftPlayerTexture(this, this.spec);
      ensureMinecraftEntityTextures(this, this.spec);
    }

    // Player: rounded body + highlight + eyes
    if (!blockyWorld && !this.textures.exists("texPlayer")) {
      const pc = parseInt(this.spec.theme.playerColor.replace("#", ""), 16);
      const pd = shiftCol(pc, -55);
      const pl = shiftCol(pc, 50);
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x000000, 0.18); g.fillEllipse(19, 37, 28, 7); // shadow
      g.lineStyle(2.5, pd, 1); g.strokeRoundedRect(4, 6, 28, 28, 9);
      g.fillStyle(pc, 1); g.fillRoundedRect(4, 6, 28, 28, 9);
      g.fillStyle(pl, 0.4); g.fillRoundedRect(7, 8, 18, 9, 4); // highlight
      g.fillStyle(0x0f172a, 1); g.fillCircle(13, 18, 4); g.fillCircle(23, 18, 4); // eyes
      g.fillStyle(0xffffff, 0.75); g.fillCircle(14.2, 16.8, 1.5); g.fillCircle(24.2, 16.8, 1.5);
      g.fillStyle(pd, 1); g.fillRoundedRect(8, 32, 8, 5, 2); g.fillRoundedRect(20, 32, 8, 5, 2); // feet
      g.generateTexture("texPlayer", 36, 38); g.destroy();
    }

    // Hazard: angular menacing enemy with spiky silhouette
    if (!blockyWorld && !this.textures.exists("texHazard")) {
      const hc = parseInt(this.spec.theme.hazardColor.replace("#", ""), 16);
      const hd = shiftCol(hc, -55);
      const hl = shiftCol(hc, 45);
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x000000, 0.2); g.fillEllipse(22, 43, 30, 8); // shadow
      // Spiky crown
      g.fillStyle(hd, 1);
      g.fillTriangle(10, 14, 14, 2, 18, 14);
      g.fillTriangle(18, 14, 22, 0, 26, 14);
      g.fillTriangle(26, 14, 30, 2, 34, 14);
      // Body
      g.lineStyle(2.5, hd, 1); g.strokeRoundedRect(6, 12, 32, 26, 8);
      g.fillStyle(hc, 1); g.fillRoundedRect(6, 12, 32, 26, 8);
      g.fillStyle(hl, 0.3); g.fillRoundedRect(9, 14, 22, 9, 4);
      // Angry eyes
      g.fillStyle(0xfef3c7, 1); g.fillEllipse(15, 24, 10, 8); g.fillEllipse(29, 24, 10, 8);
      g.fillStyle(0x1a0000, 1); g.fillCircle(16, 25, 3.5); g.fillCircle(30, 25, 3.5);
      g.fillStyle(0xff3333, 0.7); g.fillCircle(16, 25, 1.8); g.fillCircle(30, 25, 1.8);
      g.generateTexture("texHazard", 44, 44); g.destroy();
    }

    // Gem: diamond with shine
    if (!this.textures.exists("texGem")) {
      const gc = parseInt((this.spec.theme.collectibleColor ?? this.spec.theme.playerColor).replace("#", ""), 16);
      const gd = shiftCol(gc, -50);
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(gc, 0.92);
      g.fillTriangle(14, 0, 27, 11, 14, 27); g.fillTriangle(14, 0, 1, 11, 14, 27);
      g.lineStyle(1.5, gd, 0.8);
      g.strokeTriangle(14, 0, 27, 11, 14, 27); g.strokeTriangle(14, 0, 1, 11, 14, 27);
      g.fillStyle(0xffffff, 0.6); g.fillTriangle(14, 1, 5, 10, 14, 10);
      g.generateTexture("texGem", 28, 28); g.destroy();
    }

    // Power-up: star shape
    if (!this.textures.exists("texPower")) {
      const pc2 = parseInt((this.spec.theme.collectibleColor ?? this.spec.theme.playerColor).replace("#", ""), 16);
      const g = this.make.graphics({ x: 0, y: 0 });
      const cx = 13, cy = 13, r1 = 12, r2 = 5.5, pts = 5;
      g.fillStyle(pc2, 0.95);
      g.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const ang = (i * Math.PI) / pts - Math.PI / 2;
        const r = i % 2 === 0 ? r1 : r2;
        if (i === 0) g.moveTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
        else g.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
      }
      g.closePath(); g.fillPath();
      g.fillStyle(0xffffff, 0.5); g.fillCircle(cx - 3, cy - 3, 4);
      g.generateTexture("texPower", 26, 26); g.destroy();
    }

    // Boss: larger menacing version, red-tinted
    if (!this.textures.exists("texBoss")) {
      const hc = parseInt(this.spec.theme.hazardColor.replace("#", ""), 16);
      const hd = shiftCol(hc, -40);
      const g = this.make.graphics({ x: 0, y: 0 });
      const w = 64, h2 = 64;
      g.fillStyle(0x000000, 0.35); g.fillEllipse(w / 2, h2 - 4, w - 8, 14);
      // Horns
      g.fillStyle(0x330000, 0.7);
      g.fillTriangle(12, 0, 0, 28, 24, 20);
      g.fillTriangle(w - 12, 0, w, 28, w - 24, 20);
      // Body
      g.lineStyle(3, hd, 1); g.strokeRoundedRect(10, 16, w - 20, h2 - 26, 12);
      g.fillStyle(hc, 1); g.fillRoundedRect(10, 16, w - 20, h2 - 26, 12);
      // Glowing eyes
      g.fillStyle(0xff3333, 1); g.fillCircle(18, 30, 6); g.fillCircle(w - 18, 30, 6);
      g.fillStyle(0xffff00, 0.85); g.fillCircle(18, 30, 2.5); g.fillCircle(w - 18, 30, 2.5);
      // Scar
      g.lineStyle(2, 0x440000, 0.7);
      g.lineBetween(28, 20, 36, 28);
      g.generateTexture("texBoss", w, h2); g.destroy();
    }

    // Enemy variety: fast zigzag hazard (small, angular)
    if (!this.textures.exists("texHazardFast")) {
      const hc = parseInt(this.spec.theme.hazardColor.replace("#", ""), 16);
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(hc, 0.85);
      g.fillTriangle(12, 0, 24, 22, 0, 22);
      g.fillStyle(0xff3333, 0.7); g.fillCircle(12, 12, 3);
      g.generateTexture("texHazardFast", 24, 24); g.destroy();
    }

    // Enemy variety: heavy tank hazard (big, slow)
    if (!this.textures.exists("texHazardHeavy")) {
      const hc = parseInt(this.spec.theme.hazardColor.replace("#", ""), 16);
      const hd = shiftCol(hc, -60);
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x000000, 0.2); g.fillEllipse(19, 35, 32, 10);
      g.lineStyle(3, hd, 1); g.strokeRoundedRect(2, 4, 34, 30, 8);
      g.fillStyle(hc, 0.9); g.fillRoundedRect(2, 4, 34, 30, 8);
      g.fillStyle(0x440000, 0.5); g.fillRoundedRect(5, 8, 28, 12, 4);
      g.fillStyle(0xff3333, 0.7); g.fillCircle(10, 16, 3.5); g.fillCircle(28, 16, 3.5);
      g.generateTexture("texHazardHeavy", 38, 38); g.destroy();
    }

    const startX = width / 2;
    const startY =
      this.spec.templateId === "collector" ? height / 2 : height - this.pad;

    this.player = this.physics.add.image(startX, startY, "texPlayer");
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(30, 30);
    this.player.setDepth(5);

    this.hazards = this.physics.add.group();
    this.collectibles = this.physics.add.group();
    this.powerups = this.physics.add.group();
    this.bossOrbs = this.physics.add.group();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyShift = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.shieldRing = this.add.graphics();
    this.shieldRing.setDepth(24);

    this.banner = new HudBanner(this, ui.banner);

    this.physics.add.overlap(this.player, this.hazards, (_p, h) => {
      if (this.finished) return;
      if (this.spec.templateId === "survivor" && this.time.now < this.invulnUntil) return;
      const hazard = h as Phaser.Physics.Arcade.Image;
      // 重型敌人需要多次击杀
      const hp: number = hazard.getData("hp") ?? 1;
      if (hp > 1 && this.shieldCharges < 1) {
        hazard.setData("hp", hp - 1);
        juiceFlash(this, { r: 255, g: 100, b: 80 }, { durationMs: 70 });
        hazard.setTint(0xff8888);
        this.time.delayedCall(120, () => { if (hazard.active) hazard.clearTint(); });
        return;
      }
      hazard.destroy();
      if (this.shieldCharges > 0) {
        this.shieldCharges -= 1;
        this.fxShield();
        this.refreshHud();
        return;
      }
      this.fxDamage();
      this.hitHazard();
    });

    this.physics.add.overlap(this.player, this.collectibles, (_p, gem) => {
      if (this.finished) return;
      const g = gem as Phaser.Physics.Arcade.Image;
      const gx = g.x;
      const gy = g.y;
      const riskBonus = Number(g.getData("riskBonus") ?? 0);
      const goldenBonus = Number(g.getData("goldenBonus") ?? 0);
      g.destroy();
      this.fxCollect(gx, gy);
      let comboBonus = 0;
      if (this.spec.templateId === "collector") {
        const now = this.time.now;
        const windowMs = 1350;
        if (now - this.lastCollectorPickupAt <= windowMs && this.lastCollectorPickupAt > 0) {
          this.collectorCombo = Math.min(12, this.collectorCombo + 1);
        } else {
          this.collectorCombo = 1;
        }
        this.lastCollectorPickupAt = now;
        comboBonus = Math.min(this.collectorCombo - 1, 5);
        if (comboBonus > 0) {
          this.showFloater(gx, gy - 22, floaterCombo(this.uiLocale, this.collectorCombo), this.cohesive.hud.accent2);
        }
      }
      this.score += 1 * this.scoreMult + comboBonus + riskBonus + goldenBonus;
      if (goldenBonus > 0) {
        this.showFloater(gx, gy - 38, floaterGolden(this.uiLocale, goldenBonus), "#ffd700");
        juiceFlash(this, { r: 255, g: 220, b: 80 }, { durationMs: 100 });
        playBleep("pickup");
      }
      if (riskBonus > 0 && this.spec.templateId === "collector") {
        this.showFloater(gx, gy - 38, floaterRisk(this.uiLocale, riskBonus), this.cohesive.hud.danger);
        const { width, height } = this.scale;
        const margin = 80;
        for (let i = 0; i < 2; i += 1) {
          const hx = Phaser.Math.Clamp(gx + Phaser.Math.Between(-100, 100), margin, width - margin);
          const hy = Phaser.Math.Clamp(gy + Phaser.Math.Between(-90, 90), 110, height - 110);
          this.spawnHazard(hx, hy);
        }
        juiceShake(this, { durationMs: 160, intensity: 0.006 });
        juiceBurst(this, gx, gy, themeParticleHex(this.spec), 10);
      }
      if (this.time.now < this.goalShiftUntil) {
        this.goalShiftHave += 1;
        if (!this.goalShiftSucceeded && this.goalShiftHave >= this.goalShiftNeed) {
          this.goalShiftSucceeded = true;
          const bonus = Math.max(3, Math.floor(4 + this.eventStrength * 4));
          this.score += bonus;
          this.banner.show({ ...bannerGoalComplete(this.uiLocale, bonus), ms: 1600 });
        }
      }
      this.refreshHud();
      if (this.score >= this.winScore) {
        this.finish({ score: this.score, won: true });
      }
    });

    this.physics.add.overlap(this.player, this.powerups, (_p, pu) => {
      if (this.finished) return;
      const s = pu as Phaser.Physics.Arcade.Image;
      const kind = String(s.getData("kind") ?? "");
      const x = s.x;
      const y = s.y;
      s.destroy();
      this.applyPowerup(kind);
      this.fxCollect(x, y);
    });

    this.physics.add.collider(this.hazards, this.powerups);

    const interval = this.spec.gameplay.spawnIntervalMs;
    this.spawnTimer = this.time.addEvent({
      delay: Math.max(240, Math.floor(interval * (1 - this.intensity * 0.18))),
      loop: true,
      callback: () => this.spawnWave(),
    });

    // Boss orb hits player: damages boss if shield active
    this.physics.add.overlap(this.player, this.bossOrbs, (_p, orb) => {
      if (this.finished || !this.bossActive) return;
      const o = orb as Phaser.Physics.Arcade.Image;
      o.destroy();
      if (this.shieldCharges > 0) {
        this.shieldCharges -= 1;
        this.fxShield();
        this.damageBoss();
        this.refreshHud();
      } else {
        this.fxDamage();
        this.hitHazard();
      }
    });

    this.powerupTimer = this.time.addEvent({
      delay: Math.max(1800, Math.floor(5200 - this.intensity * 2200)),
      loop: true,
      callback: () => this.spawnPowerup(),
    });

    const skillName = this.spec.systems?.skill?.name ?? "技能";
    this.skillText = this.add
      .text(18, height - 56, `Shift · ${skillName}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: ui.hud.body,
      })
      .setDepth(26);
    this.skillCdText = this.add
      .text(18, height - 38, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: ui.hud.muted,
      })
      .setDepth(26);

    this.goalText = this.add
      .text(width / 2, 64, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: ui.hud.accent,
      })
      .setOrigin(0.5, 0)
      .setDepth(26);

    this.refreshHud();
    this.spawnWave();

    // Danger vignette overlay (hidden until low HP)
    this.dangerVignette = this.add.graphics();
    this.dangerVignette.setDepth(24);
    this.dangerVignette.setAlpha(0);
    this.dangerVignette.fillStyle(0xff2233, 1);
    this.dangerVignette.fillRect(0, 0, width, height);
  }

  private addStarfield() {
    const { width, height } = this.scale;
    const raw = this.spec.theme.particleTint?.replace("#", "") ?? "69746c";
    const parsed = parseInt(raw, 16);
    const tint = Number.isFinite(parsed) ? parsed : 0xa78bfa;
    for (let i = 0; i < 96; i += 1) {
      const x = Phaser.Math.Between(4, width - 4);
      const y = Phaser.Math.Between(4, height - 4);
      const s = Phaser.Math.FloatBetween(1, 2.4);
      const a = Phaser.Math.FloatBetween(0.06, 0.35);
      const dot = this.add.rectangle(x, y, s, s, tint, a);
      dot.setDepth(-12);
    }
  }

  private refreshHud() {
    this.scoreText.setText(hudScore(this.uiLocale, this.score));
    const prog = Math.min(this.score, this.winScore);
    this.progressText.setText(hudProgress(this.uiLocale, this.spec.templateId, prog, this.winScore));

    const acts = this.spec.director?.acts ?? null;
    const label = acts?.[this.actIndex]?.label;
    this.actText.setText(label ? hudActChapter(this.uiLocale, label) : "");

    const cdLeft = Math.max(0, this.skillReadyAt - this.time.now);
    if (cdLeft <= 0) {
      this.skillCdText.setText(hudReady(this.uiLocale));
    } else {
      this.skillCdText.setText(hudCooldown(this.uiLocale, (cdLeft / 1000).toFixed(1)));
    }

    this.drawShieldRing();

    const now = this.time.now;
    if (now < this.goalShiftUntil) {
      this.goalText.setText(hudGoalShift(this.uiLocale, this.goalShiftHave, this.goalShiftNeed));
      this.goalText.setAlpha(1);
    } else if (this.spec.templateId === "survivor" && this.survivorLastStandUntil > now) {
      const sec = Math.max(1, Math.ceil((this.survivorLastStandUntil - now) / 1000));
      this.goalText.setText(hudFinalWaveSec(this.uiLocale, sec));
      this.goalText.setAlpha(1);
    } else if (this.spec.templateId === "survivor" && this.survivorDodgeStreak >= 3) {
      this.goalText.setText(hudDodgeStreak(this.uiLocale, this.survivorDodgeStreak));
      this.goalText.setAlpha(1);
    } else {
      this.goalText.setText("");
      this.goalText.setAlpha(0.85);
    }
  }

  private fxCollect(x: number, y: number) {
    juiceBurst(this, x, y, themeParticleHex(this.spec), 14);
    juiceFloater(this, x, y - 14, "+1", this.cohesive.hud.body);
    juiceFlash(this, { r: 180, g: 160, b: 255 }, { durationMs: 120 });
    playBleep("pickup");
    this.soundscape?.triggerKillStinger();
  }

  private fxDamage() {
    juiceShake(this, { durationMs: 140, intensity: 0.0045 });
    juiceFlash(this, { r: 255, g: 90, b: 90 }, { durationMs: 160 });
    playBleep("hit");
  }

  private fxShield() {
    juiceFlash(this, { r: 120, g: 120, b: 255 }, { durationMs: 120 });
    playBleep("pickup");
  }

  private spawnWave() {
    if (this.finished) return;
    const { width } = this.scale;
    const margin = 80;
    const mods = this.getActModifiers();
    const isFinale = mods.includes("finale");
    const isDoubleSpawn = mods.includes("doubleSpawn");
    const extraHazards = isFinale ? 2 : isDoubleSpawn ? 1 : 0;

    this.updateAct();
    this.tickDirectorEvents();

    if (this.spec.templateId === "collector") {
      const collectibleBursts = isFinale ? 2 : this.time.now < this.goalShiftUntil ? 2 : 1;
      const isBonusField = mods.includes("bonusField");
      for (let i = 0; i < collectibleBursts; i += 1) {
        if (Phaser.Math.Between(0, 1) === 0 || isFinale || isBonusField) {
          this.spawnCollectible(
            Phaser.Math.Between(margin, width - margin),
            Phaser.Math.Between(120, this.scale.height - 120),
          );
        }
      }
      // bonusField 章节：额外刷一个普通收集物
      if (isBonusField && Phaser.Math.Between(0, 1) === 0) {
        this.spawnCollectible(
          Phaser.Math.Between(margin, width - margin),
          Phaser.Math.Between(120, this.scale.height - 120),
        );
      }
      if (this.time.now < this.coinRainUntil && Phaser.Math.Between(0, 2) !== 0) {
        this.spawnCollectible(
          Phaser.Math.Between(margin, width - margin),
          Phaser.Math.Between(120, this.scale.height - 120),
        );
      }
      for (let i = 0; i <= extraHazards; i += 1) {
        this.spawnHazard(
          Phaser.Math.Between(margin, width - margin),
          Phaser.Math.Between(120, this.scale.height - 120),
        );
      }
      if (this.time.now < this.miniBossUntil && Phaser.Math.Between(0, 1) === 0) {
        this.spawnEliteHazard();
      }
      if (isFinale && Phaser.Math.Between(0, 1) === 0) {
        this.spawnEliteHazard();
      }
      if (
        this.countRiskCollectiblesOnField() < 2 &&
        (isFinale || Phaser.Math.Between(0, 16) === 0) &&
        Phaser.Math.Between(0, 2) === 0 &&
        this.time.now > 2200
      ) {
        this.spawnRiskCollectible();
      }
      return;
    }

    for (let i = 0; i <= extraHazards; i += 1) {
      const x = Phaser.Math.Between(margin, width - margin);
      const y = -40 - i * 28;
      this.spawnHazard(x, y);
    }

    if (this.time.now < this.coinRainUntil && Phaser.Math.Between(0, 1) === 0) {
      this.spawnPowerup();
    }
    if (this.time.now < this.miniBossUntil && Phaser.Math.Between(0, 1) === 0) {
      this.spawnEliteHazard();
    }
    if (this.spec.templateId === "survivor" && (isFinale || this.lives <= 2) && Phaser.Math.Between(0, 2) === 0) {
      this.spawnPowerup();
    }
    // survivor 喘息窗口：降低刷怪密度，额外补充道具
    if (this.spec.templateId === "survivor" && this.time.now < this.breathingRoomUntil) {
      if (Phaser.Math.Between(0, 2) === 0) this.spawnPowerup();
      return; // 跳过本轮额外刷怪
    }
    if (this.spec.templateId === "avoider" && isFinale && Phaser.Math.Between(0, 2) !== 0) {
      this.spawnEliteHazard();
    }
    // avoider 终局弹幕：持续高密度刷精英
    if (this.spec.templateId === "avoider" && this.time.now < this.avoiderFinalBarrageUntil) {
      this.spawnEliteHazard();
      if (Phaser.Math.Between(0, 1) === 0) this.spawnEliteHazard();
    }
    if (this.spec.templateId === "survivor" && this.time.now < this.survivorLastStandUntil && Phaser.Math.Between(0, 2) === 0) {
      const x = Phaser.Math.Between(margin, width - margin);
      const y = -40 - Phaser.Math.Between(0, 40);
      this.spawnHazard(x, y);
    }
  }

  private spawnEliteHazard() {
    const { width } = this.scale;
    const collectorMode = this.spec.templateId === "collector";
    const x = Phaser.Math.Between(90, width - 90);
    const y = collectorMode ? Phaser.Math.Between(100, this.scale.height - 100) : -70;
    const h = this.hazards.create(x, y, "texHazard");
    h.setDepth(6);
    h.setScale(collectorMode ? 1.42 : 1.55);
    h.setAlpha(0.9);
    h.setVelocity(
      Phaser.Math.Between(-110, 110),
      collectorMode
        ? Phaser.Math.Between(-120, 120)
        : Math.floor(this.spec.gameplay.hazardSpeed * (1.25 + this.eventStrength * 0.25)),
    );
    const body = h.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setBounce(1, 1);
    body.setAngularVelocity(Phaser.Math.Between(-220, 220));
  }

  private tickDirectorEvents() {
    const now = this.time.now;
    this.banner.tick();

    if (this.eventType && now >= this.eventUntil) {
      // 事件结束
      if (this.eventType === "coinRain") this.scoreMult = 1;
      if (this.eventType === "goalShift") this.scoreMult = 1;
      if (this.eventType === "goalShift" && !this.goalShiftSucceeded) {
        this.banner.show({ ...bannerGoalFailed(this.uiLocale), ms: 1500 });
      } else if (this.eventType === "finalBarrage") {
        // avoider 终局弹幕结束 → 直接胜利
        if (!this.finished) {
          const bonus = Math.max(4, Math.floor(5 + this.eventStrength * 5));
          this.score += bonus;
          this.banner.show({ ...bannerFinalBarrageEnd(this.uiLocale, bonus), ms: 1800 });
          playBleep("pickup");
          this.refreshHud();
          if (this.score >= this.winScore) {
            this.finish({ score: this.score, won: true });
          }
        }
      } else if (this.eventType === "goldenPickup") {
        this.banner.show({ ...bannerGoldenWindowEnd(this.uiLocale), ms: 1200 });
      } else if (this.eventType === "breathingRoom") {
        this.banner.show({ ...bannerBreathingEnd(this.uiLocale), ms: 1200 });
      } else {
        this.banner.show({ ...bannerEventEnd(this.uiLocale, "play"), ms: 1400 });
      }
      this.eventType = null;
      this.eventUntil = 0;
      this.eventStrength = 0;
      this.refreshHud();
    }

    const events = this.spec.director?.events ?? [];
    if (!events.length) return;

    const t = this.winScore > 0 ? Phaser.Math.Clamp(this.score / this.winScore, 0, 1) : 0;
    while (this.eventIndex < events.length) {
      const ev = events[this.eventIndex];
      if (!ev) break;
      if (t < ev.at) break;
      this.eventIndex += 1;
      this.startEvent(ev);
    }
  }

  private startEvent(ev: DirectorEvent) {
    const now = this.time.now;
    const strength = ev.strength ?? 0.6;
    const durationMs = ev.durationMs ?? 3500;
    const title = gameEventTitle(this.uiLocale, ev.type, this.spec.templateId);
    const message = ev.message ?? "";

    this.eventType = ev.type;
    this.eventStrength = strength;
    this.eventUntil = now + durationMs;

    this.banner.show({ title, message, ms: Math.min(2600, Math.max(1200, durationMs - 200)) });

    if (ev.type === "coinRain") {
      this.coinRainUntil = this.eventUntil;
      this.scoreMult = 2;
      return;
    }

    if (ev.type === "miniBoss") {
      this.miniBossUntil = this.eventUntil;
      this.spawnBoss(strength);
      return;
    }

    if (ev.type === "goalShift") {
      this.goalShiftUntil = this.eventUntil;
      this.scoreMult = 2;
      this.goalShiftNeed =
        this.spec.templateId === "collector"
          ? Math.max(4, Math.floor(5 + strength * 5))
          : Math.max(5, Math.floor(6 + strength * 6));
      this.goalShiftHave = 0;
      this.goalShiftSucceeded = false;
      return;
    }

    if (ev.type === "finalBarrage") {
      // avoider 专属：终局密集弹幕倒计时
      this.avoiderFinalBarrageUntil = this.eventUntil;
      this.soundscape?.triggerEvent("danger");
      juiceShake(this, { durationMs: 220, intensity: 0.012 });
      this.startDangerVignette();
      return;
    }

    if (ev.type === "goldenPickup") {
      // collector 专属：生成黄金收集物
      this.spawnGoldenPickup();
      this.goldenPickupUntil = this.eventUntil;
      return;
    }

    if (ev.type === "breathingRoom") {
      // survivor 专属：喘息窗口，降低刷怪密度
      this.breathingRoomUntil = this.eventUntil;
      return;
    }

    // 其它 type：仅横幅与时间轴，不产生数值副作用（结束逻辑走通用分支）
  }

  private updateAct() {
    const now = this.time.now;
    if (now - this.lastActUpdate < 160) return;
    this.lastActUpdate = now;
    const acts = this.spec.director?.acts ?? null;
    if (!acts?.length) return;
    const t = this.winScore > 0 ? Phaser.Math.Clamp(this.score / this.winScore, 0, 1) : 0;
    let idx = 0;
    for (let i = 0; i < acts.length; i += 1) {
      if (acts[i] && t >= acts[i]!.at) idx = i;
    }
    if (idx !== this.actIndex) {
      this.actIndex = idx;
      const label = acts[idx]?.label ?? "";
      const mods = acts[idx]?.modifiers ?? [];
      this.actText.setText(label ? hudActChapter(this.uiLocale, label) : "");
      const mod = mods.includes("finale")
        ? "finale"
        : mods.includes("bonusField")
          ? "bonusField"
          : mods.includes("doubleSpawn")
            ? "doubleSpawn"
            : "default";
      const stageMessage = playStageMessage(this.uiLocale, this.spec.templateId, mod);
      if (mods.includes("finale")) {
        this.soundscape?.triggerEvent("boss");
        juiceShake(this, { durationMs: 180, intensity: 0.008 });
        if (this.spec.templateId === "survivor") {
          this.startSurvivorLastStand(survivorFinalChapterReason(this.uiLocale));
        }
      }
      this.banner.show({ ...bannerActStage(this.uiLocale, label || undefined, stageMessage), ms: 1400 });
      juiceFlash(this, { r: 140, g: 120, b: 255 }, { durationMs: 90 });
      // Dynamic music: increase tension as act progresses
      const tension = this.intensity * (0.5 + 0.5 * (idx / Math.max(1, acts.length - 1)));
      this.soundscape?.setTension(tension);
      const sections = ["intro", "build", "drop", "climax"] as const;
      this.soundscape?.setSection(sections[idx] ?? "intro");
    }
  }

  private spawnHazard(x: number, y: number) {
    // 敌兵多样性：normal / fast / heavy
    const roll = Phaser.Math.Between(0, 100);
    const mods = this.getActModifiers();
    const finale = mods.includes("finale");
    let texKey = "texHazard";
    let scale = 1;
    let speedMod = 1;

    if (finale && roll < 30) {
      texKey = "texHazardHeavy"; scale = 1.15; speedMod = 0.7;
    } else if (this.intensity > 0.5 && roll < 25) {
      texKey = "texHazardFast"; scale = 0.75; speedMod = 1.45;
    }

    const h = this.hazards.create(x, y, texKey);
    h.setDepth(4);
    h.setScale(scale);
    const zigzag = mods.includes("zigzag");
    const collectorMode = this.spec.templateId === "collector";

    h.setVelocity(
      collectorMode
        ? zigzag || finale
          ? Phaser.Math.Between(-140, 140)
          : Phaser.Math.Between(-90, 90)
        : zigzag
          ? Phaser.Math.Between(-120, 120)
          : Phaser.Math.Between(-50, 50),
      collectorMode
        ? finale
          ? Phaser.Math.Between(-140, 140)
          : Phaser.Math.Between(-90, 90)
        : Math.floor(this.spec.gameplay.hazardSpeed * (1 + this.intensity * (finale ? 0.34 : 0.22)) * speedMod),
    );
    const body = h.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setBounce(1, 1);
    if (!collectorMode) {
      body.setAngularVelocity(Phaser.Math.Between(-120, 120));
    } else if (finale) {
      h.setScale(1.12);
      h.setAlpha(0.96);
    }
    // 重型敌人更多血量（需多次击杀）
    if (texKey === "texHazardHeavy") {
      h.setData("hp", 2);
    }
  }

  private spawnCollectible(x: number, y: number) {
    const g = this.collectibles.create(x, y, "texGem");
    g.setDepth(6);
  }

  private spawnRiskCollectible() {
    if (this.countRiskCollectiblesOnField() >= 2) return;
    const { width, height } = this.scale;
    const margin = 88;
    const x = Phaser.Math.Between(margin, width - margin);
    const y = Phaser.Math.Between(130, height - 130);
    const g = this.collectibles.create(x, y, "texGem") as Phaser.Physics.Arcade.Image;
    g.setDepth(7);
    g.setScale(1.14);
    const hc = parseInt(this.spec.theme.hazardColor.replace("#", ""), 16);
    g.setTint(hc);
    g.setData("riskBonus", 5);
    const gb = g.body as Phaser.Physics.Arcade.Body | null;
    if (gb) gb.setAllowGravity(false);
  }

  private countRiskCollectiblesOnField(): number {
    const kids = this.collectibles.getChildren();
    let n = 0;
    for (let i = 0; i < kids.length; i += 1) {
      const c = kids[i] as Phaser.Physics.Arcade.Image;
      if (!c?.active) continue;
      if (Number(c.getData("riskBonus") ?? 0) > 0) n += 1;
    }
    return n;
  }

  /** collector 专属：黄金收集物（高价值，限时出现，闪烁提示） */
  private spawnGoldenPickup() {
    const { width, height } = this.scale;
    const margin = 100;
    const x = Phaser.Math.Between(margin, width - margin);
    const y = Phaser.Math.Between(margin, height - margin);
    const g = this.collectibles.create(x, y, "texGem") as Phaser.Physics.Arcade.Image;
    g.setDepth(8);
    g.setScale(1.32);
    const gc = parseInt((this.spec.theme.collectibleColor ?? "#ffd700").replace("#", ""), 16);
    g.setTint(gc);
    g.setData("goldenBonus", 8);
    const gb = g.body as Phaser.Physics.Arcade.Body | null;
    if (gb) gb.setAllowGravity(false);
    // 闪烁动画提示高价值
    this.tweens.add({
      targets: g,
      alpha: { from: 1, to: 0.45 },
      duration: 380,
      yoyo: true,
      repeat: -1,
    });
  }

  private spawnPowerup() {
    if (this.finished) return;
    const pool = this.spec.systems?.powerups ?? [];
    if (pool.length === 0) return;
    const pick = pool[Phaser.Math.Between(0, pool.length - 1)];
    if (!pick) return;
    const { width, height } = this.scale;
    const x =
      this.spec.templateId === "collector"
        ? Phaser.Math.Between(90, width - 90)
        : Phaser.Math.Between(90, width - 90);
    const y =
      this.spec.templateId === "collector"
        ? Phaser.Math.Between(120, height - 120)
        : -30;
    const s = this.powerups.create(x, y, "texPower");
    s.setDepth(7);
    s.setAlpha(0.95);
    s.setData("kind", pick.type);
    if (this.spec.templateId !== "collector") {
      s.setVelocity(Phaser.Math.Between(-30, 30), Math.floor(this.spec.gameplay.hazardSpeed * 0.62));
    } else {
      s.setVelocity(Phaser.Math.Between(-40, 40), Phaser.Math.Between(-40, 40));
      const body = s.body as Phaser.Physics.Arcade.Body;
      body.setCollideWorldBounds(true);
      body.setBounce(1, 1);
    }
  }

  private applyPowerup(kind: string) {
    const now = this.time.now;
    if (kind === "shield") {
      this.shieldCharges = Math.min(2, this.shieldCharges + 1);
      return;
    }
    if (kind === "doubleScore") {
      this.scoreMult = 2;
      this.time.delayedCall(5200, () => {
        this.scoreMult = 1;
      });
      return;
    }
    if (kind === "magnet") {
      this.magnetUntil = now + 5200;
      return;
    }
    if (kind === "heal") {
      if (this.livesText) {
        this.lives = Math.min(9, this.lives + 1);
        this.livesText.setText(hudLives(this.uiLocale, this.lives));
      }
      return;
    }
    if (kind === "timeSlow") {
      this.slowUntil = now + 2600;
      return;
    }
  }

  private tryCastSkill() {
    const skill = this.spec.systems?.skill;
    if (!skill) return;
    if (this.time.now < this.skillReadyAt) return;

    const cd = skill.cooldownMs;
    this.skillReadyAt = this.time.now + cd;

    const dur = skill.durationMs ?? 0;
    if (skill.effect === "shield") {
      this.shieldCharges = Math.max(this.shieldCharges, skill.strength && skill.strength > 0.75 ? 2 : 1);
      if (dur > 0) {
        this.time.delayedCall(dur, () => {
          this.shieldCharges = Math.max(0, this.shieldCharges - 1);
        });
      }
      this.fxShield();
      this.refreshHud();
      return;
    }

    if (skill.effect === "bomb") {
      const hx = this.player.x;
      const hy = this.player.y;
      const hazards = this.hazards.getChildren();
      const r = 160;
      for (let i = 0; i < hazards.length; i += 1) {
        const s = hazards[i] as Phaser.Physics.Arcade.Image;
        if (!s?.active) continue;
        const d = Phaser.Math.Distance.Between(hx, hy, s.x, s.y);
        if (d <= r) s.destroy();
      }
      juiceFlash(this, { r: 255, g: 200, b: 90 }, { durationMs: 120 });
      playBleep("hit");
      this.refreshHud();
      return;
    }

    if (skill.effect === "dash") {
      const boostUntil = this.time.now + 900;
      const old = this.intensity;
      // dash：短时间提升操控速度（不改 spec）
      this.intensity = Math.max(0.2, old - 0.12);
      this.invulnUntil = Math.max(this.invulnUntil, this.time.now + 520);
      this.time.delayedCall(boostUntil - this.time.now, () => {
        this.intensity = old;
      });
      juiceFlash(this, { r: 120, g: 255, b: 160 }, { durationMs: 90 });
      playBleep("pickup");
      this.refreshHud();
      return;
    }

    if (skill.effect === "timeSlow") {
      this.slowUntil = Math.max(this.slowUntil, this.time.now + Math.max(1400, dur || 2200));
      this.refreshHud();
    }
  }

  private hitHazard() {
    if (this.finished) return;

    if (this.spec.templateId === "survivor") {
      this.survivorDodgeStreak = 0;
      this.invulnUntil = this.time.now + 720;
      this.lives -= 1;
      juiceShake(this, { durationMs: 180, intensity: 0.009 });
      juiceFlash(this, { r: 255, g: 60, b: 60 }, { durationMs: 130 });
      playBleep("hit");
      this.player.setAlpha(0.35);
      this.time.delayedCall(200, () => this.player.setAlpha(1));
      if (this.livesText) this.livesText.setText(hudLives(this.uiLocale, this.lives));
      if (this.lives === 1) {
        this.soundscape?.triggerEvent("danger");
        this.startDangerVignette();
      }
      if (this.lives <= 0) {
        this.finish({ score: this.score, won: false });
      }
      return;
    }

    if (this.spec.templateId === "collector") {
      this.collectorCombo = 0;
      this.lastCollectorPickupAt = 0;
      this.lives -= 1;
      juiceShake(this, { durationMs: 160, intensity: 0.008 });
      juiceFlash(this, { r: 255, g: 60, b: 60 }, { durationMs: 120 });
      playBleep("hit");
      if (this.livesText) this.livesText.setText(hudLives(this.uiLocale, this.lives));
      if (this.lives === 1) {
        this.soundscape?.triggerEvent("danger");
        this.startDangerVignette();
      }
      if (this.lives <= 0) {
        this.finish({ score: this.score, won: false });
      }
      return;
    }

    juiceShake(this, { durationMs: 200, intensity: 0.012 });
    juiceFlash(this, { r: 255, g: 60, b: 60 }, { durationMs: 150 });
    playBleep("hit");
    this.finish({ score: this.score, won: false });
  }

  private startDangerVignette() {
    if (!this.dangerVignette) return;
    this.tweens.killTweensOf(this.dangerVignette);
    this.tweens.add({
      targets: this.dangerVignette,
      alpha: { from: 0.0, to: 0.18 },
      duration: 800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    if (this.dangerVignette) {
      this.tweens.killTweensOf(this.dangerVignette);
      this.dangerVignette.setAlpha(0);
    }
    this.finished = true;
    this.spawnTimer.remove(false);
    this.physics.pause();
    this.hintText.setText(playFinishText(this.uiLocale, this.spec.templateId, payload.won));
    if (payload.won) {
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    }
    this.onEnd(payload);
  }

  update() {
    if (this.finished) return;
    this.updateBoss();
    if (this.spec.templateId === "survivor") {
      this.maybeStartSurvivorLastStandByProgress();
      this.tickSurvivorLastStandEnd();
    }
    const baseSpeed = this.spec.gameplay.playerSpeed;
    const speed =
      this.time.now < this.magnetUntil && this.spec.templateId === "collector"
        ? Math.floor(baseSpeed * 1.08)
        : baseSpeed;
    const { width, height } = this.scale;

    if (Phaser.Input.Keyboard.JustDown(this.keyShift)) {
      this.tryCastSkill();
    }

    // 时间减速：直接用 world/time timeScale（避免每个物体重复缩放速度）
    const slowOn = this.time.now < this.slowUntil;
    const wanted = slowOn ? 0.75 : 1;
    if (wanted !== this.lastWorldTimeScale) {
      this.lastWorldTimeScale = wanted;
      this.physics.world.timeScale = wanted;
      this.time.timeScale = slowOn ? 0.92 : 1;
    }

    if (this.spec.templateId === "collector") {
      let vx = 0;
      let vy = 0;
      if (this.cursors.left.isDown || this.keyA.isDown) vx -= 1;
      if (this.cursors.right.isDown || this.keyD.isDown) vx += 1;
      if (this.cursors.up.isDown || this.keyW.isDown) vy -= 1;
      if (this.cursors.down.isDown || this.keyS.isDown) vy += 1;
      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy);
        vx = (vx / len) * speed;
        vy = (vy / len) * speed;
      }
      this.player.setVelocity(vx, vy);

      // 磁铁：吸附收集物
      if (this.time.now < this.magnetUntil) {
        const items = this.collectibles.getChildren();
        for (let i = 0; i < items.length; i += 1) {
          const c = items[i] as Phaser.Physics.Arcade.Image;
          if (!c?.active) continue;
          const d = Phaser.Math.Distance.Between(c.x, c.y, this.player.x, this.player.y);
          if (d > 280) continue;
          const dx = this.player.x - c.x;
          const dy = this.player.y - c.y;
          const len = Math.hypot(dx, dy) || 1;
          c.setVelocity((dx / len) * 180, (dy / len) * 180);
        }
      }
      return;
    }

    let vx = 0;
    if (this.cursors.left.isDown || this.keyA.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keyD.isDown) vx += 1;
    this.player.setVelocityX(vx * speed);
    this.player.setVelocityY(0);
    this.player.y = height - this.pad;

    const half = 18;
    this.player.x = Phaser.Math.Clamp(this.player.x, half + 8, width - half - 8);

    const hazards = this.hazards.getChildren();
    for (let i = 0; i < hazards.length; i += 1) {
      const s = hazards[i] as Phaser.Physics.Arcade.Image;
      if (!s.active) continue;
      if (this.spec.templateId === "avoider") {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y);
        if (d < 60 && d > 26) {
          this.triggerNearMiss(s);
        }
      }
      if (s.y > height + 80) {
        s.destroy();
        if (!this.finished) {
          let add = 1 * this.scoreMult;
          if (this.spec.templateId === "survivor") {
            this.survivorDodgeStreak += 1;
            const lastStand =
              this.lives <= 2 ||
              this.getActModifiers().includes("finale") ||
              this.time.now < this.survivorLastStandUntil;
            if (lastStand) add += 1;
            if (this.survivorDodgeStreak % 6 === 0) {
              const grit = 2 + Math.min(3, Math.floor(this.survivorDodgeStreak / 12));
              add += grit;
              this.banner.show({
                ...bannerSurvivorGrit(this.uiLocale, this.survivorDodgeStreak, grit),
                ms: 1200,
              });
            }
          }
          this.score += add;
          if (this.time.now < this.goalShiftUntil) {
            this.goalShiftHave += 1;
            if (!this.goalShiftSucceeded && this.goalShiftHave >= this.goalShiftNeed) {
              this.goalShiftSucceeded = true;
              const bonus = Math.max(3, Math.floor(4 + this.eventStrength * 4));
              this.score += bonus;
              this.banner.show({ ...bannerGoalComplete(this.uiLocale, bonus), ms: 1600 });
            }
          }
          this.refreshHud();
          if (this.score >= this.winScore) {
            this.finish({ score: this.score, won: true });
          }
        }
      }
    }

    if (this.spec.templateId === "survivor" && this.survivorLastStandUntil > this.time.now) {
      this.refreshHud();
    }
  }

  private showFloater(x: number, y: number, message: string, color: string) {    const floater = this.add
      .text(x, y, message, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color,
      })
      .setOrigin(0.5)
      .setDepth(36);
    this.tweens.add({
      targets: floater,
      y: y - 28,
      alpha: 0,
      duration: 480,
      ease: "Quad.Out",
      onComplete: () => floater.destroy(),
    });
  }

  private drawShieldRing() {
    this.shieldRing.clear();
    if (this.shieldCharges <= 0) return;
    const c = parseInt((this.spec.theme.collectibleColor ?? "#67e8f9").replace("#", ""), 16);
    this.shieldRing.lineStyle(2, c, 0.65);
    this.shieldRing.strokeCircle(this.player.x, this.player.y, 28);
    this.shieldRing.strokeCircle(this.player.x, this.player.y, 22);
  }

  private getActModifiers(): string[] {
    const acts = this.spec.director?.acts ?? null;
    return acts?.[this.actIndex]?.modifiers ?? [];
  }

  private startSurvivorLastStand(reason: string) {
    if (this.spec.templateId !== "survivor" || this.finished) return;
    if (this.survivorLastStandStarted) return;
    this.survivorLastStandStarted = true;
    const ms = Math.floor(10000 + this.intensity * 3500);
    this.survivorLastStandUntil = this.time.now + ms;
    const sec = Math.ceil(ms / 1000);
    this.banner.show({
      ...bannerLastStand(this.uiLocale, reason, sec),
      ms: 2200,
    });
    this.soundscape?.triggerEvent("danger");
    this.refreshHud();
  }

  private maybeStartSurvivorLastStandByProgress() {
    if (this.spec.templateId !== "survivor" || this.survivorLastStandStarted || this.finished) return;
    if (this.winScore <= 0) return;
    if (this.score / this.winScore >= 0.88) {
      this.startSurvivorLastStand(survivorLastStandReason(this.uiLocale));
    }
  }

  private tickSurvivorLastStandEnd() {
    if (this.spec.templateId !== "survivor" || this.finished) return;
    if (!this.survivorLastStandStarted || this.survivorLastStandRewarded) return;
    if (this.survivorLastStandUntil <= 0 || this.time.now < this.survivorLastStandUntil) return;

    this.survivorLastStandRewarded = true;
    this.survivorLastStandUntil = 0;
    const bonus = 5;
    this.score += bonus;
    this.banner.show({
      ...bannerLastStandEnd(this.uiLocale, bonus),
      ms: 1800,
    });
    playBleep("pickup");
    this.refreshHud();
    if (this.score >= this.winScore) {
      this.finish({ score: this.score, won: true });
    }
  }

  private triggerNearMiss(hazard: Phaser.Physics.Arcade.Image) {
    if (this.spec.templateId !== "avoider") return;
    if (hazard.getData("nearMissAwarded")) return;
    hazard.setData("nearMissAwarded", true);
    const now = this.time.now;
    const chainWindow = 1600;
    if (now - this.avoiderLastNearMissAt <= chainWindow && this.avoiderLastNearMissAt > 0) {
      this.avoiderNearMissChain = Math.min(16, this.avoiderNearMissChain + 1);
    } else {
      this.avoiderNearMissChain = 1;
    }
    this.avoiderLastNearMissAt = now;
    const chainBonus = Math.min(this.avoiderNearMissChain - 1, 5);
    const add = 1 + chainBonus;
    this.score += add;
    const label =
      chainBonus > 0
        ? floaterNearMiss(this.uiLocale, add, this.avoiderNearMissChain)
        : floaterNearMiss(this.uiLocale, 1);
    const floater = this.add
      .text(hazard.x, Math.max(80, hazard.y - 18), label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: this.cohesive.hud.accent,
      })
      .setOrigin(0.5)
      .setDepth(35);
    this.tweens.add({
      targets: floater,
      y: floater.y - 26,
      alpha: 0,
      duration: 520,
      ease: "Quad.Out",
      onComplete: () => floater.destroy(),
    });
    juiceFlash(this, { r: 180, g: 220, b: 255 }, { durationMs: 70 });
    this.refreshHud();
    if (this.score >= this.winScore) {
      this.finish({ score: this.score, won: true });
    }
  }

  // ═══════════════ Boss 系统 ═══════════════

  private spawnBoss(strength: number) {
    if (this.bossActive) return;
    this.bossActive = true;
    const { width } = this.scale;
    this.bossMaxHp = 3 + Math.floor(strength * 3);
    this.bossHp = this.bossMaxHp;
    this.bossPhase = 0;

    this.soundscape?.triggerEvent("boss");
    juiceShake(this, { durationMs: 500, intensity: 0.025 });
    this.startDangerVignette();

    const x = Phaser.Math.Between(120, width - 120);
    this.bossSprite = this.physics.add.image(x, -80, "texBoss");
    this.bossSprite.setDepth(6);
    this.bossSprite.setScale(2.2);
    this.bossSprite.setAlpha(0.95);
    this.bossSprite.setVelocity(0, 60);
    (this.bossSprite.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    (this.bossSprite.body as Phaser.Physics.Arcade.Body).setBounce(0.6, 0.6);
    this.bossSprite.setData("type", "boss");

    // Health bar
    this.bossHealthBarBg = this.add.graphics().setDepth(7);
    this.bossHealthBar = this.add.graphics().setDepth(8);

    const boss = playSceneBossBanner(this.uiLocale);
    this.banner.show({ title: boss.title, message: boss.message, ms: 2000 });

    // Boss attack cycle: every 2-3 seconds
    this.bossAttackTimer = this.time.addEvent({
      delay: 2000 + Math.random() * 1000,
      callback: () => this.bossAttack(),
      loop: true,
    });

    playBleep("pickup");
  }

  private bossAttack() {
    if (!this.bossActive || !this.bossSprite || this.finished) return;
    const boss = this.bossSprite;
    const p = this.player;
    const now = this.time.now;

    if (this.bossHp <= 0) return;

    // Phase-based behavior
    if (this.bossPhase === 0) {
      // Phase 1: Shoot aimed projectile toward player
      const angle = Phaser.Math.Angle.Between(boss.x, boss.y, p.x, p.y);
      const orb = this.bossOrbs.create(boss.x, boss.y, "texGem");
      orb.setDepth(5);
      orb.setScale(0.6);
      orb.setTint(0xff4444);
      orb.setVelocity(Math.cos(angle) * 280, Math.sin(angle) * 280);
      this.time.delayedCall(4000, () => { if (orb.active) orb.destroy(); });
    } else if (this.bossPhase === 1) {
      // Phase 2: Burst fire - multiple orbs
      for (let i = 0; i < 3; i++) {
        const angle = Phaser.Math.Angle.Between(boss.x, boss.y, p.x, p.y) + (i - 1) * 0.35;
        const orb = this.bossOrbs.create(boss.x, boss.y, "texGem");
        orb.setDepth(5);
        orb.setScale(0.5);
        orb.setTint(0xff6644);
        orb.setVelocity(Math.cos(angle) * 320, Math.sin(angle) * 320);
        this.time.delayedCall(3500, () => { if (orb.active) orb.destroy(); });
      }
    } else {
      // Phase 3: Rage - spawn minions + charge at player
      for (let i = 0; i < 2; i++) {
        this.spawnHazard(Phaser.Math.Between(40, this.scale.width - 40), -20);
      }
      // Charge toward player
      const angle = Phaser.Math.Angle.Between(boss.x, boss.y, p.x, p.y);
      boss.setVelocity(Math.cos(angle) * 200, Math.sin(angle) * 200);
      this.time.delayedCall(800, () => {
        if (boss.active) {
          boss.setVelocity(Phaser.Math.Between(-60, 60), 60);
        }
      });
    }

    // Speed up attack timer as boss weakens
    if (this.bossAttackTimer) {
      this.bossAttackTimer.remove();
    }
    const delay = this.bossPhase === 2 ? 1200 + Math.random() * 600 : 2000 + Math.random() * 1000;
    this.bossAttackTimer = this.time.addEvent({
      delay,
      callback: () => this.bossAttack(),
      loop: false,
    });
  }

  private damageBoss() {
    if (!this.bossActive || !this.bossSprite || this.time.now < this.bossInvulnUntil) return;
    this.bossHp -= 1;
    this.bossInvulnUntil = this.time.now + 400;

    if (this.bossHp <= 0) {
      this.killBoss();
      return;
    }

    // Phase check
    const ratio = this.bossHp / this.bossMaxHp;
    const newPhase = ratio > 0.6 ? 0 : ratio > 0.3 ? 1 : 2;
    if (newPhase !== this.bossPhase) {
      this.bossPhase = newPhase;
      juiceShake(this, { durationMs: 350, intensity: 0.02 });
      juiceFlash(this, { r: 255, g: 80, b: 80 }, { durationMs: 150 });
      (this.bossSprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      const label = bossPhaseLabel(this.uiLocale, newPhase === 1 ? 1 : 2);
      this.banner.show({ ...bannerEliteAssault(this.uiLocale, label), ms: 1400 });
      this.soundscape?.triggerEvent("danger");
      // Rage aura: pulse red
      this.bossSprite.setTint(newPhase === 1 ? 0xff8888 : 0xff3333);
      this.bossSprite.setScale(newPhase === 2 ? 2.5 : 2.3);
    }

    // Damage feedback
    juiceFlash(this, { r: 255, g: 200, b: 50 }, { durationMs: 80 });
    juiceShake(this, { durationMs: 100, intensity: 0.008 });
    this.bossSprite.setTint(0xffffff);
    this.time.delayedCall(80, () => {
      if (this.bossSprite?.active) {
        this.bossSprite.clearTint();
        if (this.bossPhase === 1) this.bossSprite.setTint(0xff8888);
        if (this.bossPhase === 2) this.bossSprite.setTint(0xff3333);
      }
    });

    // Score for damaging boss
    this.score += 3;
    const floater = this.add.text(this.bossSprite.x, this.bossSprite.y - 30, "-1 ❤", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "16px",
      color: "#ff4444",
    }).setOrigin(0.5).setDepth(35);
    this.tweens.add({
      targets: floater, y: floater.y - 30, alpha: 0, duration: 600, ease: "Quad.Out",
      onComplete: () => floater.destroy(),
    });

    this.refreshHud();
  }

  private killBoss() {
    if (!this.bossActive || !this.bossSprite) return;
    this.bossActive = false;
    const bx = this.bossSprite.x, by = this.bossSprite.y;

    // Death explosion
    juiceShake(this, { durationMs: 600, intensity: 0.035 });
    juiceFlash(this, { r: 255, g: 150, b: 50 }, { durationMs: 300 });
    juiceBurst(this, bx, by, "#ff6600", 24);
    playBleep("pickup");

    this.bossSprite.destroy();
    this.bossSprite = null;

    if (this.bossHealthBar) { this.bossHealthBar.destroy(); this.bossHealthBar = null; }
    if (this.bossHealthBarBg) { this.bossHealthBarBg.destroy(); this.bossHealthBarBg = null; }
    if (this.bossAttackTimer) { this.bossAttackTimer.remove(); this.bossAttackTimer = null; }

    // Stop danger vignette
    if (this.dangerVignette) {
      this.tweens.killTweensOf(this.dangerVignette);
      this.dangerVignette.setAlpha(0);
    }

    // Big score reward
    const bonus = 15 + this.bossMaxHp * 5;
    this.score += bonus;
    const floater = this.add.text(bx, by - 50, floaterBossKill(this.uiLocale, bonus), {
      fontFamily: "system-ui, sans-serif",
      fontSize: "20px",
      color: "#ffcc00",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(35);
    this.tweens.add({
      targets: floater, y: floater.y - 40, alpha: 0, duration: 1200, ease: "Quad.Out",
      onComplete: () => floater.destroy(),
    });

    this.banner.show({ ...bannerBossDefeated(this.uiLocale, bonus), ms: 2200 });
    this.refreshHud();

    // Clean up remaining boss orbs
    this.bossOrbs.clear(true, true);

    if (this.score >= this.winScore) {
      this.time.delayedCall(600, () => this.finish({ score: this.score, won: true }));
    }
  }

  private drawBossHealthBar() {
    if (!this.bossActive || !this.bossSprite || !this.bossHealthBar || !this.bossHealthBarBg) return;
    const boss = this.bossSprite;
    const barW = 80, barH = 8;
    const x = boss.x - barW / 2, y = boss.y - 50;
    const ratio = Math.max(0, this.bossHp / this.bossMaxHp);
    const color = ratio > 0.5 ? 0x44ff44 : ratio > 0.25 ? 0xffaa00 : 0xff3333;

    this.bossHealthBarBg.clear();
    this.bossHealthBarBg.fillStyle(0x000000, 0.5);
    this.bossHealthBarBg.fillRoundedRect(x - 1, y - 1, barW + 2, barH + 2, 3);

    this.bossHealthBar.clear();
    this.bossHealthBar.fillStyle(color, 0.9);
    this.bossHealthBar.fillRoundedRect(x, y, barW * ratio, barH, 3);
  }

  private updateBoss() {
    if (!this.bossActive) return;
    this.drawBossHealthBar();
  }

  // ═══════════════ Boss 系统 END ═══════════════
}
